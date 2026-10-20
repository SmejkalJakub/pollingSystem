import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import ExcelJS from 'exceljs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { readEnvironment } from '../../config';
import { dropTestDatabase } from '../../db/test-database';
import { createAuthService, setAdminPassword } from '../auth/service';
import { newSecret, secretHash } from '../auth/crypto';
import { createEventService } from '../events/service';
import { createVotingService } from '../votings/service';
import { createWizardService } from '../wizard/service';
import { randomBytes } from 'node:crypto';
import { createLinkVault } from '../auth/link-vault';
import { createJurorAccessService } from '../auth/juror-access';
import { createBallotAdminService } from '../ballots/admin';
import { createResultsService } from './service';

const name = `d21_test_${randomUUID().replaceAll('-', '')}`;
const base = process.env.TEST_DATABASE_URL ?? readEnvironment().DATABASE_URL;
const admin = new pg.Pool({
  connectionString: base,
  max: 2,
  connectionTimeoutMillis: 3000,
});
const url = new URL(base);
url.pathname = `/${name}`;
const pool = new pg.Pool({
  connectionString: url.toString(),
  max: 8,
  connectionTimeoutMillis: 3000,
});
const auth = createAuthService(pool);
const wizard = createWizardService(pool, auth);
const results = createResultsService(pool, auth);
let app: ReturnType<typeof buildApp>;
let adminId: string;
let token: string;
let created = false;
const origin = 'http://127.0.0.1:5173';
const request = (
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  payload?: object,
  session = token,
) =>
  app.inject({
    method,
    url: path,
    payload,
    headers: {
      origin,
      'x-d21-request': '1',
      ...(session ? { cookie: `d21-session=${session}` } : {}),
    },
  });
async function session() {
  const value = newSecret();
  await pool.query(
    "INSERT INTO sessions(token_hash,admin_user_id,expires_at) VALUES ($1,$2,now()+interval '12 hours')",
    [secretHash(value), adminId],
  );
  return value;
}
async function fixture() {
  const event = (
    await pool.query(
      "INSERT INTO events(name) VALUES ('Export event') RETURNING id",
    )
  ).rows[0].id as string;
  const groups: string[] = [],
    jurors: string[] = [];
  for (const code of ['T', 'V']) {
    const group = (
      await pool.query(
        'INSERT INTO jury_groups(event_id,code,name) VALUES ($1,$2::jury_group_code,$2::text) RETURNING id',
        [event, code],
      )
    ).rows[0].id as string;
    groups.push(group);
    jurors.push(
      (
        await pool.query(
          "INSERT INTO event_jurors(event_id,jury_group_id,display_name) VALUES ($1,$2,'Same name') RETURNING id",
          [event, group],
        )
      ).rows[0].id as string,
    );
  }
  const jurorToken = newSecret();
  await pool.query(
    "INSERT INTO sessions(token_hash,event_id,juror_id,expires_at) VALUES ($1,$2,$3,now()+interval '12 hours')",
    [secretHash(jurorToken), event, jurors[0]],
  );
  async function voting(status = 'active') {
    const id = (
      await pool.query(
        "INSERT INTO votings(event_id,name,kind,status,selected_places,max_plus_votes,max_minus_votes,allow_negative_votes) VALUES ($1,'Category','final',$2::voting_status,1,2,1,true) RETURNING id",
        [event, status],
      )
    ).rows[0].id as string;
    await pool.query(
      'INSERT INTO voting_allowed_groups(event_id,voting_id,jury_group_id) SELECT $1,$2,unnest($3::uuid[])',
      [event, id, groups],
    );
    const items: string[] = [],
      teams: string[] = [];
    for (let i = 0; i < 4; i++) {
      const team = (
        await pool.query(
          "INSERT INTO teams(event_id,name) VALUES ($1,'Team') RETURNING id",
          [event],
        )
      ).rows[0].id as string;
      teams.push(team);
      items.push(
        (
          await pool.query(
            "INSERT INTO voting_items(event_id,voting_id,team_id,name,display_order) VALUES ($1,$2,$3,'Team',$4) RETURNING id",
            [event, id, team, i],
          )
        ).rows[0].id as string,
      );
    }
    return { id, items, teams };
  }
  return {
    event,
    groups,
    jurors,
    jurorToken,
    active: await voting(),
    draft: await voting('draft'),
    voting,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const exportPath = (event: string) => `/results/export.xlsx?eventId=${event}`;
async function workbook(event: string) {
  const response = await request('GET', exportPath(event));
  expect(response.statusCode).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['content-type']).toContain('spreadsheetml.sheet');
  expect(response.headers['content-disposition']).toBe(
    `attachment; filename="d21-${event}.xlsx"`,
  );
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(response.rawPayload as unknown as ExcelJS.Buffer);
  return book;
}
beforeAll(async () => {
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await migrate(drizzle(pool), {
    migrationsFolder: fileURLToPath(
      new URL('../../db/migrations', import.meta.url),
    ),
  });
  await setAdminPassword(pool, 'Disposable Phase Twelve password');
  adminId = (await pool.query('SELECT user_id FROM admin_access')).rows[0]
    .user_id as string;
  token = await session();
  app = buildApp({
    checkDatabase: async () => {},
    auth: {
      service: auth,
      origin,
      events: createEventService(
        pool,
        auth,
        createLinkVault(
          JSON.stringify({ test: randomBytes(32).toString('hex') }),
          'test',
        ),
      ),
      votings: createVotingService(pool, auth),
      results,
      wizard,
      jurorAccess: createJurorAccessService(
        pool,
        auth,
        createLinkVault(
          JSON.stringify({ test: randomBytes(32).toString('hex') }),
          'test',
        ),
      ),
      ballotAdmin: createBallotAdminService(pool, auth),
    },
  });
});
afterAll(async () => {
  await app?.close();
  await pool.end();
  try {
    if (created) await dropTestDatabase(admin, name);
  } finally {
    await admin.end();
  }
});

it('audits actual lifecycle changes once, retains history and rejects invalid transitions', async () => {
  const f = await fixture();
  for (const action of ['close', 'close', 'reopen', 'reopen'])
    expect(
      (await request('POST', `/votings/${f.active.id}/${action}`, {}))
        .statusCode,
    ).toBe(200);
  expect(
    (await request('POST', `/votings/${f.draft.id}/reopen`, {})).statusCode,
  ).toBe(409);
  expect(
    (await request('POST', `/votings/${f.draft.id}/activate`, {})).statusCode,
  ).toBe(409);
  const history = (
    await pool.query(
      'SELECT actor_user_id,action,context FROM audit_logs WHERE event_id=$1 ORDER BY created_at,id',
      [f.event],
    )
  ).rows;
  expect(history).toEqual([
    {
      actor_user_id: adminId,
      action: 'voting.closed',
      context: { from: 'active', to: 'closed' },
    },
    {
      actor_user_id: adminId,
      action: 'voting.reopened',
      context: { from: 'closed', to: 'active' },
    },
  ]);
  for (const group of f.groups)
    await pool.query(
      "INSERT INTO event_jurors(event_id,jury_group_id,display_name) SELECT $1,$2,'Extra ' || n FROM generate_series(1,4) n",
      [f.event, group],
    );
  expect(
    (await request('POST', `/votings/${f.draft.id}/activate`, {})).statusCode,
  ).toBe(200);
  expect(
    (await request('POST', `/votings/${f.draft.id}/activate`, {})).statusCode,
  ).toBe(200);
  expect(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM audit_logs WHERE event_id=$1 AND action='voting.activated'",
        [f.event],
      )
    ).rows[0].n,
  ).toBe(1);
});

it('audits link regeneration/revocation without secrets and keeps no-op revocation idempotent', async () => {
  const f = await fixture();
  const path = `/events/${f.event}/jurors/${f.jurors[0]}/access`;
  const first = await request('POST', path, {});
  const second = await request('POST', path, {});
  expect(first.statusCode).toBe(200);
  expect(second.statusCode).toBe(200);
  const old = new URL(first.json().url as string).hash.split('key=')[1]!;
  expect(
    (
      await request(
        'POST',
        '/auth/juror/start',
        { eventId: f.event, token: old },
        '',
      )
    ).statusCode,
  ).toBe(401);
  expect((await request('POST', `${path}/revoke`, {})).statusCode).toBe(204);
  expect((await request('POST', `${path}/revoke`, {})).statusCode).toBe(204);
  const history = (
    await pool.query(
      'SELECT actor_user_id,action,context FROM audit_logs WHERE event_id=$1 ORDER BY created_at,id',
      [f.event],
    )
  ).rows;
  expect(history.map((r) => r.action)).toEqual([
    'juror_access.issued',
    'juror_access.issued',
    'juror_access.revoked',
  ]);
  expect(history.every((r) => r.actor_user_id === adminId)).toBe(true);
  expect(JSON.stringify(history)).not.toContain(old);
  expect(history[1].context).toEqual({ replacedLinks: 1, revokedSessions: 0 });
  expect(
    (
      await pool.query(
        'SELECT count(*)::int AS n FROM sessions WHERE event_id=$1 AND revoked_at IS NULL',
        [f.event],
      )
    ).rows[0].n,
  ).toBe(0);
});

it('rolls back lifecycle and access mutations if their audit write fails', async () => {
  const f = await fixture();
  const path = `/events/${f.event}/jurors/${f.jurors[0]}/access`;
  expect((await request('POST', path, {})).statusCode).toBe(200);
  await pool.query(
    `CREATE FUNCTION phase12_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_id='${f.event}'::uuid THEN RAISE EXCEPTION 'disposable failure'; END IF; RETURN NEW; END; $$`,
  );
  await pool.query(
    'CREATE TRIGGER phase12_fail_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION phase12_fail_audit()',
  );
  try {
    expect(
      (await request('POST', `/votings/${f.active.id}/close`, {})).statusCode,
    ).toBe(500);
    expect((await request('POST', path, {})).statusCode).toBe(500);
    expect((await request('POST', `${path}/revoke`, {})).statusCode).toBe(500);
    expect(
      (
        await pool.query('SELECT status FROM votings WHERE id=$1', [
          f.active.id,
        ])
      ).rows[0].status,
    ).toBe('active');
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM juror_access WHERE event_id=$1 AND revoked_at IS NULL',
          [f.event],
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM audit_logs WHERE event_id=$1',
          [f.event],
        )
      ).rows[0].n,
    ).toBe(1);
  } finally {
    await pool.query('DROP TRIGGER phase12_fail_audit ON audit_logs');
    await pool.query('DROP FUNCTION phase12_fail_audit()');
  }
});

it('exports real numeric scores, shared ranks, provisional status and distinct current participation without writing', async () => {
  const f = await fixture();
  const entries = [
    { votingItemId: f.active.items[0]!, voteValue: 1 as const },
    { votingItemId: f.active.items[1]!, voteValue: 1 as const },
    { votingItemId: f.active.items[2]!, voteValue: -1 as const },
  ];
  await wizard.submit(f.jurorToken, f.active.id, {
    expectedRevision: null,
    entries,
  });
  const before = (
    await pool.query(
      'SELECT (SELECT count(*) FROM ballots)::int AS ballots,(SELECT count(*) FROM audit_logs)::int AS history',
    )
  ).rows[0];
  const book = await workbook(f.event);
  expect(book.worksheets.map((s) => s.name)).toEqual([
    'Kategorie',
    'Výsledky',
    'Účast',
  ]);
  const categories = book.getWorksheet('Kategorie')!;
  const rows = book.getWorksheet('Výsledky')!;
  const attendance = book.getWorksheet('Účast')!;
  expect(categories.rowCount).toBe(7);
  expect(rows.rowCount).toBe(13);
  expect(attendance.rowCount).toBe(9);
  const data = rows
    .getRows(6, 8)!
    .filter((r) => r.getCell(2).value === f.active.id);
  expect(data.map((r) => r.getCell(9).value)).toEqual([1, 1, 0, -1]);
  expect(data.map((r) => r.getCell(10).value)).toEqual([1, 1, 3, 4]);
  expect(data.slice(0, 2).map((r) => r.getCell(12).value)).toEqual([
    'Nerozhodnutá shoda',
    'Nerozhodnutá shoda',
  ]);
  expect(data.every((r) => r.getCell(13).value === 'Průběžný výsledek')).toBe(
    true,
  );
  expect(new Set(data.map((r) => r.getCell(4).value)).size).toBe(4);
  expect(
    attendance.getRows(6, 4)!.filter((r) => r.getCell(8).value === 'Odevzdáno'),
  ).toHaveLength(1);
  for (const ws of book.worksheets) {
    expect(ws.getCell('B3').value).toBe(categories.getCell('B3').value);
    expect(ws.views[0]?.state).toBe('frozen');
    expect(ws.autoFilter).toBeTruthy();
  }
  expect(
    (
      await pool.query(
        'SELECT (SELECT count(*) FROM ballots)::int AS ballots,(SELECT count(*) FROM audit_logs)::int AS history',
      )
    ).rows[0],
  ).toEqual(before);
  const text = JSON.stringify(book.model);
  expect(text).not.toContain('ballot.submitted');
  expect(text).not.toContain(f.jurorToken);
  expect(text).not.toContain('voteValue');
  expect(text).not.toContain('password_hash');
});

it('exports only current submissions through closure, unlock and replacement, without counting audit snapshots', async () => {
  const f = await fixture();
  const vToken = newSecret();
  await pool.query(
    "INSERT INTO sessions(token_hash,event_id,juror_id,expires_at) VALUES ($1,$2,$3,now()+interval '12 hours')",
    [secretHash(vToken), f.event, f.jurors[1]],
  );
  const entries = [{ votingItemId: f.active.items[0]!, voteValue: 1 as const }];
  await wizard.submit(f.jurorToken, f.active.id, {
    expectedRevision: null,
    entries,
  });
  const submitted = await wizard.submit(vToken, f.active.id, {
    expectedRevision: null,
    entries,
  });
  const ballotId = (
    await pool.query(
      'SELECT id FROM ballots WHERE voting_id=$1 AND juror_id=$2',
      [f.active.id, f.jurors[1]],
    )
  ).rows[0].id as string;
  expect(
    (await request('POST', `/votings/${f.active.id}/close`, {})).statusCode,
  ).toBe(200);
  let book = await workbook(f.event);
  const category = (b: ExcelJS.Workbook) =>
    b
      .getWorksheet('Kategorie')!
      .getRows(6, 2)!
      .find((r) => r.getCell(2).value === f.active.id)!;
  expect(category(book).getCell(5).value).toBe('Finální výsledek');
  expect(category(book).getCell(9).value).toBe(2);
  expect(
    (
      await request(
        'POST',
        `/votings/${f.active.id}/ballots/${ballotId}/unlock`,
        { expectedRevision: submitted.revision },
      )
    ).statusCode,
  ).toBe(200);
  book = await workbook(f.event);
  expect(category(book).getCell(5).value).toBe('Průběžný výsledek');
  expect(category(book).getCell(9).value).toBe(1);
  expect(
    (await request('POST', `/votings/${f.active.id}/reopen`, {})).statusCode,
  ).toBe(200);
  await wizard.submit(vToken, f.active.id, {
    expectedRevision: submitted.revision + 1,
    entries: [{ votingItemId: f.active.items[1]!, voteValue: 1 }],
  });
  expect(
    (await request('POST', `/votings/${f.active.id}/close`, {})).statusCode,
  ).toBe(200);
  book = await workbook(f.event);
  expect(category(book).getCell(9).value).toBe(2);
  expect(category(book).getCell(5).value).toBe('Průběžný výsledek');
  expect(category(book).getCell(13).value).toBe('Ano');
  const values = book
    .getWorksheet('Výsledky')!
    .getRows(6, 8)!
    .filter((r) => r.getCell(2).value === f.active.id)
    .map((r) => r.getCell(9).value);
  expect(values).toEqual([1, 1, 0, 0]);
});

it('accepts votes with a legacy past deadline because deadlines are explicitly excluded', async () => {
  const f = await fixture();
  await pool.query(
    "UPDATE votings SET deadline=now()-interval '1 day' WHERE id=$1",
    [f.active.id],
  );
  const saved = await wizard.submit(f.jurorToken, f.active.id, {
    expectedRevision: null,
    entries: [],
  });
  expect(saved.status).toBe('submitted');
  expect(
    (
      await request('PATCH', `/votings/${f.draft.id}`, {
        deadline: '2030-01-01T00:00:00Z',
      })
    ).statusCode,
  ).toBe(400);
});

it('exports names starting with spreadsheet operators as literal strings, preserving Unicode and multiline text', async () => {
  const f = await fixture();
  for (const [index, name] of [
    '=1+1',
    '+SUM(A1:A2)',
    '-1+1',
    '@SUM(A1:A2)',
  ].entries())
    await pool.query('UPDATE teams SET name=$2,description=$3 WHERE id=$1', [
      f.active.teams[index],
      name,
      'Čeština & <text>\nDruhý řádek',
    ]);
  await pool.query('UPDATE events SET name=$2 WHERE id=$1', [
    f.event,
    '=HYPERLINK("https://example.com")',
  ]);
  const book = await workbook(f.event);
  expect(book.worksheets[0]!.getCell('A2').type).toBe(ExcelJS.ValueType.String);
  const rows = book
    .getWorksheet('Výsledky')!
    .getRows(6, 8)!
    .filter((r) => r.getCell(2).value === f.active.id);
  expect(new Set(rows.map((r) => r.getCell(3).value))).toEqual(
    new Set(['=1+1', '+SUM(A1:A2)', '-1+1', '@SUM(A1:A2)']),
  );
  for (const row of rows) {
    expect(row.getCell(3).type).toBe(ExcelJS.ValueType.String);
    expect(row.getCell(6).value).toBe('Čeština & <text>\nDruhý řádek');
  }
  for (const ws of book.worksheets)
    ws.eachRow((row) =>
      row.eachCell((cell) => {
        expect(cell.type).not.toBe(ExcelJS.ValueType.Formula);
        expect(cell.type).not.toBe(ExcelJS.ValueType.Hyperlink);
      }),
    );
});

it('exports empty events with usable headers and protects the download route and strict event scope', async () => {
  const f = await fixture();
  const empty = (
    await pool.query("INSERT INTO events(name) VALUES ('Empty') RETURNING id")
  ).rows[0].id as string;
  const book = await workbook(empty);
  for (const ws of book.worksheets) expect(ws.rowCount).toBe(5);
  expect(
    (await request('GET', exportPath(f.event), undefined, '')).statusCode,
  ).toBe(401);
  expect(
    (await request('GET', exportPath(f.event), undefined, f.jurorToken))
      .statusCode,
  ).toBe(403);
  const revoked = await session();
  await auth.logout(revoked);
  expect(
    (await request('GET', exportPath(f.event), undefined, revoked)).statusCode,
  ).toBe(401);
  for (const suffix of [
    '',
    '?eventId=nope',
    `?eventId=${f.event}&jurorId=${f.jurors[0]}`,
    `?eventId=${f.event}&eventId=${empty}`,
  ])
    expect(
      (await request('GET', `/results/export.xlsx${suffix}`)).statusCode,
    ).toBe(400);
  expect((await request('GET', exportPath(randomUUID()))).statusCode).toBe(404);
  expect(JSON.stringify(book.model)).not.toContain(f.event);
});

it.each(['close', 'issue'] as const)(
  'rolls back %s and its audit if authorization is lost inside the transaction',
  async (action) => {
    const f = await fixture();
    const secret = await session();
    await pool.query(
      `CREATE FUNCTION phase12_revoke_actor() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_id='${f.event}'::uuid THEN UPDATE sessions SET revoked_at=statement_timestamp() WHERE token_hash='${secretHash(secret)}'; END IF; RETURN NEW; END; $$`,
    );
    await pool.query(
      'CREATE TRIGGER phase12_revoke_actor AFTER INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION phase12_revoke_actor()',
    );
    try {
      const path =
        action === 'close'
          ? `/votings/${f.active.id}/close`
          : `/events/${f.event}/jurors/${f.jurors[0]}/access`;
      expect((await request('POST', path, {}, secret)).statusCode).toBe(401);
      expect(
        (
          await pool.query('SELECT status FROM votings WHERE id=$1', [
            f.active.id,
          ])
        ).rows[0].status,
      ).toBe('active');
      expect(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM audit_logs WHERE event_id=$1',
            [f.event],
          )
        ).rows[0].n,
      ).toBe(0);
      expect(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM juror_access WHERE event_id=$1',
            [f.event],
          )
        ).rows[0].n,
      ).toBe(0);
      expect(await auth.readSession(secret)).not.toBeNull();
    } finally {
      await pool.query('DROP TRIGGER phase12_revoke_actor ON audit_logs');
      await pool.query('DROP FUNCTION phase12_revoke_actor()');
    }
  },
);

it('discards a fully generated workbook if authorization is lost after reading its snapshot', async () => {
  const f = await fixture();
  const secret = await session();
  let reads = 0;
  const expiringAuth = {
    ...auth,
    async readSession(
      value: string | undefined,
      connection?: Parameters<typeof auth.readSession>[1],
    ) {
      reads++;
      // Guard, post-lock authorization and end-of-snapshot authorization precede ZIP generation.
      if (reads === 4) await auth.logout(secret);
      return auth.readSession(value, connection);
    },
  };
  const isolated = buildApp({
    checkDatabase: async () => {},
    auth: {
      service: expiringAuth,
      origin,
      results: createResultsService(pool, expiringAuth),
    },
  });
  try {
    const response = await isolated.inject({
      url: exportPath(f.event),
      headers: { cookie: `d21-session=${secret}` },
    });
    expect(response.statusCode).toBe(401);
    expect(response.headers['content-disposition']).toBeUndefined();
    expect(response.headers['content-type']).toContain('application/json');
    expect(reads).toBe(4);
  } finally {
    await isolated.close();
  }
});

const blockedActions: Array<
  [string, (f: Fixture) => [Parameters<typeof request>[0], string, object?]]
> = [
  ['close', (f) => ['POST', `/votings/${f.active.id}/close`, {}]],
  ['reopen', (f) => ['POST', `/votings/${f.active.id}/reopen`, {}]],
  [
    'configure',
    (f) => [
      'PUT',
      `/votings/${f.draft.id}/configuration`,
      {
        selectedPlaces: 1,
        maxPlusVotes: 2,
        maxMinusVotes: 1,
        allowNegativeVotes: true,
      },
    ],
  ],
  [
    'create voting',
    (f) => [
      'POST',
      `/events/${f.event}/votings`,
      { name: 'New', instructions: '', kind: 'final' },
    ],
  ],
  [
    'correct team',
    (f) => [
      'PATCH',
      `/events/${f.event}/teams/${f.active.teams[0]}`,
      { name: 'Changed' },
    ],
  ],
  [
    'correct juror',
    (f) => [
      'PATCH',
      `/events/${f.event}/jurors/${f.jurors[0]}`,
      { displayName: 'Changed' },
    ],
  ],
  [
    'correct event',
    (f) => ['PATCH', `/events/${f.event}`, { name: 'Changed' }],
  ],
  ['read event', (f) => ['GET', `/events/${f.event}`]],
  ['read voting', (f) => ['GET', `/votings/${f.active.id}`]],
  ['read roster', (f) => ['GET', `/events/${f.event}/roster`]],
  ['read groups', (f) => ['GET', `/votings/${f.active.id}/allowed-groups`]],
  ['read items', (f) => ['GET', `/votings/${f.active.id}/items`]],
  ['read teams', (f) => ['GET', `/events/${f.event}/teams`]],
  [
    'issue link',
    (f) => ['POST', `/events/${f.event}/jurors/${f.jurors[0]}/access`, {}],
  ],
  [
    'revoke link',
    (f) => [
      'POST',
      `/events/${f.event}/jurors/${f.jurors[0]}/access/revoke`,
      {},
    ],
  ],
  [
    'link status',
    (f) => ['GET', `/events/${f.event}/jurors/${f.jurors[0]}/access`],
  ],
  ['export', (f) => ['GET', exportPath(f.event)]],
];
async function waitForLock() {
  const until = Date.now() + 3000;
  do {
    const waiting = await pool.query(
      "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT roster_locked_at%'",
    );
    if (waiting.rowCount) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  } while (Date.now() < until);
  throw new Error('Expected an actual event-lock wait');
}
it.each(blockedActions)(
  'rechecks revoked admin access after an actual event lock: %s',
  async (_name, action) => {
    const f = await fixture();
    const secret = await session();
    const blocker = await pool.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
        f.event,
      ]);
      const [method, path, payload] = action(f);
      const pending = Promise.resolve(request(method, path, payload, secret));
      await waitForLock();
      await auth.logout(secret);
      await blocker.query('COMMIT');
      const response = await pending;
      expect(response.statusCode).toBe(401);
      expect(response.headers['content-disposition']).toBeUndefined();
      expect(
        (await pool.query('SELECT name FROM events WHERE id=$1', [f.event]))
          .rows[0].name,
      ).toBe('Export event');
      expect(
        (
          await pool.query('SELECT status FROM votings WHERE id=$1', [
            f.active.id,
          ])
        ).rows[0].status,
      ).toBe('active');
      expect(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM audit_logs WHERE event_id=$1',
            [f.event],
          )
        ).rows[0].n,
      ).toBe(0);
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
  },
);
it.each(['close', 'export'] as const)(
  'uses statement time for expiry after a lock wait: %s',
  async (action) => {
    const f = await fixture();
    const secret = await session();
    const blocker = await pool.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
        f.event,
      ]);
      const pending = Promise.resolve(
        request(
          action === 'close' ? 'POST' : 'GET',
          action === 'close'
            ? `/votings/${f.active.id}/close`
            : exportPath(f.event),
          action === 'close' ? {} : undefined,
          secret,
        ),
      );
      await waitForLock();
      await pool.query(
        "UPDATE sessions SET expires_at=statement_timestamp()+interval '20 milliseconds' WHERE token_hash=$1",
        [secretHash(secret)],
      );
      await pool.query('SELECT pg_sleep(0.04)');
      await blocker.query('COMMIT');
      expect((await pending).statusCode).toBe(401);
      expect(
        (
          await pool.query('SELECT status FROM votings WHERE id=$1', [
            f.active.id,
          ])
        ).rows[0].status,
      ).toBe('active');
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
  },
);
