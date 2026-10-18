import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dashboardOverviewSchema, dashboardDetailSchema } from '@d21/contracts';
import { readEnvironment } from '../../config';
import { dropTestDatabase } from '../../db/test-database';
import { buildApp } from '../../app';
import { createAuthService, setAdminPassword } from '../auth/service';
import { createDashboardService } from './service';
import { createWizardService } from '../wizard/service';
import { createBallotAdminService } from '../ballots/admin';
import { newSecret, secretHash } from '../auth/crypto';

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
const ballotAdmin = createBallotAdminService(pool, auth);
const service = createDashboardService(pool, auth);
let app: ReturnType<typeof buildApp>;
let token: string;
let cookie: string;
let created = false;

async function fixture() {
  const event = (
    await pool.query(
      "INSERT INTO events(name) VALUES ('Dashboard event') RETURNING id",
    )
  ).rows[0].id as string;
  const groups: string[] = [],
    jurors: string[] = [],
    tokens: string[] = [];
  for (const code of ['T', 'V']) {
    const group = (
      await pool.query(
        'INSERT INTO jury_groups(event_id,code,name) VALUES ($1,$2::jury_group_code,$2::text) RETURNING id',
        [event, code],
      )
    ).rows[0].id;
    groups.push(group);
    for (let i = 0; i < 2; i++) {
      const juror = (
        await pool.query(
          "INSERT INTO event_jurors(event_id,jury_group_id,display_name) VALUES ($1,$2,'Same Name') RETURNING id",
          [event, group],
        )
      ).rows[0].id;
      jurors.push(juror);
      const secret = newSecret();
      tokens.push(secret);
      await pool.query(
        "INSERT INTO sessions(token_hash,event_id,juror_id,expires_at) VALUES ($1,$2,$3,now()+interval '12 hours')",
        [secretHash(secret), event, juror],
      );
    }
  }
  async function voting(allowed = groups, status = 'active', kind = 'final') {
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
    const items: string[] = [];
    for (let i = 0; i < 5; i++) {
      const team = (
        await pool.query(
          "INSERT INTO teams(event_id,name) VALUES ($1,'Team') RETURNING id",
          [event],
        )
      ).rows[0].id;
      items.push(
        (
          await pool.query(
            "INSERT INTO voting_items(event_id,voting_id,team_id,name,display_order) VALUES ($1,$2,$3,'Team',$4) RETURNING id",
            [event, id, team, i],
          )
        ).rows[0].id,
      );
    }
    return { id, items };
  }
  const t = await voting([groups[0]!]);
  const v = await voting([groups[1]!]);
  const both = await voting(groups, 'active', 'selection');
  const draft = await voting(groups, 'draft');
  return { event, groups, jurors, tokens, t, v, both, draft, voting };
}
const get = (path: string, session = cookie) =>
  app.inject({
    method: 'GET',
    url: path,
    headers: session ? { cookie: session } : {},
  });
const overview = async (event: string) => {
  const response = await get(`/dashboard/overview?eventId=${event}`);
  expect(response.statusCode).toBe(200);
  return dashboardOverviewSchema.parse(response.json());
};
beforeAll(async () => {
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await migrate(drizzle(pool), {
    migrationsFolder: fileURLToPath(
      new URL('../../db/migrations', import.meta.url),
    ),
  });
  await setAdminPassword(pool, 'Disposable Phase Ten password');
  const login = await auth.login('Disposable Phase Ten password');
  token = login!.token;
  cookie = `d21-session=${token}`;
  app = buildApp({
    checkDatabase: async () => {},
    auth: {
      service: auth,
      origin: 'http://127.0.0.1:5173',
      dashboard: service,
      wizard,
      ballotAdmin,
    },
  });
});
afterAll(async () => {
  await app?.close();
  await pool.end();
  if (created) await dropTestDatabase(admin, name);
  await admin.end();
});

describe('operational dashboard against PostgreSQL', () => {
  it('counts eligible T/V assignments once; excludes drafts from totals and distinguishes duplicate names', async () => {
    const f = await fixture();
    const data = await overview(f.event);
    expect(data.totals).toEqual({
      expected: 8,
      submitted: 0,
      pending: 8,
      invalid: 0,
      locked: 0,
      categories: 3,
      completedCategories: 0,
      pendingJurors: 4,
      problemCategories: 0,
    });
    expect(data.categories[0]!.id).toBe(f.both.id);
    expect(
      data.categories
        .find((c) => c.id === f.t.id)!
        .jurors.map((j) => j.id)
        .sort(),
    ).toEqual(f.jurors.slice(0, 2).sort());
    expect(data.categories.find((c) => c.id === f.v.id)!.counts.expected).toBe(
      2,
    );
    expect(
      data.categories
        .find((c) => c.id === f.both.id)!
        .groupCounts.map((g) => g.counts.expected),
    ).toEqual([2, 2]);
    expect(data.categories.find((c) => c.id === f.draft.id)!.state).toBe(
      'ready',
    );
  });
  it('derives absent, empty, valid, invalid and cancelled progress from saved records without writes', async () => {
    const f = await fixture();
    await wizard.saveDraft(f.tokens[0], f.both.id, {
      expectedRevision: null,
      entries: [],
    });
    await wizard.saveDraft(f.tokens[1], f.both.id, {
      expectedRevision: null,
      entries: [{ votingItemId: f.both.items[0]!, voteValue: -1 }],
    });
    await pool.query(
      "INSERT INTO ballots(event_id,voting_id,juror_id,status) VALUES ($1,$2,$3,'cancelled')",
      [f.event, f.both.id, f.jurors[2]],
    );
    const before = (
      await pool.query(
        'SELECT (SELECT count(*) FROM ballots)::int AS ballots,(SELECT count(*) FROM audit_logs)::int AS history',
      )
    ).rows[0];
    const data = await overview(f.event);
    const c = data.categories.find((c) => c.id === f.both.id)!;
    expect(c.jurors.find((j) => j.id === f.jurors[0])!.progress).toBe(
      'in_progress',
    );
    expect(c.jurors.find((j) => j.id === f.jurors[1])!.progress).toBe(
      'invalid_draft',
    );
    expect(c.jurors.find((j) => j.id === f.jurors[2])!.progress).toBe('locked');
    expect(c.jurors.find((j) => j.id === f.jurors[3])!.progress).toBe(
      'not_started',
    );
    expect(c.counts).toEqual({
      expected: 4,
      submitted: 0,
      pending: 4,
      invalid: 1,
      locked: 1,
    });
    expect(c.problems).toEqual(['INVALID_DRAFT', 'LOCKED_BALLOT']);
    expect(
      (
        await pool.query(
          'SELECT (SELECT count(*) FROM ballots)::int AS ballots,(SELECT count(*) FROM audit_logs)::int AS history',
        )
      ).rows[0],
    ).toEqual(before);
    expect(JSON.stringify(data)).not.toMatch(
      /voteValue|votingItemId|entries|token_hash|password|revision/,
    );
  });
  it('counts current submissions once across retries, unlock and replacement, never history', async () => {
    const f = await fixture();
    const input = { expectedRevision: null, entries: [] };
    await wizard.submit(f.tokens[0], f.t.id, input);
    await wizard.submit(f.tokens[0], f.t.id, input);
    expect((await overview(f.event)).totals.submitted).toBe(1);
    const b = (await ballotAdmin.list(token, f.t.id))[0]!;
    await ballotAdmin.unlock(token, f.t.id, b.id, b.revision);
    expect((await overview(f.event)).totals.submitted).toBe(0);
    const draft = (await wizard.step(f.tokens[0], f.t.id)).ballot!;
    await wizard.submit(f.tokens[0], f.t.id, {
      expectedRevision: draft.revision,
      entries: [],
    });
    const data = await overview(f.event);
    expect(data.totals.submitted).toBe(1);
    expect(data.totals.pendingJurors).toBe(4); // This juror still owes the shared category.
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM audit_logs WHERE event_id=$1',
          [f.event],
        )
      ).rows[0].n,
    ).toBe(3);
  });
  it('marks completion only when all eligible jurors submitted; closure preserves completion and draft quality', async () => {
    const f = await fixture();
    for (let i = 0; i < 2; i++)
      await wizard.submit(f.tokens[i], f.t.id, {
        expectedRevision: null,
        entries: [],
      });
    await wizard.saveDraft(f.tokens[0], f.both.id, {
      expectedRevision: null,
      entries: [],
    });
    await pool.query(
      "UPDATE votings SET status='closed' WHERE id=ANY($1::uuid[])",
      [[f.t.id, f.both.id]],
    );
    const data = await overview(f.event);
    expect(data.totals.completedCategories).toBe(1);
    expect(data.categories.find((c) => c.id === f.t.id)!.state).toBe('done');
    const closed = data.categories.find((c) => c.id === f.both.id)!;
    expect(closed.problems).toEqual(['UNAVAILABLE_PENDING']);
    expect(closed.jurors.find((j) => j.id === f.jurors[0])!.progress).toBe(
      'in_progress',
    );
    expect(closed.counts.invalid).toBe(0);
  });
  it('handles empty events, draft-only setup and zero eligibility without false 100% completion', async () => {
    const event = (
      await pool.query("INSERT INTO events(name) VALUES ('Empty') RETURNING id")
    ).rows[0].id;
    const empty = await overview(event);
    expect(empty.categories).toEqual([]);
    expect(empty.totals.expected).toBe(0);
    const f = await fixture();
    const zero = await f.voting([]);
    const c = (await overview(f.event)).categories.find(
      (c) => c.id === zero.id,
    )!;
    expect(c.counts.expected).toBe(0);
    expect(c.state).toBe('problem');
    expect(c.problems).toContain('NO_ELIGIBLE_JURORS');
    await pool.query("UPDATE votings SET status='draft' WHERE event_id=$1", [
      f.event,
    ]);
    const setup = await overview(f.event);
    expect(setup.totals.expected).toBe(0);
    expect(setup.totals.pendingJurors).toBe(0);
    expect(setup.totals.completedCategories).toBe(0);
  });
  it('excludes ineligible stored ballots and isolates other events', async () => {
    const f = await fixture();
    const other = await fixture();
    await wizard.submit(other.tokens[0], other.t.id, {
      expectedRevision: null,
      entries: [],
    });
    await pool.query(
      "INSERT INTO ballots(event_id,voting_id,juror_id,status,submitted_at) VALUES ($1,$2,$3,'submitted',now())",
      [f.event, f.t.id, f.jurors[2]],
    );
    const data = await overview(f.event);
    expect(data.totals.submitted).toBe(0);
    expect(data.totals.expected).toBe(8);
    expect(data.categories.find((c) => c.id === f.t.id)!.problems).toContain(
      'INELIGIBLE_BALLOTS',
    );
    expect(JSON.stringify(data)).not.toContain(other.event);
    expect(
      data.categories.find((c) => c.id === f.t.id)!.jurors.map((j) => j.id),
    ).not.toContain(f.jurors[2]);
    expect(
      (
        await get(
          `/dashboard/overview?eventId=${f.event}&jurorId=${other.jurors[0]}`,
        )
      ).statusCode,
    ).toBe(400);
  });
  it('flags invalid current submissions without silently reclassifying their storage state', async () => {
    const f = await fixture();
    await wizard.submit(f.tokens[0], f.t.id, {
      expectedRevision: null,
      entries: [],
    });
    const b = (await ballotAdmin.list(token, f.t.id))[0]!;
    await pool.query(
      'INSERT INTO ballot_entries(event_id,voting_id,ballot_id,voting_item_id,vote_value) VALUES ($1,$2,$3,$4,-1)',
      [f.event, f.t.id, b.id, f.t.items[0]],
    );
    const c = (await overview(f.event)).categories.find(
      (c) => c.id === f.t.id,
    )!;
    expect(c.counts.submitted).toBe(1);
    expect(c.problems).toContain('INVALID_SUBMISSION');
    expect(c.state).toBe('problem');
  });
  it('detects incomplete rules and unlinked items; names remain current', async () => {
    const f = await fixture();
    await pool.query(
      'UPDATE votings SET max_plus_votes=NULL,name=$2 WHERE id=$1',
      [f.t.id, 'Corrected category'],
    );
    await pool.query('UPDATE voting_items SET team_id=NULL WHERE id=$1', [
      f.t.items[0],
    ]);
    await pool.query('UPDATE event_jurors SET display_name=$2 WHERE id=$1', [
      f.jurors[0],
      'Corrected name',
    ]);
    const c = (await overview(f.event)).categories.find(
      (c) => c.id === f.t.id,
    )!;
    expect(c.problems).toEqual(['CONFIGURATION_NOT_READY', 'UNLINKED_ITEMS']);
    expect(c.name).toBe('Corrected category');
    expect(c.jurors.find((j) => j.id === f.jurors[0])!.displayName).toBe(
      'Corrected name',
    );
    await pool.query('UPDATE votings SET max_plus_votes=NULL WHERE id=$1', [
      f.draft.id,
    ]);
    expect(
      (await overview(f.event)).categories.find((c) => c.id === f.draft.id)!
        .state,
    ).toBe('problem');
  });
  it('returns category detail from the same projection, with no choices and no cache', async () => {
    const f = await fixture();
    const data = await overview(f.event);
    const response = await get(`/dashboard/votings/${f.both.id}`);
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(dashboardDetailSchema.parse(response.json()).category).toEqual(
      data.categories.find((c) => c.id === f.both.id),
    );
    expect(response.body).not.toMatch(/entries|voteValue|token_hash/);
  });
  it('rejects missing, malformed or forged scopes and extra query claims', async () => {
    const f = await fixture();
    for (const path of [
      '/dashboard/overview',
      '/dashboard/overview?eventId=nope',
      `/dashboard/overview?eventId=${f.event}&eventId=${f.event}`,
      `/dashboard/votings/${f.t.id}?group=T`,
      '/dashboard/votings/nope',
    ])
      expect((await get(path)).statusCode).toBe(400);
    for (const path of [
      `/dashboard/overview?eventId=${randomUUID()}`,
      `/dashboard/votings/${randomUUID()}`,
    ])
      expect((await get(path)).statusCode).toBe(404);
  });
  it('guards both endpoints against anonymous, fabricated, expired, revoked and juror sessions', async () => {
    const f = await fixture();
    const expired = newSecret(),
      revoked = newSecret();
    const id = (await auth.readSession(token))!.principal.id;
    await pool.query(
      "INSERT INTO sessions(token_hash,admin_user_id,created_at,expires_at,revoked_at) VALUES ($1,$3,now()-interval '2 hours',now()-interval '1 hour',NULL),($2,$3,now(),now()+interval '1 hour',now())",
      [secretHash(expired), secretHash(revoked), id],
    );
    for (const path of [
      `/dashboard/overview?eventId=${f.event}`,
      `/dashboard/votings/${f.t.id}`,
    ]) {
      for (const session of [
        '',
        `d21-session=${newSecret()}`,
        `d21-session=${expired}`,
        `d21-session=${revoked}`,
      ])
        expect((await get(path, session)).statusCode).toBe(401);
      expect((await get(path, `d21-session=${f.tokens[0]}`)).statusCode).toBe(
        403,
      );
    }
  });
  it('waits for event writes and observes one committed roster/permission/ballot snapshot', async () => {
    const f = await fixture();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
        f.event,
      ]);
      const pending = get(`/dashboard/overview?eventId=${f.event}`);
      let finished = false;
      const responsePromise = Promise.resolve(pending).then((r) => {
        finished = true;
        return r;
      });
      await waitForLock();
      expect(finished).toBe(false);
      await client.query(
        "INSERT INTO ballots(event_id,voting_id,juror_id,status,submitted_at) VALUES ($1,$2,$3,'submitted',now())",
        [f.event, f.both.id, f.jurors[0]],
      );
      await client.query("UPDATE votings SET status='closed' WHERE id=$1", [
        f.both.id,
      ]);
      await client.query('COMMIT');
      const result = dashboardOverviewSchema.parse(
        (await responsePromise).json(),
      );
      const c = result.categories.find((c) => c.id === f.both.id)!;
      expect(c.counts.submitted).toBe(1);
      expect(c.status).toBe('closed');
      expect(c.problems).toEqual(['UNAVAILABLE_PENDING']);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
  it.each(['revoke', 'expire'] as const)(
    'rechecks administration %s after actual event-lock wait',
    async (mode) => {
      const f = await fixture();
      const login = await auth.login('Disposable Phase Ten password');
      const secret = login!.token;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
          f.event,
        ]);
        const pending = Promise.resolve(
          get(
            `/dashboard/overview?eventId=${f.event}`,
            `d21-session=${secret}`,
          ),
        );
        await waitForLock();
        await client.query(
          mode === 'revoke'
            ? 'UPDATE sessions SET revoked_at=now() WHERE token_hash=$1'
            : "UPDATE sessions SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE token_hash=$1",
          [secretHash(secret)],
        );
        await client.query('COMMIT');
        expect((await pending).statusCode).toBe(401);
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    },
  );
});
async function waitForLock() {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (
      (
        await pool.query(
          "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%roster_locked_at%' ",
        )
      ).rowCount
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('No actual dashboard event-lock wait observed');
}
