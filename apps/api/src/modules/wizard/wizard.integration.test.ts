import ExcelJS from 'exceljs';
import { createBallotAdminService } from '../ballots/admin';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  jurorStartResponseSchema,
  jurorListSchema,
  wizardCurrentSchema,
  wizardStepDetailSchema,
  wizardReviewSchema,
  wizardFinalSubmitSchema,
} from '@d21/contracts';
import { readEnvironment } from '../../config';
import { dropTestDatabase } from '../../db/test-database';
import { buildApp } from '../../app';
import { createAuthService, setAdminPassword } from '../auth/service';
import { randomBytes } from 'node:crypto';
import { createLinkVault } from '../auth/link-vault';
import { createJurorAccessService } from '../auth/juror-access';
import { createWizardService } from './service';
import { newSecret, secretHash } from '../auth/crypto';
import { createEventService } from '../events/service';
import { createVotingService } from '../votings/service';

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
const access = createJurorAccessService(
  pool,
  auth,
  createLinkVault(
    JSON.stringify({ test: randomBytes(32).toString('hex') }),
    'test',
  ),
);
let app: ReturnType<typeof buildApp>;
let cookie: string;
let created = false;
let requestNumber = 0;
const headers = { 'x-d21-request': '1', origin: 'http://127.0.0.1:5173' };
function request(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  payload?: object,
  session = cookie,
  extra: Record<string, string> = headers,
) {
  return app.inject({
    method,
    remoteAddress: `10.0.${Math.floor(++requestNumber / 250)}.${(requestNumber % 250) + 1}`,
    url: path,
    payload,
    headers: { ...extra, ...(session ? { cookie: session } : {}) },
  });
}
const sessionCookie = (response: { headers: Record<string, unknown> }) =>
  String(response.headers['set-cookie']).split(';')[0]!;
async function fixture() {
  const event = (
    await pool.query(
      "INSERT INTO events(name) VALUES ('Private event') RETURNING id",
    )
  ).rows[0].id as string;
  const groups: string[] = [];
  const jurors: string[] = [];
  for (const code of ['T', 'V']) {
    const group = (
      await pool.query(
        'INSERT INTO jury_groups(event_id,code,name) VALUES ($1,$2::jury_group_code,$2::text) RETURNING id',
        [event, code],
      )
    ).rows[0].id;
    groups.push(group);
    jurors.push(
      (
        await pool.query(
          "INSERT INTO event_jurors(event_id,jury_group_id,display_name) VALUES ($1,$2,'Same Name') RETURNING id",
          [event, group],
        )
      ).rows[0].id,
    );
  }
  async function voting(kind = 'final', status = 'active', allowed = groups) {
    const id = (
      await pool.query(
        "INSERT INTO votings(event_id,name,kind,status,selected_places,max_plus_votes,max_minus_votes,allow_negative_votes) VALUES ($1,'Category',$2::voting_kind,$3::voting_status,1,2,1,true) RETURNING id",
        [event, kind, status],
      )
    ).rows[0].id as string;
    for (const group of allowed)
      await pool.query(
        'INSERT INTO voting_allowed_groups(event_id,voting_id,jury_group_id) VALUES ($1,$2,$3)',
        [event, id, group],
      );
    return id;
  }
  const t = await voting('final', 'active', [groups[0]!]);
  const v = await voting('final', 'active', [groups[1]!]);
  const both = await voting('selection');
  const closed = await voting('final', 'closed');
  const archived = await voting('final', 'archived');
  const draft = await voting('selection', 'draft');
  const team = (
    await pool.query(
      "INSERT INTO teams(event_id,name,description) VALUES ($1,'Team','Description') RETURNING id",
      [event],
    )
  ).rows[0].id;
  await pool.query(
    "INSERT INTO voting_items(event_id,voting_id,team_id,name,description,display_order) VALUES ($1,$2,$3,'Snapshot','Old',0)",
    [event, t, team],
  );
  const path = `/events/${event}/jurors/${jurors[0]}/access`;
  return {
    event,
    groups: groups as [string, string],
    jurors: jurors as [string, string],
    t,
    v,
    both,
    closed,
    archived,
    draft,
    path,
    team,
  };
}
async function issue(event: string, juror: string) {
  const result = await request(
    'POST',
    `/events/${event}/jurors/${juror}/access`,
    {},
  );
  expect(result.statusCode).toBe(200);
  const params = new URLSearchParams(new URL(result.json().url).hash.slice(1));
  return { eventId: params.get('event')!, token: params.get('key')! };
}
async function enter(link: { eventId: string; token: string }, previous = '') {
  return request('POST', '/auth/juror/start', link, previous);
}
beforeAll(async () => {
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await migrate(drizzle(pool), {
    migrationsFolder: fileURLToPath(
      new URL('../../db/migrations', import.meta.url),
    ),
  });
  await setAdminPassword(pool, 'Disposable Phase Five password');
  app = buildApp({
    checkDatabase: async () => {},
    auth: {
      service: auth,
      origin: headers.origin,
      jurorAccess: access,
      wizard: createWizardService(pool, auth),
      ballotAdmin: createBallotAdminService(pool, auth),
      events: createEventService(
        pool,
        auth,
        createLinkVault(
          JSON.stringify({ test: randomBytes(32).toString('hex') }),
          'test',
        ),
      ),
      votings: createVotingService(pool, auth),
    },
  });
  const login = await request(
    'POST',
    '/auth/admin/login',
    { password: 'Disposable Phase Five password' },
    '',
  );
  cookie = sessionCookie(login);
}, 30000);
afterAll(async () => {
  await app?.close();
  await pool.end();
  if (created) await dropTestDatabase(admin, name);
  await admin.end();
});

describe('juror access and wizard', () => {
  it('issues fragment-only links and returns no secret in status', async () => {
    const f = await fixture();
    expect((await request('GET', f.path)).json()).toEqual({ issued: false });
    const link = await issue(f.event, f.jurors[0]);
    const stored = await pool.query(
      'SELECT token_hash FROM juror_access WHERE event_id=$1',
      [f.event],
    );
    expect(stored.rows[0].token_hash).toBe(secretHash(link.token));
    const result = await request('GET', f.path);
    expect(result.json()).toEqual({ issued: true });
    expect(result.body).not.toContain(link.token);
    expect(result.headers['cache-control']).toBe('no-store');
  });
  it('creates an HttpOnly untimed session and restores it beyond 12 hours', async () => {
    const f = await fixture();
    const result = await enter(await issue(f.event, f.jurors[0]));
    expect(result.statusCode).toBe(200);
    const body = jurorStartResponseSchema.parse(result.json());
    expect(body.session.principal.id).toBe(f.jurors[0]);
    expect(body.session.expiresAt).toBeNull();
    expect(String(result.headers['set-cookie'])).not.toMatch(
      /Max-Age|Expires=/,
    );
    await pool.query(
      "UPDATE sessions SET created_at=now()-interval '30 days' WHERE token_hash=$1",
      [secretHash(sessionCookie(result).split('=')[1]!)],
    );
    expect(String(result.headers['set-cookie'])).toMatch(
      /HttpOnly.*SameSite=Strict/,
    );
    expect(
      (
        await request('GET', '/auth/session', undefined, sessionCookie(result))
      ).json(),
    ).toEqual(body.session);
  });
  it('restores an untimed session through a new pool, service and application instance', async () => {
    const f = await fixture();
    const session = sessionCookie(
      await enter(await issue(f.event, f.jurors[0])),
    );
    await pool.query(
      "UPDATE sessions SET created_at=now()-interval '60 days' WHERE token_hash=$1",
      [secretHash(session.split('=')[1]!)],
    );
    const restartedPool = new pg.Pool({
      connectionString: url.toString(),
      max: 2,
    });
    const restartedAuth = createAuthService(restartedPool);
    const restarted = buildApp({
      checkDatabase: async () => {},
      auth: {
        service: restartedAuth,
        origin: headers.origin,
        wizard: createWizardService(restartedPool, restartedAuth),
      },
    });
    try {
      const restored = await restarted.inject({
        url: '/wizard/current',
        headers: { cookie: session },
      });
      expect(restored.statusCode).toBe(200);
      expect(restored.json().expiresAt).toBeNull();
      expect(restored.json().principal.id).toBe(f.jurors[0]);
    } finally {
      await restarted.close();
      await restartedPool.end();
    }
  });
  it('exports all jurors with clickable reusable links, literal names and no access/session writes', async () => {
    const f = await fixture();
    const link = await issue(f.event, f.jurors[0]);
    const session = sessionCookie(await enter(link));
    await pool.query('UPDATE event_jurors SET display_name=$2 WHERE id=$1', [
      f.jurors[0],
      '=1+1',
    ]);
    const snapshot = async () =>
      Promise.all(
        [
          'juror_access',
          'sessions',
          'audit_logs',
          'ballots',
          'ballot_entries',
        ].map(
          async (table) =>
            (
              await pool.query(
                `SELECT row_to_json(t)::text FROM ${table} t WHERE event_id=$1 ORDER BY row_to_json(t)::text`,
                [f.event],
              )
            ).rows,
        ),
      );
    const before = await snapshot();
    for (let i = 0; i < 2; i++) {
      const response = await request(
        'POST',
        `/events/${f.event}/jurors/links.xlsx`,
        {},
      );
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['content-disposition']).toContain(
        `d21-jurors-${f.event}.xlsx`,
      );
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(response.rawPayload as unknown as ExcelJS.Buffer);
      const sheet = book.worksheets[0]!;
      expect(sheet.rowCount).toBe(7);
      const row = [sheet.getRow(6), sheet.getRow(7)].find(
        (row) => row.getCell(6).value === f.jurors[0],
      )!;
      expect(row.getCell(1).value).toBe('=1+1');
      expect(row.getCell(1).type).toBe(ExcelJS.ValueType.String);
      expect(row.getCell(2).value).toBe('Technická');
      expect(row.getCell(4).type).toBe(ExcelJS.ValueType.Hyperlink);
      const expected = `${headers.origin}/#event=${f.event}&key=${link.token}`;
      expect(row.getCell(4).hyperlink === expected).toBe(true);
      const missing = [sheet.getRow(6), sheet.getRow(7)].find(
        (row) => row.getCell(6).value === f.jurors[1],
      )!;
      expect(missing.getCell(4).text).toBe('');
      expect(missing.getCell(5).text).toContain('dosud nebyl');
    }
    expect(await snapshot()).toEqual(before);
    expect(
      (await request('GET', '/wizard/current', undefined, session)).statusCode,
    ).toBe(200);
    expect((await enter(link)).statusCode).toBe(200);
    const g = await fixture();
    const isolated = await request(
      'POST',
      `/events/${g.event}/jurors/links.xlsx`,
      {},
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(isolated.rawPayload as unknown as ExcelJS.Buffer);
    expect(JSON.stringify(book.model).includes(link.token)).toBe(false);
  });
  it('labels legacy/revoked links, rejects unavailable decryption and never replaces credentials during export', async () => {
    const f = await fixture();
    const legacy = newSecret();
    await pool.query(
      'INSERT INTO juror_access(token_hash,event_id,juror_id) VALUES ($1,$2,$3)',
      [secretHash(legacy), f.event, f.jurors[0]],
    );
    await issue(f.event, f.jurors[1]);
    await access.revoke(cookie.split('=')[1]!, f.event, f.jurors[1]);
    const response = await request(
      'POST',
      `/events/${f.event}/jurors/links.xlsx`,
      {},
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(response.rawPayload as unknown as ExcelJS.Buffer);
    const rows = [book.worksheets[0]!.getRow(6), book.worksheets[0]!.getRow(7)];
    expect(rows.every((row) => row.getCell(4).text === '')).toBe(true);
    expect(
      rows
        .map((row) => row.getCell(5).text)
        .some((value) => value.includes('Starší')),
    ).toBe(true);
    expect(
      rows
        .map((row) => row.getCell(5).text)
        .some((value) => value.includes('zrušen')),
    ).toBe(true);
    expect((await enter({ eventId: f.event, token: legacy })).statusCode).toBe(
      200,
    );
    await issue(f.event, f.jurors[0]);
    const unavailable = createJurorAccessService(pool, auth);
    await expect(
      unavailable.exportWorkbook(
        cookie.split('=')[1]!,
        f.event,
        headers.origin,
      ),
    ).rejects.toMatchObject({ code: 'LINK_STORAGE_UNAVAILABLE' });
    await pool.query(
      "UPDATE juror_access SET encrypted_token='v1.missing.invalid.invalid.invalid' WHERE event_id=$1 AND revoked_at IS NULL",
      [f.event],
    );
    const broken = await request(
      'POST',
      `/events/${f.event}/jurors/links.xlsx`,
      {},
    );
    expect(broken.statusCode).toBe(503);
    expect(broken.json().error.code).toBe('LINK_STORAGE_UNAVAILABLE');
    expect(broken.headers['content-disposition']).toBeUndefined();
    expect(broken.body.includes('#event=')).toBe(false);
  });
  it('protects juror link exports with admin, strict input and origin guards', async () => {
    const f = await fixture();
    const session = sessionCookie(
      await enter(await issue(f.event, f.jurors[0])),
    );
    const path = `/events/${f.event}/jurors/links.xlsx`;
    expect((await request('POST', path, {}, '')).statusCode).toBe(401);
    expect((await request('POST', path, {}, session)).statusCode).toBe(403);
    expect((await request('POST', path, {}, cookie, {})).statusCode).toBe(403);
    expect(
      (
        await request('POST', path, {}, cookie, {
          ...headers,
          origin: 'https://foreign.example',
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await request('POST', path, { jurorIds: f.jurors })).statusCode,
    ).toBe(400);
    expect(
      (await request('POST', `${path}?eventId=${f.event}`, {})).statusCode,
    ).toBe(400);
    expect(
      (await request('POST', `/events/${randomUUID()}/jurors/links.xlsx`, {}))
        .statusCode,
    ).toBe(404);
    expect((await request('GET', path)).statusCode).toBe(404);
  });
  it('repeated copying returns the same active link without writes, session invalidation or metadata leaks', async () => {
    const f = await fixture();
    const link = await issue(f.event, f.jurors[0]);
    const session = sessionCookie(await enter(link));
    await pool.query(
      `INSERT INTO ballots(event_id,voting_id,juror_id,status,submitted_at)
      VALUES ($1,$2,$3,'submitted',now())`,
      [f.event, f.t, f.jurors[0]],
    );
    await pool.query(
      `INSERT INTO ballot_entries(event_id,voting_id,ballot_id,voting_item_id,vote_value)
      SELECT $1,$2,b.id,i.id,1 FROM ballots b JOIN voting_items i ON i.voting_id=b.voting_id WHERE b.voting_id=$2`,
      [f.event, f.t],
    );
    await pool.query(
      `INSERT INTO audit_logs(event_id,actor_juror_id,action,target_type,target_id,context)
      SELECT $1,$2,'ballot.submitted','ballot',id,'{"original":true}'::jsonb FROM ballots WHERE voting_id=$3`,
      [f.event, f.jurors[0], f.t],
    );
    const snapshot = async () => {
      const tables = [
        'juror_access',
        'sessions',
        'ballots',
        'ballot_entries',
        'audit_logs',
      ];
      return Promise.all(
        tables.map(
          async (table) =>
            (
              await pool.query(
                `SELECT row_to_json(t) AS value FROM ${table} t WHERE event_id=$1 ORDER BY row_to_json(t)::text`,
                [f.event],
              )
            ).rows,
        ),
      );
    };
    const before = await snapshot();
    for (let i = 0; i < 3; i++) {
      const result = await request('POST', `${f.path}/copy`, {});
      expect(result.statusCode).toBe(200);
      expect(result.json().url).toBe(
        `${headers.origin}/#event=${f.event}&key=${link.token}`,
      );
      expect(result.headers['cache-control']).toBe('no-store');
      expect(result.headers['referrer-policy']).toBe('no-referrer');
      expect(
        (await request('GET', '/wizard/current', undefined, session))
          .statusCode,
      ).toBe(200);
    }
    expect(await snapshot()).toEqual(before);
    const row = (
      await pool.query('SELECT * FROM juror_access WHERE token_hash=$1', [
        secretHash(link.token),
      ])
    ).rows[0];
    expect(row.encrypted_token).toMatch(/^v1.test\./);
    expect(JSON.stringify(row)).not.toContain(link.token);
    const list = await request('GET', `/events/${f.event}/jurors`);
    expect(jurorListSchema.parse(list.json())).toHaveLength(2);
    const roster = await request('GET', `/events/${f.event}/roster`);
    expect(
      roster.json().jurors.find((j: { id: string }) => j.id === f.jurors[0])
        .access,
    ).toBe('stored');
    for (const path of [
      f.path,
      `/events/${f.event}/roster`,
      `/events/${f.event}/jurors`,
      '/wizard/current',
    ]) {
      const result = await request(
        'GET',
        path,
        undefined,
        path.startsWith('/wizard') ? session : cookie,
      );
      expect(result.body).not.toContain(link.token);
      expect(result.body).not.toContain(row.encrypted_token);
    }
  });
  it('retains legacy hash-only links until explicit replacement enables copying', async () => {
    const f = await fixture();
    const token = newSecret();
    await pool.query(
      'INSERT INTO juror_access(token_hash,event_id,juror_id) VALUES ($1,$2,$3)',
      [secretHash(token), f.event, f.jurors[0]],
    );
    const link = { eventId: f.event, token };
    const session = sessionCookie(await enter(link));
    expect(
      (await request('POST', `${f.path}/copy`, {})).json().error.code,
    ).toBe('LEGACY_LINK');
    expect(
      (await request('GET', `/events/${f.event}/roster`))
        .json()
        .jurors.find((j: { id: string }) => j.id === f.jurors[0]).access,
    ).toBe('legacy');
    expect((await enter(link)).statusCode).toBe(200);
    expect(
      (await request('GET', '/wizard/current', undefined, session)).statusCode,
    ).toBe(200);
    const next = await issue(f.event, f.jurors[0]);
    expect((await enter(link)).statusCode).toBe(401);
    expect(
      (await request('GET', '/wizard/current', undefined, session)).statusCode,
    ).toBe(401);
    expect((await request('POST', `${f.path}/copy`, {})).json().url).toContain(
      next.token,
    );
  });
  it('fails safely without keys and never replaces access on a failed generation', async () => {
    const f = await fixture();
    const link = await issue(f.event, f.jurors[0]);
    const session = sessionCookie(await enter(link));
    const unavailable = createJurorAccessService(pool, auth);
    const adminToken = cookie.split('=')[1]!;
    await expect(
      unavailable.copy(adminToken, f.event, f.jurors[0]),
    ).rejects.toMatchObject({ code: 'LINK_STORAGE_UNAVAILABLE' });
    await expect(
      unavailable.issue(adminToken, f.event, f.jurors[0]),
    ).rejects.toMatchObject({ code: 'LINK_STORAGE_UNAVAILABLE' });
    expect((await request('POST', `${f.path}/copy`, {})).json().url).toContain(
      link.token,
    );
    expect((await enter(link)).statusCode).toBe(200);
    expect(
      (await request('GET', '/wizard/current', undefined, session)).statusCode,
    ).toBe(200);
    await unavailable.revoke(adminToken, f.event, f.jurors[0]);
    expect((await enter(link)).statusCode).toBe(401);
    expect(
      (await request('POST', `${f.path}/copy`, {})).json().error.code,
    ).toBe('NO_ACTIVE_LINK');
  });
  it('protects secret retrieval with admin, origin, strict claims and event/juror checks', async () => {
    const f = await fixture();
    const session = sessionCookie(
      await enter(await issue(f.event, f.jurors[0])),
    );
    for (const [s, status] of [
      ['', 401],
      [session, 403],
      ['d21-session=' + newSecret(), 401],
    ] as const)
      expect((await request('POST', `${f.path}/copy`, {}, s)).statusCode).toBe(
        status,
      );
    for (const invalid of [
      {},
      { ...headers, origin: 'https://attacker.test' },
      { ...headers, 'sec-fetch-site': 'cross-site' },
    ])
      expect(
        (await request('POST', `${f.path}/copy`, {}, cookie, invalid))
          .statusCode,
      ).toBe(403);
    for (const payload of [{ jurorId: f.jurors[1] }, { token: newSecret() }])
      expect(
        (await request('POST', `${f.path}/copy`, payload)).statusCode,
      ).toBe(400);
    expect(
      (await request('POST', `${f.path}/copy?eventId=${f.event}`, {}))
        .statusCode,
    ).toBe(400);
    expect((await request('GET', `${f.path}/copy`)).statusCode).toBe(404);
    const g = await fixture();
    expect(
      (
        await request(
          'POST',
          `/events/${g.event}/jurors/${f.jurors[0]}/access/copy`,
          {},
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await request(
          'POST',
          `/events/${f.event}/jurors/${f.jurors[1]}/access/copy`,
          {},
        )
      ).json().error.code,
    ).toBe('NO_ACTIVE_LINK');
  });
  it.each(['copy', 'export'])(
    'rechecks admin revocation after a real lock wait before decrypting links (%s)',
    async (action) => {
      const f = await fixture();
      await issue(f.event, f.jurors[0]);
      const login = await request(
        'POST',
        '/auth/admin/login',
        { password: 'Disposable Phase Five password' },
        '',
      );
      const ownCookie = sessionCookie(login);
      const client = await pool.connect();
      await client.query('BEGIN');
      await client.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
        f.event,
      ]);
      const pending = Promise.resolve(
        request(
          'POST',
          action === 'copy'
            ? `${f.path}/copy`
            : `/events/${f.event}/jurors/links.xlsx`,
          {},
          ownCookie,
        ),
      );
      try {
        const until = Date.now() + 3000;
        let waiting = false;
        while (Date.now() < until) {
          waiting = Boolean(
            (
              await pool.query(
                "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%roster_locked_at%'",
              )
            ).rowCount,
          );
          if (waiting) break;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(waiting).toBe(true);
        await pool.query(
          'UPDATE sessions SET revoked_at=now() WHERE token_hash=$1',
          [secretHash(ownCookie.split('=')[1]!)],
        );
        await client.query('COMMIT');
        const result = await pending;
        expect(result.statusCode).toBe(401);
        expect(result.body).not.toContain('#event=');
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    },
  );
  it('allows reusable old links, multiple devices, logout and recovery without expiring the link', async () => {
    const f = await fixture();
    const link = await issue(f.event, f.jurors[0]);
    await pool.query(
      "UPDATE juror_access SET created_at=now()-interval '10 years' WHERE token_hash=$1",
      [secretHash(link.token)],
    );
    const a = sessionCookie(await enter(link));
    const b = sessionCookie(await enter(link));
    expect(
      (await request('GET', '/wizard/current', undefined, a)).statusCode,
    ).toBe(200);
    expect((await request('POST', '/auth/logout', {}, a)).statusCode).toBe(204);
    expect(
      (await request('GET', '/wizard/current', undefined, a)).statusCode,
    ).toBe(401);
    expect(
      (await request('GET', '/wizard/current', undefined, b)).statusCode,
    ).toBe(200);
    expect((await enter(link)).statusCode).toBe(200);
  });
  it('rotates the prior browser session at redemption', async () => {
    const f = await fixture();
    const link = await issue(f.event, f.jurors[0]);
    const a = sessionCookie(await enter(link));
    const b = sessionCookie(await enter(link, a));
    expect(a).not.toBe(b);
    expect(
      (await request('GET', '/wizard/current', undefined, a)).statusCode,
    ).toBe(401);
    expect(
      (await request('GET', '/wizard/current', undefined, b)).statusCode,
    ).toBe(200);
  });
  it('regeneration revokes every previous link and juror session without touching another juror', async () => {
    const f = await fixture();
    const old = await issue(f.event, f.jurors[0]);
    const a = sessionCookie(await enter(old));
    const b = sessionCookie(await enter(old));
    const other = sessionCookie(await enter(await issue(f.event, f.jurors[1])));
    const next = await issue(f.event, f.jurors[0]);
    expect((await enter(old)).statusCode).toBe(401);
    for (const s of [a, b])
      expect(
        (await request('GET', '/wizard/current', undefined, s)).statusCode,
      ).toBe(401);
    expect(
      (await request('GET', '/wizard/current', undefined, other)).statusCode,
    ).toBe(200);
    expect((await enter(next)).statusCode).toBe(200);
  });
  it('revocation is idempotent and permits recovery only with a newly issued link', async () => {
    const f = await fixture();
    const link = await issue(f.event, f.jurors[0]);
    const s = sessionCookie(await enter(link));
    for (let n = 0; n < 2; n++)
      expect((await request('POST', `${f.path}/revoke`, {})).statusCode).toBe(
        204,
      );
    expect((await request('GET', f.path)).json()).toEqual({ issued: false });
    expect((await enter(link)).statusCode).toBe(401);
    expect(
      (await request('GET', '/wizard/current', undefined, s)).statusCode,
    ).toBe(401);
    expect((await enter(await issue(f.event, f.jurors[0]))).statusCode).toBe(
      200,
    );
  });
  it('rejects a legacy timed session that expired without consuming the reusable link', async () => {
    const f = await fixture();
    const link = await issue(f.event, f.jurors[0]);
    const s = sessionCookie(await enter(link));
    await pool.query(
      "UPDATE sessions SET created_at=now()-interval '13 hours',expires_at=now()-interval '1 hour' WHERE token_hash=$1",
      [secretHash(s.split('=')[1]!)],
    );
    expect(
      (await request('GET', '/wizard/current', undefined, s)).statusCode,
    ).toBe(401);
    expect((await enter(link)).statusCode).toBe(200);
  });
  it('keeps duplicate names and events isolated, rejects wrong-event and invalid secrets', async () => {
    const f = await fixture(),
      g = await fixture();
    const link = await issue(f.event, f.jurors[0]);
    expect((await enter({ ...link, eventId: g.event })).statusCode).toBe(401);
    expect((await enter({ ...link, token: newSecret() })).statusCode).toBe(401);
    const t = jurorStartResponseSchema.parse((await enter(link)).json());
    const v = jurorStartResponseSchema.parse(
      (await enter(await issue(f.event, f.jurors[1]))).json(),
    );
    expect(t.session.principal.displayName).toBe(
      v.session.principal.displayName,
    );
    expect(t.session.principal.id).not.toBe(v.session.principal.id);
    expect(
      (
        await request(
          'POST',
          `/events/${g.event}/jurors/${f.jurors[0]}/access`,
          {},
        )
      ).statusCode,
    ).toBe(404);
  });
  it('derives T/V steps on the server, hides drafts, keeps unavailable steps and stable order', async () => {
    const f = await fixture();
    for (const [n, allowed, forbidden] of [
      [0, f.t, f.v],
      [1, f.v, f.t],
    ] as const) {
      const s = sessionCookie(await enter(await issue(f.event, f.jurors[n])));
      const body = wizardCurrentSchema.parse(
        (await request('GET', '/wizard/current', undefined, s)).json(),
      );
      expect(body.steps.map((x) => x.id)).toEqual([
        f.both,
        allowed,
        f.closed,
        f.archived,
      ]);
      expect(body.steps.some((x) => [forbidden, f.draft].includes(x.id))).toBe(
        false,
      );
      expect(
        (await request('GET', '/wizard/steps', undefined, s)).json(),
      ).toEqual(body.steps);
      expect(
        (await request('GET', `/wizard/steps/${forbidden}`, undefined, s))
          .statusCode,
      ).toBe(404);
      expect(
        (await request('GET', `/wizard/steps/${f.draft}`, undefined, s))
          .statusCode,
      ).toBe(404);
      expect(
        (await request('GET', `/wizard/steps/${f.closed}`, undefined, s))
          .statusCode,
      ).toBe(200);
    }
  });
  it('denies foreign and unknown step IDs and rejects browser ownership/group claims', async () => {
    const f = await fixture(),
      g = await fixture();
    const s = sessionCookie(await enter(await issue(f.event, f.jurors[0])));
    for (const id of [g.t, randomUUID()])
      expect(
        (await request('GET', `/wizard/steps/${id}`, undefined, s)).statusCode,
      ).toBe(404);
    expect(
      (
        await request(
          'GET',
          `/wizard/current?eventId=${g.event}&juryGroupId=${g.groups[0]}`,
          undefined,
          s,
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (await request('GET', '/wizard/steps/not-a-uuid', undefined, s))
        .statusCode,
    ).toBe(400);
    const forged = await request(
      'POST',
      '/auth/juror/start',
      {
        ...(await issue(f.event, f.jurors[0])),
        jurorId: f.jurors[1],
        juryGroupId: f.groups[1],
      },
      '',
    );
    expect(forged.statusCode).toBe(400);
  });
  it('returns current corrected names, linked teams and stable entry IDs/order without writing ballots', async () => {
    const f = await fixture();
    const s = sessionCookie(await enter(await issue(f.event, f.jurors[0])));
    await pool.query(
      "UPDATE event_jurors SET display_name='Corrected' WHERE id=$1",
      [f.jurors[0]],
    );
    await pool.query("UPDATE teams SET name='Corrected team' WHERE id=$1", [
      f.team,
    ]);
    const response = await request('GET', `/wizard/steps/${f.t}`, undefined, s);
    const detail = wizardStepDetailSchema.parse(response.json());
    expect(detail.current.principal.displayName).toBe('Corrected');
    expect(detail.items[0]!.name).toBe('Corrected team');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(
      (
        await pool.query('SELECT count(*) FROM ballots WHERE event_id=$1', [
          f.event,
        ])
      ).rows[0].count,
    ).toBe('0');
  });
  it('restores a deterministic step by URL after closure/reopening and reports current status', async () => {
    const f = await fixture();
    const s = sessionCookie(await enter(await issue(f.event, f.jurors[0])));
    const before = (await request('GET', '/wizard/steps', undefined, s)).json();
    expect(
      (await request('POST', `/votings/${f.t}/close`, {})).statusCode,
    ).toBe(200);
    expect(
      (await request('GET', `/wizard/steps/${f.t}`, undefined, s)).json().step
        .status,
    ).toBe('closed');
    expect(
      (await request('POST', `/votings/${f.t}/reopen`, {})).statusCode,
    ).toBe(200);
    expect(
      (await request('GET', '/wizard/steps', undefined, s)).json(),
    ).toEqual(before);
  });
  it('uses creation time then UUID to break order ties, without using names', async () => {
    const f = await fixture();
    await pool.query(
      "UPDATE votings SET created_at='2026-01-01' WHERE event_id=$1",
      [f.event],
    );
    const s = sessionCookie(await enter(await issue(f.event, f.jurors[0])));
    expect(
      (await request('GET', '/wizard/steps', undefined, s))
        .json()
        .map((x: { id: string }) => x.id),
    ).toEqual([f.both, ...[f.t, f.closed, f.archived].sort()]);
  });
  it('returns an honest empty authorized list', async () => {
    const f = await fixture();
    await pool.query('DELETE FROM voting_allowed_groups WHERE event_id=$1', [
      f.event,
    ]);
    const s = sessionCookie(await enter(await issue(f.event, f.jurors[0])));
    expect(
      (await request('GET', '/wizard/current', undefined, s)).json().steps,
    ).toEqual([]);
  });
  it('guards every link operation against anonymous and juror sessions and wrong origins', async () => {
    const f = await fixture();
    const juror = sessionCookie(await enter(await issue(f.event, f.jurors[0])));
    for (const [method, path, payload] of [
      ['GET', f.path, undefined],
      ['POST', f.path, {}],
      ['POST', `${f.path}/revoke`, {}],
    ] as const) {
      expect((await request(method, path, payload, '')).statusCode).toBe(401);
      expect((await request(method, path, payload, juror)).statusCode).toBe(
        403,
      );
      if (method === 'POST') {
        expect(
          (await request(method, path, payload, cookie, {})).statusCode,
        ).toBe(403);
        expect(
          (
            await request(method, path, payload, cookie, {
              ...headers,
              origin: 'https://untrusted.test',
            })
          ).statusCode,
        ).toBe(403);
        expect(
          (await request(method, path, { unexpected: true })).statusCode,
        ).toBe(400);
      }
    }
  });
  it('guards wizard routes against anonymous, fabricated, expired, revoked and admin sessions', async () => {
    const f = await fixture();
    const paths = ['/wizard/current', '/wizard/steps', `/wizard/steps/${f.t}`];
    const revoked = sessionCookie(
      await enter(await issue(f.event, f.jurors[0])),
    );
    await request('POST', '/auth/logout', {}, revoked);
    for (const path of paths) {
      for (const s of ['', `d21-session=${newSecret()}`, revoked])
        expect((await request('GET', path, undefined, s)).statusCode).toBe(401);
      expect((await request('GET', path)).statusCode).toBe(403);
    }
  });
  it('rejects mutation origins on public redemption and unsupported methods', async () => {
    const f = await fixture();
    const link = await issue(f.event, f.jurors[0]);
    expect(
      (await request('POST', '/auth/juror/start', link, '', {})).statusCode,
    ).toBe(403);
    expect(
      (
        await request('POST', '/auth/juror/start', link, '', {
          ...headers,
          origin: 'https://untrusted.test',
        })
      ).statusCode,
    ).toBe(403);
    for (const path of ['/wizard/review', `/wizard/steps/${f.t}/ballot-draft`])
      expect((await request('POST', path, {})).statusCode).toBe(404);
  });
  it('serializes redemption with revocation and preserves the sticky roster marker and voting data', async () => {
    const f = await fixture();
    const link = await issue(f.event, f.jurors[0]);
    const before = (
      await pool.query('SELECT roster_locked_at FROM events WHERE id=$1', [
        f.event,
      ])
    ).rows[0];
    const client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
      f.event,
    ]);
    let settled = false;
    const starting = enter(link).then((r) => {
      settled = true;
      return r;
    });
    try {
      const until = Date.now() + 3000;
      let waiting = false;
      while (Date.now() < until) {
        waiting = Boolean(
          (
            await pool.query(
              "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%roster_locked_at%'",
            )
          ).rowCount,
        );
        if (waiting) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
      expect(settled).toBe(false);
      await client.query(
        'UPDATE juror_access SET revoked_at=now() WHERE event_id=$1',
        [f.event],
      );
      await client.query('COMMIT');
      expect((await starting).statusCode).toBe(401);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    expect(
      (
        await pool.query('SELECT roster_locked_at FROM events WHERE id=$1', [
          f.event,
        ])
      ).rows[0],
    ).toEqual(before);
    expect(
      (
        await pool.query('SELECT count(*) FROM votings WHERE event_id=$1', [
          f.event,
        ])
      ).rows[0].count,
    ).toBe('6');
  });
  it('concurrent issue requests leave exactly one valid link', async () => {
    const f = await fixture();
    const links = await Promise.all([
      issue(f.event, f.jurors[0]),
      issue(f.event, f.jurors[0]),
    ]);
    const rows = await pool.query(
      'SELECT token_hash FROM juror_access WHERE event_id=$1 AND revoked_at IS NULL',
      [f.event],
    );
    expect(rows.rowCount).toBe(1);
    for (const link of links)
      expect((await enter(link)).statusCode).toBe(
        rows.rows[0].token_hash === secretHash(link.token) ? 200 : 401,
      );
  });
  it('rechecks the current database membership rather than retaining an old group claim', async () => {
    const f = await fixture();
    const s = sessionCookie(await enter(await issue(f.event, f.jurors[0])));
    // Direct fixture intervention; the public roster API still enforces its freeze.
    await pool.query('UPDATE event_jurors SET jury_group_id=$2 WHERE id=$1', [
      f.jurors[0],
      f.groups[1],
    ]);
    const current = wizardCurrentSchema.parse(
      (await request('GET', '/wizard/current', undefined, s)).json(),
    );
    expect(current.group.id).toBe(f.groups[1]);
    expect(current.steps.some((step) => step.id === f.t)).toBe(false);
    expect(current.steps.some((step) => step.id === f.v)).toBe(true);
  });
  it('checks actual session expiry again after waiting for the event lock', async () => {
    const f = await fixture();
    const s = sessionCookie(await enter(await issue(f.event, f.jurors[0])));
    const client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
      f.event,
    ]);
    await pool.query(
      "UPDATE sessions SET expires_at=statement_timestamp()+interval '500 milliseconds' WHERE token_hash=$1",
      [secretHash(s.split('=')[1]!)],
    );
    const pending = request('GET', '/wizard/current', undefined, s);
    // Fastify injection begins when its thenable is consumed.
    const running = Promise.resolve(pending);
    try {
      let waiting = false;
      const until = Date.now() + 3000;
      while (Date.now() < until) {
        waiting = Boolean(
          (
            await pool.query(
              "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%roster_locked_at%'",
            )
          ).rowCount,
        );
        if (waiting) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 700));
      await client.query('COMMIT');
      expect((await running).statusCode).toBe(401);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
  it('bounds public redemption attempts', async () => {
    const limited = buildApp({
      checkDatabase: async () => {},
      auth: {
        service: auth,
        origin: headers.origin,
        jurorAccess: access,
        wizard: createWizardService(pool, auth),
        ballotAdmin: createBallotAdminService(pool, auth),
      },
    });
    try {
      for (let i = 0; i < 21; i++) {
        const result = await limited.inject({
          method: 'POST',
          url: '/auth/juror/start',
          headers,
          payload: { eventId: randomUUID(), token: newSecret() },
        });
        expect(result.statusCode).toBe(i < 20 ? 401 : 429);
      }
    } finally {
      await limited.close();
    }
  });
});

async function interactionFixture() {
  const f = await fixture();
  await pool.query(
    'UPDATE votings SET max_plus_votes=4,max_minus_votes=2 WHERE id=$1',
    [f.t],
  );
  for (let n = 1; n < 7; n++) {
    const team = (
      await pool.query(
        'INSERT INTO teams(event_id,name) VALUES ($1,$2) RETURNING id',
        [f.event, `Team ${n + 1}`],
      )
    ).rows[0].id;
    await pool.query(
      'INSERT INTO voting_items(event_id,voting_id,team_id,name,display_order) VALUES ($1,$2,$3,$4,$5)',
      [f.event, f.t, team, `Team ${n + 1}`, n],
    );
  }
  const ids = (
    await pool.query(
      'SELECT id FROM voting_items WHERE voting_id=$1 ORDER BY display_order,id',
      [f.t],
    )
  ).rows.map((row) => row.id as string);
  const session = sessionCookie(await enter(await issue(f.event, f.jurors[0])));
  const path = `/wizard/steps/${f.t}/validate`;
  const entries = (plus: number, minus: number) =>
    ids.slice(0, plus + minus).map((votingItemId, i) => ({
      votingItemId,
      voteValue: i < plus ? 1 : -1,
    }));
  return { ...f, ids, session, validationPath: path, entries };
}

describe('Phase 6 authoritative validation without persistence', () => {
  it('validates actual-cast eligibility, optional usage and stored maxima', async () => {
    const f = await interactionFixture();
    for (const [plus, minus, valid] of [
      [0, 0, true],
      [1, 1, false],
      [2, 1, true],
      [3, 2, false],
      [4, 2, true],
      [5, 0, false],
      [4, 3, false],
    ] as const) {
      const response = await request(
        'POST',
        f.validationPath,
        { entries: f.entries(plus, minus) },
        f.session,
      );
      expect(response.statusCode).toBe(200);
      expect(response.json().valid).toBe(valid);
      expect(response.headers['cache-control']).toBe('no-store');
    }
  });
  it('rejects duplicate same/opposite votes and unknown or other-category items', async () => {
    const f = await interactionFixture();
    for (const value of [1, -1]) {
      const response = await request(
        'POST',
        f.validationPath,
        {
          entries: [
            ...f.entries(1, 0),
            { votingItemId: f.ids[0], voteValue: value },
          ],
        },
        f.session,
      );
      expect(response.json()).toMatchObject({
        valid: false,
        issues: expect.arrayContaining(['DUPLICATE_ITEM']),
      });
    }
    const other = await interactionFixture();
    const sameEventItem = (
      await pool.query(
        "INSERT INTO voting_items(event_id,voting_id,team_id,name) VALUES ($1,$2,$3,'Other category') RETURNING id",
        [f.event, f.v, f.team],
      )
    ).rows[0].id;
    for (const id of [randomUUID(), other.ids[0], sameEventItem])
      expect(
        (
          await request(
            'POST',
            f.validationPath,
            { entries: [{ votingItemId: id, voteValue: 1 }] },
            f.session,
          )
        ).json(),
      ).toMatchObject({ valid: false, issues: ['UNKNOWN_ITEM'] });
  });
  it('uses current stored negative enable/limit values, never browser limits', async () => {
    const f = await interactionFixture();
    await pool.query(
      'UPDATE votings SET max_minus_votes=0,allow_negative_votes=false WHERE id=$1',
      [f.t],
    );
    expect(
      (
        await request(
          'POST',
          f.validationPath,
          { entries: f.entries(2, 1) },
          f.session,
        )
      ).json(),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining(['NEGATIVES_DISABLED']),
    });
    expect(
      (
        await request(
          'POST',
          f.validationPath,
          { entries: f.entries(2, 0) },
          f.session,
        )
      ).json(),
    ).toMatchObject({ valid: true });
  });
  it.each(['closed', 'archived'])(
    'rejects %s categories even when rule counts are valid',
    async (status) => {
      const f = await interactionFixture();
      await pool.query(
        'UPDATE votings SET status=$2::voting_status WHERE id=$1',
        [f.t, status],
      );
      expect(
        (
          await request('POST', f.validationPath, { entries: [] }, f.session)
        ).json(),
      ).toMatchObject({ valid: false, issues: ['VOTING_UNAVAILABLE'] });
    },
  );
  it('rejects incomplete rules and insufficient candidates on reopened voting', async () => {
    const f = await interactionFixture();
    await pool.query('UPDATE votings SET max_plus_votes=NULL WHERE id=$1', [
      f.t,
    ]);
    expect(
      (
        await request('POST', f.validationPath, { entries: [] }, f.session)
      ).json(),
    ).toMatchObject({ valid: false, issues: ['CONFIGURATION_NOT_READY'] });
    expect(
      (
        await request(
          'POST',
          `/wizard/steps/${f.both}/validate`,
          { entries: [] },
          f.session,
        )
      ).json(),
    ).toMatchObject({ valid: false, issues: ['CONFIGURATION_NOT_READY'] });
  });
  it('rejects missing/admin/expired/revoked sessions', async () => {
    const f = await interactionFixture();
    for (const [session, status] of [
      ['', 401],
      [cookie, 403],
      ['d21-session=fabricated', 401],
    ] as const)
      expect(
        (await request('POST', f.validationPath, { entries: [] }, session))
          .statusCode,
      ).toBe(status);
    await pool.query(
      "UPDATE sessions SET created_at=now()-interval '13 hours',expires_at=now()-interval '1 hour' WHERE token_hash=$1",
      [secretHash(f.session.split('=')[1]!)],
    );
    expect(
      (await request('POST', f.validationPath, { entries: [] }, f.session))
        .statusCode,
    ).toBe(401);
    const session = sessionCookie(
      await enter(await issue(f.event, f.jurors[0])),
    );
    await request('POST', `${f.path}/revoke`, {});
    expect(
      (await request('POST', f.validationPath, { entries: [] }, session))
        .statusCode,
    ).toBe(401);
  });
  it('conceals forbidden, draft, foreign and missing categories with the same 404', async () => {
    const f = await interactionFixture();
    const other = await fixture();
    for (const id of [f.v, f.draft, other.t, randomUUID()]) {
      const response = await request(
        'POST',
        `/wizard/steps/${id}/validate`,
        { entries: [] },
        f.session,
      );
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('NOT_FOUND');
    }
    await pool.query('UPDATE event_jurors SET jury_group_id=$2 WHERE id=$1', [
      f.jurors[0],
      f.groups[1],
    ]);
    expect(
      (await request('POST', f.validationPath, { entries: [] }, f.session))
        .statusCode,
    ).toBe(404);
  });
  it('rejects malformed bodies, unknown claims/queries, wrong origin and missing request header', async () => {
    const f = await interactionFixture();
    for (const body of [
      {},
      { entries: [{ votingItemId: f.ids[0], voteValue: 0 }] },
      { entries: [{ votingItemId: 'bad', voteValue: 1 }] },
      { entries: [], eventId: f.event },
      { entries: [], jurorId: f.jurors[0] },
      { entries: [], juryGroupId: f.groups[0] },
      { entries: [], maxPlusVotes: 99 },
      { entries: [], status: 'active' },
      { entries: [{ votingItemId: f.ids[0], voteValue: 1, group: 'T' }] },
    ])
      expect(
        (await request('POST', f.validationPath, body, f.session)).statusCode,
      ).toBe(400);
    expect(
      (
        await request(
          'POST',
          `${f.validationPath}?group=T`,
          { entries: [] },
          f.session,
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request(
          'POST',
          '/wizard/steps/bad/validate',
          { entries: [] },
          f.session,
        )
      ).statusCode,
    ).toBe(400);
    for (const extra of [
      {},
      { ...headers, origin: 'https://foreign.example' },
      { ...headers, 'sec-fetch-site': 'cross-site' },
    ])
      expect(
        (
          await request(
            'POST',
            f.validationPath,
            { entries: [] },
            f.session,
            extra,
          )
        ).statusCode,
      ).toBe(403);
  });
  it('never writes ballots, entries, progress, configuration or sticky roster markers', async () => {
    const f = await interactionFixture();
    const snapshot = async () => ({
      event: (await pool.query('SELECT * FROM events WHERE id=$1', [f.event]))
        .rows,
      voting: (
        await pool.query(
          'SELECT * FROM votings WHERE event_id=$1 ORDER BY id',
          [f.event],
        )
      ).rows,
      ballots: (
        await pool.query('SELECT * FROM ballots WHERE event_id=$1', [f.event])
      ).rows,
      entries: (
        await pool.query('SELECT * FROM ballot_entries WHERE event_id=$1', [
          f.event,
        ])
      ).rows,
    });
    const before = await snapshot();
    for (let n = 0; n < 3; n++)
      for (const entries of [[], f.entries(4, 2), f.entries(1, 1)])
        await request('POST', f.validationPath, { entries }, f.session);
    expect(await snapshot()).toEqual(before);
    for (const suffix of ['submit'])
      expect(
        (
          await request(
            'POST',
            `/wizard/steps/${f.t}/${suffix}`,
            { entries: [] },
            f.session,
          )
        ).statusCode,
      ).toBe(400);
  });
  it.each(['close', 'revoke', 'expire'])(
    'rechecks %s after waiting for the shared event lock',
    async (action) => {
      const f = await interactionFixture();
      const client = await pool.connect();
      await client.query('BEGIN');
      await client.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
        f.event,
      ]);
      const running = Promise.resolve(
        request(
          'POST',
          f.validationPath,
          { entries: f.entries(2, 1) },
          f.session,
        ),
      );
      try {
        let waiting = false;
        const until = Date.now() + 3000;
        while (Date.now() < until) {
          waiting = Boolean(
            (
              await pool.query(
                "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%roster_locked_at%'",
              )
            ).rowCount,
          );
          if (waiting) break;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(waiting).toBe(true);
        if (action === 'close')
          await client.query("UPDATE votings SET status='closed' WHERE id=$1", [
            f.t,
          ]);
        else if (action === 'revoke')
          await client.query(
            'UPDATE sessions SET revoked_at=now() WHERE token_hash=$1',
            [secretHash(f.session.split('=')[1]!)],
          );
        else
          await client.query(
            "UPDATE sessions SET created_at=now()-interval '13 hours',expires_at=now()-interval '1 hour' WHERE token_hash=$1",
            [secretHash(f.session.split('=')[1]!)],
          );
        await client.query('COMMIT');
        const result = await running;
        if (action === 'close')
          expect(result.json()).toMatchObject({
            valid: false,
            issues: ['VOTING_UNAVAILABLE'],
          });
        else expect(result.statusCode).toBe(401);
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    },
  );
});

const draftPath = (id: string) => `/wizard/steps/${id}/ballot-draft`;
describe('Phase 7 category draft persistence', () => {
  it('restores owner-scoped saved choices and meaningful progress after logout and link recovery', async () => {
    const f = await interactionFixture();
    const path = draftPath(f.t);
    expect(
      (await request('GET', path, undefined, f.session)).json(),
    ).toBeNull();
    const response = await request(
      'PUT',
      path,
      { expectedRevision: null, entries: f.entries(2, 1) },
      f.session,
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const saved = response.json();
    expect(saved).toMatchObject({
      status: 'draft',
      revision: 1,
      progress: 'in_progress',
      entries: f.entries(2, 1),
      validation: { valid: true },
    });
    expect(Date.parse(saved.savedAt)).toBeGreaterThan(Date.now() - 5000);
    const stored = (
      await pool.query('SELECT * FROM ballots WHERE event_id=$1', [f.event])
    ).rows;
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      event_id: f.event,
      juror_id: f.jurors[0],
      voting_id: f.t,
      status: 'draft',
      submitted_at: null,
    });
    await request('POST', '/auth/logout', {}, f.session);
    const recovered = sessionCookie(
      await enter(await issue(f.event, f.jurors[0])),
    );
    const detail = (
      await request('GET', `/wizard/steps/${f.t}`, undefined, recovered)
    ).json();
    expect(detail.ballot).toEqual(saved);
    expect(detail.step.progress).toBe('in_progress');
    expect(
      detail.current.steps.find((step: { id: string }) => step.id === f.t)
        .progress,
    ).toBe('in_progress');
    expect(
      detail.current.steps.find((step: { id: string }) => step.id === f.both)
        .progress,
    ).toBe('not_started');
    const second = sessionCookie(
      await enter(await issue(f.event, f.jurors[1])),
    );
    expect(
      (await request('GET', draftPath(f.both), undefined, second)).json(),
    ).toBeNull();
    expect((await request('GET', path, undefined, second)).statusCode).toBe(
      404,
    );
  });
  it('replaces signs and removes entries atomically, retaining invalid drafts without submission', async () => {
    const f = await interactionFixture();
    const path = draftPath(f.t);
    await request(
      'PUT',
      path,
      { expectedRevision: null, entries: f.entries(2, 1) },
      f.session,
    );
    const invalid = await request(
      'PUT',
      path,
      { expectedRevision: 1, entries: f.entries(1, 1) },
      f.session,
    );
    expect(invalid.statusCode).toBe(200);
    expect(invalid.json()).toMatchObject({
      revision: 2,
      progress: 'invalid_draft',
      status: 'draft',
      validation: { valid: false, issues: ['NEGATIVE_ELIGIBILITY'] },
    });
    expect((await request('GET', path, undefined, f.session)).json()).toEqual(
      invalid.json(),
    );
    const repaired = await request(
      'PUT',
      path,
      { expectedRevision: 2, entries: f.entries(2, 1) },
      f.session,
    );
    expect(repaired.json()).toMatchObject({
      revision: 3,
      progress: 'in_progress',
    });
    const cleared = await request(
      'PUT',
      path,
      { expectedRevision: 3, entries: [] },
      f.session,
    );
    expect(cleared.json()).toMatchObject({
      revision: 4,
      entries: [],
      progress: 'in_progress',
      validation: { valid: true },
    });
    expect(
      (
        await pool.query('SELECT * FROM ballot_entries WHERE event_id=$1', [
          f.event,
        ])
      ).rows,
    ).toEqual([]);
    expect(
      (
        await pool.query(
          'SELECT status,submitted_at FROM ballots WHERE event_id=$1',
          [f.event],
        )
      ).rows,
    ).toEqual([{ status: 'draft', submitted_at: null }]);
    expect(
      (await request('POST', `/wizard/steps/${f.t}/submit`, {}, f.session))
        .statusCode,
    ).toBe(400);
  });
  it('isolates different jurors and different categories even when names match', async () => {
    const f = await interactionFixture();
    // Prepare a second complete category, using the same teams with distinct item IDs.
    await pool.query(
      'UPDATE votings SET max_plus_votes=4,max_minus_votes=2 WHERE id=$1',
      [f.both],
    );
    await pool.query(
      'INSERT INTO voting_items(event_id,voting_id,team_id,name,display_order) SELECT event_id,$2,team_id,name,display_order FROM voting_items WHERE voting_id=$1',
      [f.t, f.both],
    );
    const otherId = (
      await pool.query(
        "INSERT INTO event_jurors(event_id,jury_group_id,display_name) VALUES ($1,$2,'Same Name') RETURNING id",
        [f.event, f.groups[0]],
      )
    ).rows[0].id;
    const second = sessionCookie(await enter(await issue(f.event, otherId)));
    await request(
      'PUT',
      draftPath(f.t),
      { expectedRevision: null, entries: f.entries(2, 1) },
      f.session,
    );
    expect(
      (await request('GET', draftPath(f.t), undefined, second)).json(),
    ).toBeNull();
    expect(
      (
        await request(
          'PUT',
          draftPath(f.t),
          { expectedRevision: null, entries: [] },
          second,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await request(
          'PUT',
          draftPath(f.both),
          { expectedRevision: null, entries: [] },
          f.session,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await request('GET', draftPath(f.t), undefined, f.session)).json()
        .entries,
    ).toEqual(f.entries(2, 1));
    expect(
      (await pool.query('SELECT * FROM ballots WHERE event_id=$1', [f.event]))
        .rowCount,
    ).toBe(3);
  });
  it('rejects foreign, unknown and duplicate entries without changing the draft', async () => {
    const f = await interactionFixture(),
      other = await interactionFixture();
    const path = draftPath(f.t);
    const saved = (
      await request(
        'PUT',
        path,
        { expectedRevision: null, entries: f.entries(2, 1) },
        f.session,
      )
    ).json();
    const otherCategory = (
      await pool.query(
        "INSERT INTO voting_items(event_id,voting_id,team_id,name) VALUES ($1,$2,$3,'Other') RETURNING id",
        [f.event, f.both, f.team],
      )
    ).rows[0].id;
    for (const entries of [
      [{ votingItemId: randomUUID(), voteValue: 1 }],
      [{ votingItemId: other.ids[0], voteValue: 1 }],
      [{ votingItemId: otherCategory, voteValue: 1 }],
      [...f.entries(1, 0), ...f.entries(1, 0)],
      [...f.entries(1, 0), { votingItemId: f.ids[0], voteValue: -1 }],
    ]) {
      const result = await request(
        'PUT',
        path,
        { expectedRevision: 1, entries },
        f.session,
      );
      expect(result.statusCode).toBe(400);
      expect(result.json().error.code).toBe('INVALID_DRAFT_ENTRIES');
      expect((await request('GET', path, undefined, f.session)).json()).toEqual(
        saved,
      );
    }
  });
  it('records over-limit/disabled-negative drafts as invalid, never as submitted', async () => {
    const f = await interactionFixture();
    expect(
      (
        await request(
          'PUT',
          draftPath(f.t),
          { expectedRevision: null, entries: f.entries(5, 0) },
          f.session,
        )
      ).json(),
    ).toMatchObject({
      progress: 'invalid_draft',
      status: 'draft',
      validation: { issues: ['PLUS_LIMIT'] },
    });
    await pool.query(
      'UPDATE votings SET max_minus_votes=0,allow_negative_votes=false WHERE id=$1',
      [f.t],
    );
    expect(
      (
        await request(
          'PUT',
          draftPath(f.t),
          { expectedRevision: 1, entries: f.entries(2, 1) },
          f.session,
        )
      ).json(),
    ).toMatchObject({
      progress: 'invalid_draft',
      status: 'draft',
      validation: { issues: expect.arrayContaining(['NEGATIVES_DISABLED']) },
    });
  });
  it('preserves saved drafts while closed/archived and accepts edits after reopening', async () => {
    const f = await interactionFixture();
    const path = draftPath(f.t);
    const saved = (
      await request(
        'PUT',
        path,
        { expectedRevision: null, entries: f.entries(2, 1) },
        f.session,
      )
    ).json();
    for (const status of ['closed', 'archived']) {
      await pool.query(
        'UPDATE votings SET status=$2::voting_status WHERE id=$1',
        [f.t, status],
      );
      const denied = await request(
        'PUT',
        path,
        { expectedRevision: 1, entries: [] },
        f.session,
      );
      expect(denied.statusCode).toBe(409);
      expect(denied.json().error.code).toBe('VOTING_UNAVAILABLE');
      expect(
        (await request('GET', path, undefined, f.session)).json(),
      ).toMatchObject({
        entries: saved.entries,
        revision: 1,
        savedAt: saved.savedAt,
        progress: 'in_progress',
        validation: { valid: false, issues: ['VOTING_UNAVAILABLE'] },
      });
    }
    expect(
      (await request('POST', `/votings/${f.t}/reopen`, {})).statusCode,
    ).toBe(200);
    expect(
      (
        await request(
          'PUT',
          path,
          { expectedRevision: 1, entries: [] },
          f.session,
        )
      ).json(),
    ).toMatchObject({ revision: 2, validation: { valid: true } });
  });
  it.each(['submitted', 'cancelled'])(
    'preserves %s ballot history against draft writes',
    async (status) => {
      const f = await interactionFixture();
      await request(
        'PUT',
        draftPath(f.t),
        { expectedRevision: null, entries: f.entries(2, 1) },
        f.session,
      );
      await pool.query(
        "UPDATE ballots SET status=$2::ballot_status,submitted_at=CASE WHEN $2='submitted' THEN now() ELSE NULL END WHERE voting_id=$1",
        [f.t, status],
      );
      const before = (
        await pool.query('SELECT * FROM ballots WHERE voting_id=$1', [f.t])
      ).rows;
      const entries = (
        await pool.query(
          'SELECT * FROM ballot_entries WHERE voting_id=$1 ORDER BY voting_item_id',
          [f.t],
        )
      ).rows;
      const result = await request(
        'PUT',
        draftPath(f.t),
        { expectedRevision: 1, entries: [] },
        f.session,
      );
      expect(result.statusCode).toBe(409);
      expect(result.json().error.code).toBe('BALLOT_NOT_EDITABLE');
      expect(
        (await pool.query('SELECT * FROM ballots WHERE voting_id=$1', [f.t]))
          .rows,
      ).toEqual(before);
      expect(
        (
          await pool.query(
            'SELECT * FROM ballot_entries WHERE voting_id=$1 ORDER BY voting_item_id',
            [f.t],
          )
        ).rows,
      ).toEqual(entries);
    },
  );
  it('rejects stale/future revisions and recovers an ambiguous retry without duplicate ballots', async () => {
    const f = await interactionFixture();
    const path = draftPath(f.t);
    const input = { expectedRevision: null, entries: f.entries(2, 1) };
    const saved = (await request('PUT', path, input, f.session)).json();
    for (const expectedRevision of [null, 0, 2, 2147483647]) {
      const result = await request(
        'PUT',
        path,
        { ...input, expectedRevision },
        f.session,
      );
      expect(result.statusCode).toBe(409);
      expect(result.json().error.code).toBe('DRAFT_CONFLICT');
    }
    expect((await request('GET', path, undefined, f.session)).json()).toEqual(
      saved,
    );
    expect(
      (await pool.query('SELECT * FROM ballots WHERE voting_id=$1', [f.t]))
        .rowCount,
    ).toBe(1);
    expect(
      (
        await request(
          'PUT',
          path,
          { expectedRevision: 1, entries: [] },
          f.session,
        )
      ).statusCode,
    ).toBe(200);
  });
  it.each([null, 1])(
    'allows only one simultaneous save at revision %s across sessions',
    async (revision) => {
      const f = await interactionFixture();
      if (revision)
        await request(
          'PUT',
          draftPath(f.t),
          { expectedRevision: null, entries: [] },
          f.session,
        );
      // Issuing a replacement revokes old sessions; recover two sessions from that same link.
      const link = await issue(f.event, f.jurors[0]);
      const a = sessionCookie(await enter(link)),
        b = sessionCookie(await enter(link));
      const [first, last] = await Promise.all([
        request(
          'PUT',
          draftPath(f.t),
          { expectedRevision: revision, entries: f.entries(2, 1) },
          a,
        ),
        request(
          'PUT',
          draftPath(f.t),
          { expectedRevision: revision, entries: f.entries(1, 1) },
          b,
        ),
      ]);
      expect([first.statusCode, last.statusCode].sort()).toEqual([200, 409]);
      const winner = first.statusCode === 200 ? first.json() : last.json();
      expect(
        (await request('GET', draftPath(f.t), undefined, a)).json(),
      ).toEqual(winner);
      expect(
        (await pool.query('SELECT * FROM ballots WHERE voting_id=$1', [f.t]))
          .rowCount,
      ).toBe(1);
      expect(winner.revision).toBe((revision ?? 0) + 1);
    },
  );
  it('rolls back revision and entry replacement when storage fails midway', async () => {
    const f = await interactionFixture();
    const path = draftPath(f.t);
    const before = (
      await request(
        'PUT',
        path,
        { expectedRevision: null, entries: f.entries(2, 0) },
        f.session,
      )
    ).json();
    await pool.query(
      `CREATE FUNCTION phase7_fail_entry() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.voting_id='${f.t}'::uuid AND NEW.vote_value=-1 THEN RAISE EXCEPTION 'disposable test failure'; END IF; RETURN NEW; END; $$`,
    );
    await pool.query(
      'CREATE TRIGGER phase7_fail_entry BEFORE INSERT ON ballot_entries FOR EACH ROW EXECUTE FUNCTION phase7_fail_entry()',
    );
    try {
      expect(
        (
          await request(
            'PUT',
            path,
            { expectedRevision: 1, entries: f.entries(2, 1) },
            f.session,
          )
        ).statusCode,
      ).toBe(500);
      expect((await request('GET', path, undefined, f.session)).json()).toEqual(
        before,
      );
    } finally {
      await pool.query('DROP TRIGGER phase7_fail_entry ON ballot_entries');
      await pool.query('DROP FUNCTION phase7_fail_entry()');
    }
    expect(
      (
        await request(
          'PUT',
          path,
          { expectedRevision: 1, entries: f.entries(2, 1) },
          f.session,
        )
      ).statusCode,
    ).toBe(200);
  });
  it('guards GET/PUT with strict inputs, current ownership, session and origin rules', async () => {
    const f = await interactionFixture(),
      other = await fixture();
    const path = draftPath(f.t),
      payload = { expectedRevision: null, entries: [] };
    for (const method of ['GET', 'PUT'] as const) {
      for (const [session, status] of [
        ['', 401],
        [cookie, 403],
        ['d21-session=fabricated', 401],
      ] as const)
        expect(
          (
            await request(
              method,
              path,
              method === 'PUT' ? payload : undefined,
              session,
            )
          ).statusCode,
        ).toBe(status);
      for (const id of [f.v, f.draft, other.t, randomUUID()])
        expect(
          (
            await request(
              method,
              draftPath(id),
              method === 'PUT' ? payload : undefined,
              f.session,
            )
          ).statusCode,
        ).toBe(404);
      expect(
        (
          await request(
            method,
            `${path}?jurorId=${f.jurors[1]}`,
            method === 'PUT' ? payload : undefined,
            f.session,
          )
        ).statusCode,
      ).toBe(400);
    }
    for (const input of [
      { entries: [] },
      { ...payload, jurorId: f.jurors[1] },
      { ...payload, status: 'submitted' },
      { ...payload, expectedRevision: -1 },
      { ...payload, expectedRevision: 1.5 },
      { ...payload, expectedRevision: '1' },
      { ...payload, expectedRevision: 2147483648 },
      { ...payload, entries: [{ votingItemId: f.ids[0], voteValue: 0 }] },
    ])
      expect((await request('PUT', path, input, f.session)).statusCode).toBe(
        400,
      );
    for (const extra of [
      {},
      { ...headers, origin: 'https://foreign.example' },
      { ...headers, 'sec-fetch-site': 'cross-site' },
    ])
      expect(
        (await request('PUT', path, payload, f.session, extra)).statusCode,
      ).toBe(403);
    await pool.query('UPDATE event_jurors SET jury_group_id=$2 WHERE id=$1', [
      f.jurors[0],
      f.groups[1],
    ]);
    expect((await request('PUT', path, payload, f.session)).statusCode).toBe(
      404,
    );
    expect(
      (await pool.query('SELECT * FROM ballots WHERE event_id=$1', [f.event]))
        .rowCount,
    ).toBe(0);
  });
  it.each(['close', 'revoke', 'expire', 'membership', 'unready'])(
    'rechecks %s inside the save transaction after an actual event-lock wait',
    async (action) => {
      const f = await interactionFixture();
      const client = await pool.connect();
      await client.query('BEGIN');
      await client.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
        f.event,
      ]);
      const running = Promise.resolve(
        request(
          'PUT',
          draftPath(f.t),
          { expectedRevision: null, entries: f.entries(2, 1) },
          f.session,
        ),
      );
      try {
        let waiting = false;
        const until = Date.now() + 3000;
        while (Date.now() < until) {
          waiting = Boolean(
            (
              await pool.query(
                "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%roster_locked_at%'",
              )
            ).rowCount,
          );
          if (waiting) break;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(waiting).toBe(true);
        if (action === 'close')
          await client.query("UPDATE votings SET status='closed' WHERE id=$1", [
            f.t,
          ]);
        if (action === 'unready')
          await client.query(
            'UPDATE votings SET max_plus_votes=NULL WHERE id=$1',
            [f.t],
          );
        if (action === 'membership')
          await client.query(
            'UPDATE event_jurors SET jury_group_id=$2 WHERE id=$1',
            [f.jurors[0], f.groups[1]],
          );
        if (action === 'revoke')
          await client.query(
            'UPDATE sessions SET revoked_at=now() WHERE token_hash=$1',
            [secretHash(f.session.split('=')[1]!)],
          );
        if (action === 'expire')
          await client.query(
            "UPDATE sessions SET created_at=now()-interval '13 hours',expires_at=now()-interval '1 hour' WHERE token_hash=$1",
            [secretHash(f.session.split('=')[1]!)],
          );
        await client.query('COMMIT');
        const result = await running;
        expect(result.statusCode).toBe(
          action === 'membership'
            ? 404
            : ['close', 'unready'].includes(action)
              ? 409
              : 401,
        );
        expect(
          (
            await pool.query('SELECT * FROM ballots WHERE event_id=$1', [
              f.event,
            ])
          ).rowCount,
        ).toBe(0);
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    },
  );
});

const submitPath = (id: string) => `/wizard/steps/${id}/submit`;
const unlockPath = (voting: string, ballot: string) =>
  `/votings/${voting}/ballots/${ballot}/unlock`;
async function ballotState(event: string) {
  return {
    ballots: (
      await pool.query('SELECT * FROM ballots WHERE event_id=$1 ORDER BY id', [
        event,
      ])
    ).rows,
    entries: (
      await pool.query(
        'SELECT * FROM ballot_entries WHERE event_id=$1 ORDER BY ballot_id,voting_item_id',
        [event],
      )
    ).rows,
    history: (
      await pool.query(
        "SELECT * FROM audit_logs WHERE event_id=$1 AND target_type='ballot' ORDER BY created_at,id",
        [event],
      )
    ).rows,
  };
}
async function waitForEventLock() {
  const until = Date.now() + 3000;
  while (Date.now() < until) {
    if (
      (
        await pool.query(
          "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%roster_locked_at%'",
        )
      ).rowCount
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Expected an actual event-lock wait');
}
describe('Phase 8 independent submission and administrator-only unlocking', () => {
  it.each([null, 1])(
    'atomically submits choices at base %s, restores confirmation and replays without mutation',
    async (revision) => {
      const f = await interactionFixture();
      if (revision)
        await request(
          'PUT',
          draftPath(f.t),
          { expectedRevision: null, entries: [] },
          f.session,
        );
      const payload = { expectedRevision: revision, entries: f.entries(2, 1) };
      const response = await request(
        'POST',
        submitPath(f.t),
        payload,
        f.session,
      );
      expect(response.statusCode).toBe(200);
      const saved = response.json();
      expect(saved).toMatchObject({
        status: 'submitted',
        revision: (revision ?? 0) + 1,
        progress: 'submitted',
        validation: { valid: true },
        entries: payload.entries,
      });
      expect(Date.parse(saved.submittedAt)).toBeGreaterThan(Date.now() - 5000);
      const before = await ballotState(f.event);
      expect(before.ballots).toHaveLength(1);
      expect(before.history).toHaveLength(1);
      expect(before.history[0]).toMatchObject({
        action: 'ballot.submitted',
        actor_juror_id: f.jurors[0],
        actor_user_id: null,
        context: {
          entries: payload.entries,
          submittedAt: saved.submittedAt,
          revision: saved.revision,
        },
      });
      for (let n = 0; n < 2; n++)
        expect(
          (
            await request(
              'POST',
              submitPath(f.t),
              { ...payload, entries: [...payload.entries].reverse() },
              f.session,
            )
          ).json(),
        ).toEqual(saved);
      expect(await ballotState(f.event)).toEqual(before);
      expect(
        (await request('GET', draftPath(f.t), undefined, f.session)).json(),
      ).toEqual(saved);
      expect(
        (await request('GET', '/wizard/current', undefined, f.session))
          .json()
          .steps.find((s: { id: string }) => s.id === f.t).progress,
      ).toBe('submitted');
      const link = await issue(f.event, f.jurors[0]);
      const recovered = sessionCookie(await enter(link));
      expect(
        (await request('GET', draftPath(f.t), undefined, recovered)).json(),
      ).toEqual(saved);
      expect(
        (
          await request(
            'PUT',
            draftPath(f.t),
            { expectedRevision: saved.revision, entries: [] },
            recovered,
          )
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await request(
            'POST',
            submitPath(f.t),
            { expectedRevision: saved.revision, entries: [] },
            recovered,
          )
        ).statusCode,
      ).toBe(409);
      expect(await ballotState(f.event)).toEqual(before);
    },
  );
  it('submits an explicit empty ballot and leaves other categories independent, including closed ones', async () => {
    const f = await interactionFixture();
    expect(
      (
        await request(
          'POST',
          submitPath(f.t),
          { expectedRevision: null, entries: [] },
          f.session,
        )
      ).json(),
    ).toMatchObject({ status: 'submitted', entries: [], revision: 1 });
    await pool.query(
      `INSERT INTO voting_items(event_id,voting_id,team_id,name,display_order)
      SELECT event_id,$2,team_id,name,display_order FROM voting_items WHERE voting_id=$1`,
      [f.t, f.both],
    );
    const r = await request(
      'POST',
      submitPath(f.both),
      { expectedRevision: null, entries: [] },
      f.session,
    );
    expect(r.statusCode).toBe(200);
    expect((await ballotState(f.event)).ballots).toHaveLength(2);
    expect(
      (
        await request(
          'POST',
          submitPath(f.closed),
          { expectedRevision: null, entries: [] },
          f.session,
        )
      ).statusCode,
    ).toBe(409);
  });
  it('rejects invalid, foreign, duplicate, over-cap, disabled and stale choices without storage changes', async () => {
    const f = await interactionFixture();
    await request(
      'PUT',
      draftPath(f.t),
      { expectedRevision: null, entries: f.entries(1, 1) },
      f.session,
    );
    const before = await ballotState(f.event);
    for (const entries of [
      f.entries(1, 1),
      f.entries(5, 0),
      f.entries(4, 3),
      [{ votingItemId: randomUUID(), voteValue: 1 }],
      [...f.entries(2, 0), f.entries(1, 0)[0]!],
    ]) {
      expect(
        (
          await request(
            'POST',
            submitPath(f.t),
            { expectedRevision: 1, entries },
            f.session,
          )
        ).statusCode,
      ).toBe(409);
      expect(await ballotState(f.event)).toEqual(before);
    }
    for (const expectedRevision of [null, 0, 2]) {
      expect(
        (
          await request(
            'POST',
            submitPath(f.t),
            { expectedRevision, entries: [] },
            f.session,
          )
        ).json().error.code,
      ).toBe('DRAFT_CONFLICT');
      expect(await ballotState(f.event)).toEqual(before);
    }
    await pool.query(
      'UPDATE votings SET allow_negative_votes=false,max_minus_votes=0 WHERE id=$1',
      [f.t],
    );
    expect(
      (
        await request(
          'POST',
          submitPath(f.t),
          { expectedRevision: 1, entries: f.entries(2, 1) },
          f.session,
        )
      ).statusCode,
    ).toBe(409);
    expect(await ballotState(f.event)).toEqual(before);
  });
  it('requires current juror authorization, strict inputs and origin for submission', async () => {
    const f = await interactionFixture(),
      other = await fixture();
    const input = { expectedRevision: null, entries: [] };
    for (const [session, status] of [
      ['', 401],
      [cookie, 403],
      ['d21-session=fake', 401],
    ] as const)
      expect(
        (await request('POST', submitPath(f.t), input, session)).statusCode,
      ).toBe(status);
    for (const id of [f.v, f.draft, other.t, randomUUID()])
      expect(
        (await request('POST', submitPath(id), input, f.session)).statusCode,
      ).toBe(404);
    for (const body of [
      { entries: [] },
      { ...input, status: 'submitted' },
      { ...input, jurorId: f.jurors[1] },
      { ...input, expectedRevision: 1.5 },
      { ...input, entries: [{ votingItemId: f.ids[0], voteValue: 0 }] },
    ])
      expect(
        (await request('POST', submitPath(f.t), body, f.session)).statusCode,
      ).toBe(400);
    expect(
      (
        await request(
          'POST',
          `${submitPath(f.t)}?jurorId=${f.jurors[1]}`,
          input,
          f.session,
        )
      ).statusCode,
    ).toBe(400);
    for (const extra of [
      {},
      { ...headers, origin: 'https://foreign.example' },
      { ...headers, 'sec-fetch-site': 'cross-site' },
    ])
      expect(
        (await request('POST', submitPath(f.t), input, f.session, extra))
          .statusCode,
      ).toBe(403);
    expect((await ballotState(f.event)).ballots).toHaveLength(0);
  });
  it.each(['same', 'different', 'save'] as const)(
    'serializes simultaneous %s requests without duplicate history or lost updates',
    async (mode) => {
      const f = await interactionFixture();
      const payload = { expectedRevision: null, entries: f.entries(2, 1) };
      const result = await Promise.all([
        request('POST', submitPath(f.t), payload, f.session),
        request(
          mode === 'save' ? 'PUT' : 'POST',
          mode === 'save' ? draftPath(f.t) : submitPath(f.t),
          mode === 'same' ? payload : { expectedRevision: null, entries: [] },
          f.session,
        ),
      ]);
      expect(result.map((r) => r.statusCode).sort()).toEqual(
        mode === 'same' ? [200, 200] : [200, 409],
      );
      const stored = await ballotState(f.event);
      expect(stored.ballots).toHaveLength(1);
      expect(stored.ballots[0].revision).toBe(1);
      expect(stored.history).toHaveLength(
        stored.ballots[0].status === 'submitted' ? 1 : 0,
      );
    },
  );
  it('unlocks only by admin, keeps original history/choices, resubmits a replacement and rejects old retries', async () => {
    const f = await interactionFixture();
    const entries = f.entries(2, 1);
    await request(
      'POST',
      submitPath(f.t),
      { expectedRevision: null, entries },
      f.session,
    );
    const initial = await ballotState(f.event),
      id = initial.ballots[0].id;
    const path = unlockPath(f.t, id);
    expect(
      (await request('POST', path, { expectedRevision: 1 }, f.session))
        .statusCode,
    ).toBe(403);
    expect(
      (await request('POST', path, { expectedRevision: 1 }, '')).statusCode,
    ).toBe(401);
    expect(await ballotState(f.event)).toEqual(initial);
    const results = await Promise.all([
      request('POST', path, { expectedRevision: 1 }),
      request('POST', path, { expectedRevision: 1 }),
    ]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
    expect(results[0]!.json()).toMatchObject({
      status: 'draft',
      revision: 2,
      submittedAt: null,
    });
    const unlocked = await ballotState(f.event);
    expect(unlocked.entries).toEqual(initial.entries);
    expect(unlocked.history).toHaveLength(2);
    expect(unlocked.history[0]).toEqual(initial.history[0]);
    expect(unlocked.history[1]).toMatchObject({
      action: 'ballot.unlocked',
      actor_juror_id: null,
      actor_user_id: expect.any(String),
      context: {
        entries: expect.arrayContaining(entries),
        previousRevision: 1,
        revision: 2,
      },
    });
    expect(
      (
        await request(
          'POST',
          submitPath(f.t),
          { expectedRevision: null, entries },
          f.session,
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await request(
          'PUT',
          draftPath(f.t),
          { expectedRevision: 1, entries: [] },
          f.session,
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await request(
          'POST',
          submitPath(f.t),
          { expectedRevision: 2, entries: [] },
          f.session,
        )
      ).json(),
    ).toMatchObject({ status: 'submitted', revision: 3, entries: [] });
    const replaced = await ballotState(f.event);
    expect(replaced.history).toHaveLength(3);
    expect(replaced.history.slice(0, 2)).toEqual(unlocked.history);
    expect(
      (await request('POST', path, { expectedRevision: 1 })).statusCode,
    ).toBe(409);
    expect(await ballotState(f.event)).toEqual(replaced);
  });
  it('requires admin guards, exact ballot/category scope and strict unlock revisions without exposing choices', async () => {
    const f = await interactionFixture(),
      other = await fixture();
    await request(
      'POST',
      submitPath(f.t),
      { expectedRevision: null, entries: f.entries(2, 1) },
      f.session,
    );
    const before = await ballotState(f.event),
      id = before.ballots[0].id;
    const listing = await request('GET', `/votings/${f.t}/ballots`);
    expect(listing.statusCode).toBe(200);
    expect(listing.body).not.toContain('entries');
    expect(listing.headers['cache-control']).toBe('no-store');
    const path = unlockPath(f.t, id);
    for (const [session, status] of [
      [f.session, 403],
      ['', 401],
      ['d21-session=bad', 401],
    ] as const) {
      expect(
        (await request('GET', `/votings/${f.t}/ballots`, undefined, session))
          .statusCode,
      ).toBe(status);
      expect(
        (await request('POST', path, { expectedRevision: 1 }, session))
          .statusCode,
      ).toBe(status);
    }
    for (const body of [
      {},
      { expectedRevision: null },
      { expectedRevision: -1 },
      { expectedRevision: 1, entries: [] },
      { expectedRevision: 1, status: 'draft' },
    ])
      expect((await request('POST', path, body)).statusCode).toBe(400);
    for (const extra of [
      {},
      { ...headers, origin: 'https://foreign.example' },
      { ...headers, 'sec-fetch-site': 'cross-site' },
    ])
      expect(
        (await request('POST', path, { expectedRevision: 1 }, cookie, extra))
          .statusCode,
      ).toBe(403);
    for (const voting of [other.t, f.v, randomUUID()])
      expect(
        (await request('POST', unlockPath(voting, id), { expectedRevision: 1 }))
          .statusCode,
      ).toBe(404);
    expect(
      (await request('GET', `/votings/${f.t}/ballots?jurorId=${f.jurors[1]}`))
        .statusCode,
    ).toBe(400);
    expect(
      (await request('POST', path + '?status=draft', { expectedRevision: 1 }))
        .statusCode,
    ).toBe(400);
    expect(await ballotState(f.event)).toEqual(before);
  });
  it.each(['closed', 'archived'])(
    'keeps %s category unavailable after unlock until separate admin reopening',
    async (status) => {
      const f = await interactionFixture();
      await request(
        'POST',
        submitPath(f.t),
        { expectedRevision: null, entries: [] },
        f.session,
      );
      const id = (await ballotState(f.event)).ballots[0].id;
      await pool.query(
        'UPDATE votings SET status=$2::voting_status WHERE id=$1',
        [f.t, status],
      );
      const before = await ballotState(f.event);
      expect(
        (
          await request(
            'POST',
            submitPath(f.t),
            { expectedRevision: null, entries: [] },
            f.session,
          )
        ).statusCode,
      ).toBe(200); // confirmation replay, no write
      expect(await ballotState(f.event)).toEqual(before);
      expect(
        (await request('POST', unlockPath(f.t, id), { expectedRevision: 1 }))
          .statusCode,
      ).toBe(200);
      for (const [method, path] of [
        ['PUT', draftPath(f.t)],
        ['POST', submitPath(f.t)],
      ] as const)
        expect(
          (
            await request(
              method,
              path,
              { expectedRevision: 2, entries: [] },
              f.session,
            )
          ).json().error.code,
        ).toBe('VOTING_UNAVAILABLE');
      await request('POST', `/votings/${f.t}/reopen`, {});
      expect(
        (
          await request(
            'POST',
            submitPath(f.t),
            { expectedRevision: 2, entries: [] },
            f.session,
          )
        ).statusCode,
      ).toBe(200);
    },
  );
  it.each(['submit', 'unlock'])(
    'rolls back %s completely when history storage fails',
    async (operation) => {
      const f = await interactionFixture();
      await request(
        'PUT',
        draftPath(f.t),
        { expectedRevision: null, entries: f.entries(2, 0) },
        f.session,
      );
      if (operation === 'unlock')
        await request(
          'POST',
          submitPath(f.t),
          { expectedRevision: 1, entries: f.entries(2, 1) },
          f.session,
        );
      const before = await ballotState(f.event),
        id = before.ballots[0].id;
      await pool.query(
        `CREATE FUNCTION phase8_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_id='${f.event}'::uuid THEN RAISE EXCEPTION 'disposable audit failure'; END IF; RETURN NEW; END; $$`,
      );
      await pool.query(
        'CREATE TRIGGER phase8_fail_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION phase8_fail_audit()',
      );
      try {
        const r =
          operation === 'submit'
            ? await request(
                'POST',
                submitPath(f.t),
                { expectedRevision: 1, entries: f.entries(2, 1) },
                f.session,
              )
            : await request('POST', unlockPath(f.t, id), {
                expectedRevision: 2,
              });
        expect(r.statusCode).toBe(500);
        expect(await ballotState(f.event)).toEqual(before);
      } finally {
        await pool.query('DROP TRIGGER phase8_fail_audit ON audit_logs');
        await pool.query('DROP FUNCTION phase8_fail_audit()');
      }
    },
  );
  it.each(['close', 'archive', 'revoke', 'expire', 'membership', 'unready'])(
    'rechecks %s after a real submit lock wait',
    async (action) => {
      const f = await interactionFixture(),
        client = await pool.connect();
      await client.query('BEGIN');
      await client.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
        f.event,
      ]);
      const running = Promise.resolve(
        request(
          'POST',
          submitPath(f.t),
          { expectedRevision: null, entries: f.entries(2, 1) },
          f.session,
        ),
      );
      try {
        await waitForEventLock();
        if (action === 'close' || action === 'archive')
          await client.query(
            'UPDATE votings SET status=$2::voting_status WHERE id=$1',
            [f.t, action === 'close' ? 'closed' : 'archived'],
          );
        if (action === 'revoke' || action === 'expire')
          await client.query(
            action === 'revoke'
              ? 'UPDATE sessions SET revoked_at=now() WHERE token_hash=$1'
              : "UPDATE sessions SET created_at=now()-interval '13 hours',expires_at=now()-interval '1 hour' WHERE token_hash=$1",
            [secretHash(f.session.split('=')[1]!)],
          );
        if (action === 'membership')
          await client.query(
            'UPDATE event_jurors SET jury_group_id=$2 WHERE id=$1',
            [f.jurors[0], f.groups[1]],
          );
        if (action === 'unready')
          await client.query(
            'UPDATE votings SET max_plus_votes=NULL WHERE id=$1',
            [f.t],
          );
        await client.query('COMMIT');
        expect((await running).statusCode).toBe(
          action === 'expire' || action === 'revoke'
            ? 401
            : action === 'membership'
              ? 404
              : 409,
        );
        expect((await ballotState(f.event)).ballots).toHaveLength(0);
        expect((await ballotState(f.event)).history).toHaveLength(0);
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    },
  );
  it.each(['revoke', 'expire'])(
    'rechecks admin %s after an actual unlock lock wait',
    async (action) => {
      const f = await interactionFixture();
      await request(
        'POST',
        submitPath(f.t),
        { expectedRevision: null, entries: [] },
        f.session,
      );
      const login = await request(
        'POST',
        '/auth/admin/login',
        { password: 'Disposable Phase Five password' },
        '',
      );
      const session = sessionCookie(login),
        before = await ballotState(f.event),
        id = before.ballots[0].id;
      const client = await pool.connect();
      await client.query('BEGIN');
      await client.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
        f.event,
      ]);
      const running = Promise.resolve(
        request('POST', unlockPath(f.t, id), { expectedRevision: 1 }, session),
      );
      try {
        await waitForEventLock();
        await client.query(
          action === 'revoke'
            ? 'UPDATE sessions SET revoked_at=now() WHERE token_hash=$1'
            : "UPDATE sessions SET created_at=now()-interval '13 hours',expires_at=now()-interval '1 hour' WHERE token_hash=$1",
          [secretHash(session.split('=')[1]!)],
        );
        await client.query('COMMIT');
        expect((await running).statusCode).toBe(401);
        expect(await ballotState(f.event)).toEqual(before);
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    },
  );
});

describe('Phase 8 historical and revision boundaries', () => {
  it('preserves legacy revision-zero submissions when administratively unlocked', async () => {
    const f = await interactionFixture();
    await request(
      'PUT',
      draftPath(f.t),
      { expectedRevision: null, entries: f.entries(2, 1) },
      f.session,
    );
    await pool.query(
      "UPDATE ballots SET revision=0,status='submitted',submitted_at=now() WHERE voting_id=$1",
      [f.t],
    );
    const before = await ballotState(f.event),
      id = before.ballots[0].id;
    expect(
      (
        await request('POST', unlockPath(f.t, id), { expectedRevision: 0 })
      ).json(),
    ).toMatchObject({ revision: 1, status: 'draft' });
    const after = await ballotState(f.event);
    expect(after.entries).toEqual(before.entries);
    expect(after.history[0]).toMatchObject({
      action: 'ballot.unlocked',
      context: {
        previousRevision: 0,
        entries: expect.arrayContaining(f.entries(2, 1)),
        submittedAt: expect.any(String),
      },
    });
    expect(
      (
        await request(
          'POST',
          submitPath(f.t),
          { expectedRevision: 1, entries: [] },
          f.session,
        )
      ).statusCode,
    ).toBe(200);
  });
  it.each(['cancelled', 'exhausted-draft', 'exhausted-submitted'])(
    'protects %s records without modifying history',
    async (mode) => {
      const f = await interactionFixture();
      await request(
        'PUT',
        draftPath(f.t),
        { expectedRevision: null, entries: [] },
        f.session,
      );
      const status =
        mode === 'cancelled'
          ? 'cancelled'
          : mode === 'exhausted-submitted'
            ? 'submitted'
            : 'draft';
      const revision = mode === 'cancelled' ? 1 : 2147483647;
      await pool.query(
        "UPDATE ballots SET status=$2::ballot_status,revision=$3,submitted_at=CASE WHEN $2='submitted' THEN now() ELSE NULL END WHERE voting_id=$1",
        [f.t, status, revision],
      );
      const before = await ballotState(f.event),
        id = before.ballots[0].id;
      expect(
        (
          await request(
            'POST',
            submitPath(f.t),
            { expectedRevision: revision, entries: [] },
            f.session,
          )
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await request('POST', unlockPath(f.t, id), {
            expectedRevision: revision,
          })
        ).statusCode,
      ).toBe(409);
      expect(await ballotState(f.event)).toEqual(before);
    },
  );
  it('rolls back creation and entries if submission state cannot be written', async () => {
    const f = await interactionFixture();
    await pool.query(
      `CREATE FUNCTION phase8_fail_status() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.voting_id='${f.t}'::uuid AND NEW.status='submitted' THEN RAISE EXCEPTION 'disposable submission failure'; END IF; RETURN NEW; END; $$`,
    );
    await pool.query(
      'CREATE TRIGGER phase8_fail_status BEFORE UPDATE ON ballots FOR EACH ROW EXECUTE FUNCTION phase8_fail_status()',
    );
    try {
      expect(
        (
          await request(
            'POST',
            submitPath(f.t),
            { expectedRevision: null, entries: f.entries(2, 1) },
            f.session,
          )
        ).statusCode,
      ).toBe(500);
      expect(await ballotState(f.event)).toEqual({
        ballots: [],
        entries: [],
        history: [],
      });
    } finally {
      await pool.query('DROP TRIGGER phase8_fail_status ON ballots');
      await pool.query('DROP FUNCTION phase8_fail_status()');
    }
  });
});

async function reviewFixture() {
  const f = await interactionFixture();
  await pool.query(
    'UPDATE votings SET max_plus_votes=4,max_minus_votes=2 WHERE id=$1',
    [f.both],
  );
  await pool.query(
    `INSERT INTO voting_items(event_id,voting_id,team_id,name,display_order)
    SELECT event_id,$2,team_id,name,display_order FROM voting_items WHERE voting_id=$1`,
    [f.t, f.both],
  );
  async function save(stepId: string, entries = f.entries(2, 1)) {
    const response = await request(
      'PUT',
      draftPath(stepId),
      { expectedRevision: null, entries },
      f.session,
    );
    expect(response.statusCode).toBe(200);
    return {
      stepId,
      expectedRevision: response.json().revision as number,
      entries,
    };
  }
  return { ...f, save };
}

describe('Phase 9 saved review and independent final submission', () => {
  it('reviews only current authorized categories, choices, validity and saved lifecycle without writing', async () => {
    const f = await reviewFixture();
    await f.save(f.t);
    await f.save(f.both, []);
    const before = await ballotState(f.event);
    const response = await request(
      'GET',
      '/wizard/review',
      undefined,
      f.session,
    );
    expect(response.statusCode).toBe(200);
    const review = wizardReviewSchema.parse(response.json());
    expect(review.categories.map((category) => category.step.id)).toEqual(
      review.current.steps.map((step) => step.id),
    );
    expect(
      review.categories.some((category) =>
        [f.v, f.draft].includes(category.step.id),
      ),
    ).toBe(false);
    const t = review.categories.find((category) => category.step.id === f.t)!;
    expect(t.ballot).toMatchObject({
      status: 'draft',
      revision: 1,
      entries: f.entries(2, 1),
      validation: { valid: true, plusUsed: 2, minusUsed: 1 },
    });
    expect(t.items).toHaveLength(7);
    expect(t.items[0]!.name).toBe('Team');
    expect(
      review.categories.find((category) => category.step.id === f.closed)!
        .ballot,
    ).toBeNull();
    expect(await ballotState(f.event)).toEqual(before);
    const v = sessionCookie(await enter(await issue(f.event, f.jurors[1])));
    const other = wizardReviewSchema.parse(
      (await request('GET', '/wizard/review', undefined, v)).json(),
    );
    expect(other.categories.map((category) => category.step.id)).toContain(f.v);
    expect(other.categories.some((category) => category.step.id === f.t)).toBe(
      false,
    );
    expect(other.categories.every((category) => category.ballot === null)).toBe(
      true,
    );
  });
  it('submits only selected saved versions, preserves others, replays safely and restores confirmation after later return', async () => {
    const f = await reviewFixture();
    const first = await f.save(f.t);
    const second = await f.save(f.both, []);
    const before = await ballotState(f.event);
    const payload = { categories: [first] };
    const response = await request(
      'POST',
      '/wizard/final-submit',
      payload,
      f.session,
    );
    expect(response.statusCode).toBe(200);
    const result = wizardFinalSubmitSchema.parse(response.json());
    expect(result.results[0]).toMatchObject({
      stepId: f.t,
      outcome: 'submitted',
      ballot: { revision: 2, status: 'submitted' },
    });
    const after = await ballotState(f.event);
    expect(after.history).toHaveLength(1);
    expect(after.ballots.find((ballot) => ballot.voting_id === f.both)).toEqual(
      before.ballots.find((ballot) => ballot.voting_id === f.both),
    );
    expect(
      (
        await request('POST', '/wizard/final-submit', payload, f.session)
      ).json(),
    ).toEqual(result);
    expect(await ballotState(f.event)).toEqual(after);
    const recovered = sessionCookie(
      await enter(await issue(f.event, f.jurors[0])),
    );
    const review = wizardReviewSchema.parse(
      (await request('GET', '/wizard/review', undefined, recovered)).json(),
    );
    expect(
      review.categories.find((category) => category.step.id === f.t)!.ballot
        ?.submittedAt,
    ).toBeTruthy();
    expect(
      (
        await request(
          'POST',
          '/wizard/final-submit',
          { categories: [second] },
          recovered,
        )
      ).json().results[0],
    ).toMatchObject({ outcome: 'submitted', ballot: { entries: [] } });
    expect((await ballotState(f.event)).history).toHaveLength(2);
  });
  it('reports stale, invalid, closed and concealed categories separately while another category commits', async () => {
    const f = await reviewFixture();
    const first = await f.save(f.t);
    const second = await f.save(f.both, []);
    await request(
      'PUT',
      draftPath(f.t),
      { ...first, stepId: undefined, entries: f.entries(1, 0) },
      f.session,
    );
    const response = await request(
      'POST',
      '/wizard/final-submit',
      {
        categories: [
          first,
          { stepId: f.closed, expectedRevision: 0, entries: [] },
          { stepId: f.v, expectedRevision: 0, entries: [] },
          second,
        ],
      },
      f.session,
    );
    expect(response.statusCode).toBe(200);
    expect(
      response
        .json()
        .results.map(
          (result: { outcome: string; code?: string }) =>
            result.code ?? result.outcome,
        ),
    ).toEqual(['DRAFT_CONFLICT', 'DRAFT_CONFLICT', 'NOT_FOUND', 'submitted']);
    const invalid = await request(
      'PUT',
      draftPath(f.t),
      { expectedRevision: 2, entries: f.entries(1, 1) },
      f.session,
    );
    expect(invalid.statusCode).toBe(200);
    const rejected = await request(
      'POST',
      '/wizard/final-submit',
      {
        categories: [
          { ...first, expectedRevision: 3, entries: f.entries(1, 1) },
        ],
      },
      f.session,
    );
    expect(rejected.json().results[0].code).toBe('INVALID_BALLOT');
    await request('POST', `/votings/${f.t}/close`, {});
    const closed = await request(
      'POST',
      '/wizard/final-submit',
      {
        categories: [
          { ...first, expectedRevision: 3, entries: f.entries(1, 1) },
        ],
      },
      f.session,
    );
    expect(closed.json().results[0].code).toBe('VOTING_UNAVAILABLE');
  });
  it('rejects fabricated choices even at the current revision and never creates absent empty ballots', async () => {
    const f = await reviewFixture();
    const saved = await f.save(f.t);
    const before = await ballotState(f.event);
    for (const category of [
      { ...saved, entries: f.entries(1, 0) },
      { stepId: f.both, expectedRevision: 0, entries: [] },
    ]) {
      const response = await request(
        'POST',
        '/wizard/final-submit',
        { categories: [category] },
        f.session,
      );
      expect(response.json().results[0].code).toBe('DRAFT_CONFLICT');
    }
    expect(await ballotState(f.event)).toEqual(before);
  });
  it('rejects all malformed envelopes before any write and retains guards/no-store', async () => {
    const f = await reviewFixture();
    const saved = await f.save(f.t);
    const before = await ballotState(f.event);
    for (const body of [
      {},
      { categories: [] },
      { categories: [saved, saved] },
      { categories: [{ ...saved, expectedRevision: null }] },
      { categories: [{ ...saved, expectedRevision: -1 }] },
      { categories: [{ ...saved, jurorId: f.jurors[1] }] },
      { categories: [saved], eventId: f.event },
      {
        categories: [
          { ...saved, entries: [{ votingItemId: f.ids[0], voteValue: 0 }] },
        ],
      },
    ])
      expect(
        (await request('POST', '/wizard/final-submit', body, f.session))
          .statusCode,
      ).toBe(400);
    for (const session of ['', `d21-session=${newSecret()}`, cookie]) {
      const expected = session === cookie ? 403 : 401;
      expect(
        (await request('GET', '/wizard/review', undefined, session)).statusCode,
      ).toBe(expected);
      expect(
        (
          await request(
            'POST',
            '/wizard/final-submit',
            { categories: [saved] },
            session,
          )
        ).statusCode,
      ).toBe(expected);
    }
    for (const extra of [{}, { ...headers, origin: 'https://untrusted.test' }])
      expect(
        (
          await request(
            'POST',
            '/wizard/final-submit',
            { categories: [saved] },
            f.session,
            extra,
          )
        ).statusCode,
      ).toBe(403);
    expect(
      (
        await request(
          'GET',
          '/wizard/review?eventId=forged',
          undefined,
          f.session,
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request(
          'POST',
          '/wizard/final-submit?jurorId=forged',
          { categories: [saved] },
          f.session,
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (await request('GET', '/wizard/review', undefined, f.session)).headers[
        'cache-control'
      ],
    ).toBe('no-store');
    expect(await ballotState(f.event)).toEqual(before);
  });
  it('serializes concurrent matching final actions without duplicate revisions or history', async () => {
    const f = await reviewFixture();
    const payload = {
      categories: [await f.save(f.t), await f.save(f.both, [])],
    };
    const [a, b] = await Promise.all([
      request('POST', '/wizard/final-submit', payload, f.session),
      request('POST', '/wizard/final-submit', payload, f.session),
    ]);
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(a.json()).toEqual(b.json());
    const after = await ballotState(f.event);
    expect(
      after.ballots.every(
        (ballot) => ballot.revision === 2 && ballot.status === 'submitted',
      ),
    ).toBe(true);
    expect(after.history).toHaveLength(2);
  });
  it('does not resubmit an administrator-unlocked draft on an old final retry', async () => {
    const f = await reviewFixture();
    const payload = { categories: [await f.save(f.t)] };
    await request('POST', '/wizard/final-submit', payload, f.session);
    const ballot = (await ballotState(f.event)).ballots[0]!;
    expect(
      (
        await request('POST', `/votings/${f.t}/ballots/${ballot.id}/unlock`, {
          expectedRevision: 2,
        })
      ).statusCode,
    ).toBe(200);
    const before = await ballotState(f.event);
    expect(
      (await request('POST', '/wizard/final-submit', payload, f.session)).json()
        .results[0].code,
    ).toBe('DRAFT_CONFLICT');
    expect(await ballotState(f.event)).toEqual(before);
    const review = wizardReviewSchema.parse(
      (await request('GET', '/wizard/review', undefined, f.session)).json(),
    );
    const category = review.categories.find(
      (category) => category.step.id === f.t,
    )!;
    expect(category.ballot).toMatchObject({
      status: 'draft',
      revision: 3,
      entries: f.entries(2, 1),
    });
  });
  it('rolls back a failed category storage write, preserves an earlier commit, then safely retries the full request', async () => {
    const f = await reviewFixture();
    const payload = {
      categories: [await f.save(f.t), await f.save(f.both, [])],
    };
    await pool.query(`CREATE FUNCTION phase9_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.target_id=(SELECT id FROM ballots WHERE voting_id='${f.both}') THEN RAISE EXCEPTION 'fixture failure'; END IF; RETURN NEW; END $$`);
    await pool.query(
      'CREATE TRIGGER phase9_fail_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION phase9_fail_audit()',
    );
    try {
      expect(
        (await request('POST', '/wizard/final-submit', payload, f.session))
          .statusCode,
      ).toBe(500);
      const state = await ballotState(f.event);
      expect(
        state.ballots.find((ballot) => ballot.voting_id === f.t),
      ).toMatchObject({ status: 'submitted', revision: 2 });
      expect(
        state.ballots.find((ballot) => ballot.voting_id === f.both),
      ).toMatchObject({ status: 'draft', revision: 1 });
      expect(state.history).toHaveLength(1);
    } finally {
      await pool.query('DROP TRIGGER phase9_fail_audit ON audit_logs');
      await pool.query('DROP FUNCTION phase9_fail_audit()');
    }
    const response = await request(
      'POST',
      '/wizard/final-submit',
      payload,
      f.session,
    );
    expect(
      response
        .json()
        .results.every(
          (result: { outcome: string }) => result.outcome === 'submitted',
        ),
    ).toBe(true);
    expect((await ballotState(f.event)).history).toHaveLength(2);
  });
  it.each([
    'closure',
    'revocation',
    'expiry',
    'group',
    'configuration',
    'revision',
  ] as const)(
    'rechecks %s after an actual final-submit event-lock wait',
    async (change) => {
      const f = await reviewFixture();
      const payload = { categories: [await f.save(f.t)] };
      const before = await ballotState(f.event);
      const client = await pool.connect();
      await client.query('BEGIN');
      await client.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
        f.event,
      ]);
      const running = request(
        'POST',
        '/wizard/final-submit',
        payload,
        f.session,
      ).then((value) => value);
      try {
        await waitForEventLock();
        if (change === 'closure')
          await client.query("UPDATE votings SET status='closed' WHERE id=$1", [
            f.t,
          ]);
        if (change === 'revocation')
          await client.query(
            'UPDATE sessions SET revoked_at=now() WHERE juror_id=$1',
            [f.jurors[0]],
          );
        if (change === 'expiry')
          await client.query(
            "UPDATE sessions SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE juror_id=$1",
            [f.jurors[0]],
          );
        if (change === 'group')
          await client.query(
            'DELETE FROM voting_allowed_groups WHERE voting_id=$1',
            [f.t],
          );
        if (change === 'configuration')
          await client.query(
            'UPDATE votings SET max_plus_votes=NULL WHERE id=$1',
            [f.t],
          );
        if (change === 'revision')
          await client.query(
            'UPDATE ballots SET revision=revision+1 WHERE voting_id=$1',
            [f.t],
          );
        await client.query('COMMIT');
        const response = await running;
        if (change === 'revocation' || change === 'expiry')
          expect(response.statusCode).toBe(401);
        else
          expect(response.json().results[0].code).toBe(
            {
              closure: 'VOTING_UNAVAILABLE',
              group: 'NOT_FOUND',
              configuration: 'CONFIGURATION_NOT_READY',
              revision: 'DRAFT_CONFLICT',
            }[change],
          );
        const after = await ballotState(f.event);
        expect(after.entries).toEqual(before.entries);
        expect(after.history).toEqual(before.history);
        expect(after.ballots[0]!.status).toBe('draft');
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    },
  );
  it('review rechecks session expiry after waiting for its shared event lock', async () => {
    const f = await reviewFixture();
    await f.save(f.t);
    const client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
      f.event,
    ]);
    const running = request('GET', '/wizard/review', undefined, f.session).then(
      (value) => value,
    );
    try {
      await waitForEventLock();
      await client.query(
        "UPDATE sessions SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE juror_id=$1",
        [f.jurors[0]],
      );
      await client.query('COMMIT');
      expect((await running).statusCode).toBe(401);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});

describe('Phase 9 interrupted operations and current review state', () => {
  it('stops on authorization loss between category commits and reconciles on later recovery', async () => {
    const f = await reviewFixture();
    const payload = {
      categories: [await f.save(f.t), await f.save(f.both, [])],
    };
    await pool.query(`CREATE FUNCTION phase9_expire_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.target_id=(SELECT id FROM ballots WHERE voting_id='${f.t}') THEN
        UPDATE sessions SET created_at=statement_timestamp()-interval '2 hours',expires_at=statement_timestamp()-interval '1 hour' WHERE juror_id='${f.jurors[0]}';
      END IF; RETURN NEW; END $$`);
    await pool.query(
      'CREATE TRIGGER phase9_expire_session AFTER INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION phase9_expire_session()',
    );
    try {
      expect(
        (await request('POST', '/wizard/final-submit', payload, f.session))
          .statusCode,
      ).toBe(401);
      const state = await ballotState(f.event);
      expect(
        state.ballots.find((ballot) => ballot.voting_id === f.t),
      ).toMatchObject({ status: 'submitted', revision: 2 });
      expect(
        state.ballots.find((ballot) => ballot.voting_id === f.both),
      ).toMatchObject({ status: 'draft', revision: 1 });
      expect(state.history).toHaveLength(1);
    } finally {
      await pool.query('DROP TRIGGER phase9_expire_session ON audit_logs');
      await pool.query('DROP FUNCTION phase9_expire_session()');
    }
    const recovered = sessionCookie(
      await enter(await issue(f.event, f.jurors[0])),
    );
    expect(
      (await request('POST', '/wizard/final-submit', payload, recovered))
        .json()
        .results.every(
          (result: { outcome: string }) => result.outcome === 'submitted',
        ),
    ).toBe(true);
    expect((await ballotState(f.event)).history).toHaveLength(2);
  });
  it('reviews invalid and closed saved drafts, submitted choices and descriptive corrections from current data', async () => {
    const f = await reviewFixture();
    const saved = await f.save(f.t, f.entries(1, 1));
    const empty = await f.save(f.both, []);
    await request(
      'POST',
      '/wizard/final-submit',
      { categories: [empty] },
      f.session,
    );
    await request('POST', `/votings/${f.t}/close`, {});
    await pool.query("UPDATE teams SET name='Corrected label' WHERE id=$1", [
      f.team,
    ]);
    const review = wizardReviewSchema.parse(
      (await request('GET', '/wizard/review', undefined, f.session)).json(),
    );
    const category = review.categories.find(
      (category) => category.step.id === f.t,
    )!;
    expect(category.step.progress).toBe('invalid_draft');
    expect(category.ballot).toMatchObject({
      revision: saved.expectedRevision,
      entries: saved.entries,
      status: 'draft',
    });
    expect(category.ballot!.validation.issues).toEqual(
      expect.arrayContaining(['VOTING_UNAVAILABLE', 'NEGATIVE_ELIGIBILITY']),
    );
    expect(category.items[0]!.name).toBe('Corrected label');
    expect(
      review.categories.find((category) => category.step.id === f.both)!.ballot,
    ).toMatchObject({
      status: 'submitted',
      entries: [],
      progress: 'submitted',
    });
  });
  it('keeps replay confirmation harmless after closure and rejects an old request after replacement', async () => {
    const f = await reviewFixture();
    const saved = await f.save(f.t);
    const payload = { categories: [saved] };
    const result = (
      await request('POST', '/wizard/final-submit', payload, f.session)
    ).json();
    await request('POST', `/votings/${f.t}/close`, {});
    const before = await ballotState(f.event);
    const replay = (
      await request(
        'POST',
        '/wizard/final-submit',
        {
          categories: [{ ...saved, entries: [...saved.entries].reverse() }],
        },
        f.session,
      )
    ).json();
    expect(replay.results[0]).toMatchObject({
      outcome: 'submitted',
      ballot: {
        revision: result.results[0].ballot.revision,
        submittedAt: result.results[0].ballot.submittedAt,
        savedAt: result.results[0].ballot.savedAt,
        entries: result.results[0].ballot.entries,
        validation: { valid: false, issues: ['VOTING_UNAVAILABLE'] },
      },
    });
    expect(await ballotState(f.event)).toEqual(before);
    const ballot = before.ballots[0]!;
    await request('POST', unlockPath(f.t, ballot.id), { expectedRevision: 2 });
    await request('POST', `/votings/${f.t}/reopen`, {});
    await request(
      'POST',
      submitPath(f.t),
      { expectedRevision: 3, entries: f.entries(1, 0) },
      f.session,
    );
    const replacement = await ballotState(f.event);
    expect(
      (await request('POST', '/wizard/final-submit', payload, f.session)).json()
        .results[0].code,
    ).toBe('BALLOT_NOT_EDITABLE');
    expect(await ballotState(f.event)).toEqual(replacement);
  });
  it('final submission racing a draft save leaves a consistent winner and no overwritten choices', async () => {
    const f = await reviewFixture();
    const saved = await f.save(f.t);
    const [final, update] = await Promise.all([
      request(
        'POST',
        '/wizard/final-submit',
        { categories: [saved] },
        f.session,
      ),
      request(
        'PUT',
        draftPath(f.t),
        { expectedRevision: 1, entries: f.entries(1, 0) },
        f.session,
      ),
    ]);
    const state = await ballotState(f.event);
    if (update.statusCode === 200) {
      expect(final.json().results[0].code).toBe('DRAFT_CONFLICT');
      expect(state.history).toHaveLength(0);
      expect(state.ballots[0]!.status).toBe('draft');
      expect(state.entries).toHaveLength(1);
    } else {
      expect(update.statusCode).toBe(409);
      expect(final.json().results[0].outcome).toBe('submitted');
      expect(state.history).toHaveLength(1);
      expect(state.ballots[0]!.status).toBe('submitted');
      expect(state.entries).toHaveLength(3);
    }
    expect(state.ballots[0]!.revision).toBe(2);
  });
});
