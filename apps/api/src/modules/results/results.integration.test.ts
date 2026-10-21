import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resultsOverviewSchema, resultsDetailSchema } from '@d21/contracts';
import { readEnvironment } from '../../config';
import { dropTestDatabase } from '../../db/test-database';
import { buildApp } from '../../app';
import { createAuthService, setAdminPassword } from '../auth/service';
import { createResultsService } from './service';
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
const service = createResultsService(pool, auth);
let app: ReturnType<typeof buildApp>;
let token: string;
let cookie: string;
let created = false;

async function fixture() {
  const event = (
    await pool.query(
      "INSERT INTO events(name) VALUES ('Results event') RETURNING id",
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
  const response = await get(`/results/overview?eventId=${event}`);
  expect(response.statusCode).toBe(200);
  return resultsOverviewSchema.parse(response.json());
};
beforeAll(async () => {
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await migrate(drizzle(pool), {
    migrationsFolder: fileURLToPath(
      new URL('../../db/migrations', import.meta.url),
    ),
  });
  await setAdminPassword(pool, 'Disposable Phase Eleven password');
  const login = await auth.login('Disposable Phase Eleven password');
  token = login!.token;
  cookie = `d21-session=${token}`;
  app = buildApp({
    checkDatabase: async () => {},
    auth: {
      service: auth,
      origin: 'http://127.0.0.1:5173',
      results: service,
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

const entries = (items: string[], plus: number[], minus: number[] = []) => [
  ...plus.map((i) => ({ votingItemId: items[i]!, voteValue: 1 as const })),
  ...minus.map((i) => ({ votingItemId: items[i]!, voteValue: -1 as const })),
];
const detail = async (id: string) => {
  const response = await get(`/results/votings/${id}`);
  expect(response.statusCode).toBe(200);
  return resultsDetailSchema.parse(response.json()).category;
};
async function allSubmit(f: Awaited<ReturnType<typeof fixture>>) {
  for (const session of f.tokens)
    await wizard.submit(session, f.both.id, {
      expectedRevision: null,
      entries: entries(f.both.items, [0]),
    });
}
describe('current-submitted D21 results against PostgreSQL', () => {
  it('aggregates signs and score by category and shared team identity, including zero and negative totals', async () => {
    const f = await fixture();
    await pool.query(
      'UPDATE voting_items SET team_id=(SELECT team_id FROM voting_items WHERE id=$1) WHERE id=$2',
      [f.both.items[0], f.t.items[4]],
    );
    await wizard.submit(f.tokens[0], f.both.id, {
      expectedRevision: null,
      entries: entries(f.both.items, [0, 1], [2]),
    });
    await wizard.submit(f.tokens[1], f.both.id, {
      expectedRevision: null,
      entries: entries(f.both.items, [0, 2], [3]),
    });
    await wizard.submit(f.tokens[2], f.both.id, {
      expectedRevision: null,
      entries: entries(f.both.items, [1, 2], [4]),
    });
    await wizard.submit(f.tokens[3], f.both.id, {
      expectedRevision: null,
      entries: [],
    });
    await wizard.submit(f.tokens[0], f.t.id, {
      expectedRevision: null,
      entries: entries(f.t.items, [4]),
    });
    const c = await detail(f.both.id);
    const byId = new Map(c.rows.map((r) => [r.id, r]));
    expect(
      f.both.items.map((id) => {
        const r = byId.get(id)!;
        return [r.plus, r.minus, r.score, r.rank];
      }),
    ).toEqual([
      [2, 0, 2, 1],
      [2, 0, 2, 1],
      [2, 1, 1, 3],
      [0, 1, -1, 4],
      [0, 1, -1, 4],
    ]);
    expect(c.boundaryTie).toBe(true);
    expect(c.rows.filter((r) => r.selection === 'selected')).toHaveLength(0);
    expect(
      c.rows
        .filter((r) => r.selection === 'unresolved')
        .map((r) => r.id)
        .sort(),
    ).toEqual(f.both.items.slice(0, 2).sort());
    expect(c.counts.submitted).toBe(4);
    expect(c.stage).toBe('provisional');
    expect(
      (await detail(f.t.id)).rows.find((r) => r.id === f.t.items[4])!.plus,
    ).toBe(1);
    expect(
      (await detail(f.v.id)).rows.every((r) => r.plus === 0 && r.minus === 0),
    ).toBe(true);
    expect(new Set(c.rows.map((r) => r.teamId)).size).toBe(5);
    const all = await overview(f.event);
    expect(all.categories.find((r) => r.id === f.both.id)).toEqual(c);
  });
  it('selects multiple teams when a whole tied group fits, with no invented internal tie-break', async () => {
    const f = await fixture();
    await pool.query(
      'UPDATE votings SET selected_places=2,max_plus_votes=3 WHERE id=$1',
      [f.both.id],
    );
    await wizard.submit(f.tokens[0], f.both.id, {
      expectedRevision: null,
      entries: entries(f.both.items, [0, 1]),
    });
    const c = await detail(f.both.id);
    expect(c.boundaryTie).toBe(false);
    expect(
      c.rows
        .filter((r) => r.selection === 'selected')
        .map((r) => [r.id, r.rank]),
    ).toEqual([
      [f.both.items[0], 1],
      [f.both.items[1], 1],
    ]);
  });
  it('selects only teams above a multiwinner cutoff tie, leaving the entire crossing group unresolved', async () => {
    const f = await fixture();
    await pool.query(
      'UPDATE votings SET selected_places=2,max_plus_votes=3 WHERE id=$1',
      [f.both.id],
    );
    await wizard.submit(f.tokens[0], f.both.id, {
      expectedRevision: null,
      entries: entries(f.both.items, [0, 1, 2]),
    });
    await wizard.submit(f.tokens[1], f.both.id, {
      expectedRevision: null,
      entries: entries(f.both.items, [0]),
    });
    const c = await detail(f.both.id);
    expect(c.rows.map((r) => [r.rank, r.selection])).toEqual([
      [1, 'selected'],
      [2, 'unresolved'],
      [2, 'unresolved'],
      [4, 'outside'],
      [4, 'outside'],
    ]);
    expect(c.boundaryTie).toBe(true);
  });
  it('counts only current submissions through retry, unlock, invalid draft and replacement; history never inflates totals', async () => {
    const f = await fixture();
    const original = entries(f.both.items, [0, 1], [2]);
    const saved = await wizard.submit(f.tokens[0], f.both.id, {
      expectedRevision: null,
      entries: original,
    });
    await wizard.submit(f.tokens[0], f.both.id, {
      expectedRevision: null,
      entries: [...original].reverse(),
    });
    await wizard.saveDraft(f.tokens[1], f.both.id, {
      expectedRevision: null,
      entries: entries(f.both.items, [], [0]),
    });
    expect((await detail(f.both.id)).rows.reduce((n, r) => n + r.plus, 0)).toBe(
      2,
    );
    const ballot = (await ballotAdmin.list(token, f.both.id)).find(
      (b) => b.jurorId === f.jurors[0],
    )!;
    const unlocked = await ballotAdmin.unlock(
      token,
      f.both.id,
      ballot.id,
      ballot.revision,
    );
    expect(
      (await detail(f.both.id)).rows.every(
        (r) => r.plus === 0 && r.minus === 0,
      ),
    ).toBe(true);
    await wizard.submit(f.tokens[0], f.both.id, {
      expectedRevision: unlocked.revision,
      entries: entries(f.both.items, [3]),
    });
    const c = await detail(f.both.id);
    expect(c.counts.submitted).toBe(1);
    expect(c.rows.reduce((n, r) => n + r.plus, 0)).toBe(1);
    expect(c.rows.find((r) => r.id === f.both.items[3])!.plus).toBe(1);
    expect(c.rows.find((r) => r.id === f.both.items[0])!.plus).toBe(0);
    expect(c.problems).toContain('INVALID_DRAFT');
    expect(saved!.revision).toBe(1);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM audit_logs WHERE event_id=$1',
          [f.event],
        )
      ).rows[0].n,
    ).toBe(3);
  });
  it('requires closure, full participation and no problems or cutoff tie for final results; reopen/unlock reverse finality', async () => {
    const f = await fixture();
    await allSubmit(f);
    expect((await detail(f.both.id)).reasons).toEqual(['NOT_CLOSED']);
    await pool.query("UPDATE votings SET status='closed' WHERE id=$1", [
      f.both.id,
    ]);
    const final = await detail(f.both.id);
    expect(final.stage).toBe('final');
    expect(final.reasons).toEqual([]);
    expect(final.rows[0]!.selection).toBe('selected');
    await pool.query("UPDATE votings SET status='archived' WHERE id=$1", [
      f.both.id,
    ]);
    expect((await detail(f.both.id)).stage).toBe('final');
    const ballot = (await ballotAdmin.list(token, f.both.id))[0]!;
    const unlocked = await ballotAdmin.unlock(
      token,
      f.both.id,
      ballot.id,
      ballot.revision,
    );
    expect((await detail(f.both.id)).stage).toBe('provisional');
    expect((await detail(f.both.id)).counts.submitted).toBe(3);
    await pool.query("UPDATE votings SET status='active' WHERE id=$1", [
      f.both.id,
    ]);
    const jurorIndex = f.jurors.indexOf(ballot.jurorId);
    await wizard.submit(f.tokens[jurorIndex], f.both.id, {
      expectedRevision: unlocked.revision,
      entries: entries(f.both.items, [0]),
    });
    expect((await detail(f.both.id)).reasons).toEqual(['NOT_CLOSED']);
    await pool.query("UPDATE votings SET status='closed' WHERE id=$1", [
      f.both.id,
    ]);
    expect((await detail(f.both.id)).stage).toBe('final');
  });
  it('keeps closed incomplete categories provisional and all-empty submissions unresolved', async () => {
    const f = await fixture();
    await pool.query("UPDATE votings SET status='closed' WHERE id=$1", [
      f.t.id,
    ]);
    expect((await detail(f.t.id)).reasons).toEqual(
      expect.arrayContaining([
        'PENDING_BALLOTS',
        'DATA_PROBLEMS',
        'CUTOFF_TIE',
      ]),
    );
    for (const session of f.tokens)
      await wizard.submit(session, f.both.id, {
        expectedRevision: null,
        entries: [],
      });
    await pool.query("UPDATE votings SET status='closed' WHERE id=$1", [
      f.both.id,
    ]);
    const c = await detail(f.both.id);
    expect(c.counts.submitted).toBe(4);
    expect(c.reasons).toEqual(['CUTOFF_TIE']);
    expect(
      c.rows.every((r) => r.rank === 1 && r.selection === 'unresolved'),
    ).toBe(true);
  });
  it('shows empty events, drafts, unconfigured/unlinked entries and zero eligibility without finality or invented winners', async () => {
    const empty = (
      await pool.query("INSERT INTO events(name) VALUES ('Empty') RETURNING id")
    ).rows[0].id;
    expect((await overview(empty)).categories).toEqual([]);
    const f = await fixture();
    await pool.query('DELETE FROM voting_allowed_groups WHERE voting_id=$1', [
      f.t.id,
    ]);
    await pool.query("UPDATE votings SET status='closed' WHERE id=$1", [
      f.t.id,
    ]);
    const zero = await detail(f.t.id);
    expect(zero.counts.expected).toBe(0);
    expect(zero.stage).toBe('provisional');
    expect(zero.problems).toContain('NO_ELIGIBLE_JURORS');
    await pool.query(
      'UPDATE votings SET max_plus_votes=NULL,selected_places=NULL WHERE id=$1',
      [f.draft.id],
    );
    await pool.query('UPDATE voting_items SET team_id=NULL WHERE id=$1', [
      f.draft.items[0],
    ]);
    const draft = await detail(f.draft.id);
    expect(draft.selectedPlaces).toBeNull();
    expect(draft.stage).toBe('provisional');
    expect(draft.boundaryTie).toBe(false);
    expect(draft.rows.every((r) => r.selection === 'outside')).toBe(true);
    expect(draft.problems).toEqual(
      expect.arrayContaining(['CONFIGURATION_NOT_READY', 'UNLINKED_ITEMS']),
    );
  });
  it('flags inconsistent submitted data, excludes ineligible stored ballots and never silently repairs them', async () => {
    const f = await fixture();
    const invalid = (
      await pool.query(
        "INSERT INTO ballots(event_id,voting_id,juror_id,status,submitted_at) VALUES ($1,$2,$3,'submitted',now()) RETURNING id",
        [f.event, f.t.id, f.jurors[0]],
      )
    ).rows[0].id;
    await pool.query(
      'INSERT INTO ballot_entries(event_id,voting_id,ballot_id,voting_item_id,vote_value) VALUES ($1,$2,$3,$4,-1)',
      [f.event, f.t.id, invalid, f.t.items[0]],
    );
    const ineligible = (
      await pool.query(
        "INSERT INTO ballots(event_id,voting_id,juror_id,status,submitted_at) VALUES ($1,$2,$3,'submitted',now()) RETURNING id",
        [f.event, f.t.id, f.jurors[2]],
      )
    ).rows[0].id;
    await pool.query(
      'INSERT INTO ballot_entries(event_id,voting_id,ballot_id,voting_item_id,vote_value) VALUES ($1,$2,$3,$4,1)',
      [f.event, f.t.id, ineligible, f.t.items[0]],
    );
    const c = await detail(f.t.id);
    expect(c.counts.submitted).toBe(1);
    expect(c.rows.find((r) => r.id === f.t.items[0])!).toMatchObject({
      plus: 0,
      minus: 1,
      score: -1,
    });
    expect(c.problems).toEqual(
      expect.arrayContaining(['INVALID_SUBMISSION', 'INELIGIBLE_BALLOTS']),
    );
    expect(c.stage).toBe('provisional');
    expect(
      (await pool.query('SELECT status FROM ballots WHERE id=$1', [invalid]))
        .rows[0].status,
    ).toBe('submitted');
  });
  it('excludes valid/invalid drafts and cancelled entries while counting an explicit empty submission', async () => {
    const f = await fixture();
    await wizard.saveDraft(f.tokens[0], f.both.id, {
      expectedRevision: null,
      entries: entries(f.both.items, [0]),
    });
    await wizard.saveDraft(f.tokens[1], f.both.id, {
      expectedRevision: null,
      entries: entries(f.both.items, [], [0]),
    });
    await wizard.saveDraft(f.tokens[2], f.both.id, {
      expectedRevision: null,
      entries: entries(f.both.items, [0, 1]),
    });
    await pool.query(
      "UPDATE ballots SET status='cancelled' WHERE voting_id=$1 AND juror_id=$2",
      [f.both.id, f.jurors[2]],
    );
    await wizard.submit(f.tokens[3], f.both.id, {
      expectedRevision: null,
      entries: [],
    });
    const c = await detail(f.both.id);
    expect(c.counts).toEqual({
      expected: 4,
      submitted: 1,
      pending: 3,
      invalid: 1,
      locked: 1,
    });
    expect(
      c.rows.every((r) => r.plus === 0 && r.minus === 0 && r.score === 0),
    ).toBe(true);
    expect(c.problems).toEqual(
      expect.arrayContaining(['INVALID_DRAFT', 'LOCKED_BALLOT']),
    );
  });
  it('uses current descriptive team corrections, stable identities and isolated event/categories', async () => {
    const f = await fixture(),
      other = await fixture();
    const row = (await detail(f.both.id)).rows[0]!;
    await pool.query(
      "UPDATE teams SET name='Corrected name',description='Current description' WHERE id=$1",
      [row.teamId],
    );
    const updated = (await detail(f.both.id)).rows.find(
      (r) => r.id === row.id,
    )!;
    expect(updated).toMatchObject({
      teamId: row.teamId,
      name: 'Corrected name',
      description: 'Current description',
    });
    expect(
      (await overview(other.event)).categories
        .flatMap((c) => c.rows)
        .some((r) => r.teamId === row.teamId),
    ).toBe(false);
    expect((await get(`/results/votings/${randomUUID()}`)).statusCode).toBe(
      404,
    );
    expect(
      (await get(`/results/overview?eventId=${randomUUID()}`)).statusCode,
    ).toBe(404);
  });
  it('shows each eligible juror’s choices on the detail, counting only submissions', async () => {
    const f = await fixture();
    await wizard.submit(f.tokens[0], f.both.id, {
      expectedRevision: null,
      entries: entries(f.both.items, [0, 1], [2]),
    });
    await wizard.saveDraft(f.tokens[2], f.both.id, {
      expectedRevision: null,
      entries: entries(f.both.items, [3]),
    });
    const response = await get(`/results/votings/${f.both.id}`);
    expect(response.statusCode).toBe(200);
    const body = resultsDetailSchema.parse(response.json());
    expect(body.jurorVotes.map((j) => j.jurorId).sort()).toEqual(
      [...f.jurors].sort(),
    );
    const byJuror = new Map(body.jurorVotes.map((j) => [j.jurorId, j]));
    const submitted = byJuror.get(f.jurors[0]!)!;
    expect(submitted.progress).toBe('submitted');
    expect(submitted.counted).toBe(true);
    expect(submitted.submittedAt).not.toBeNull();
    expect(
      [...submitted.entries].sort((a, b) =>
        a.votingItemId.localeCompare(b.votingItemId),
      ),
    ).toEqual(
      entries(f.both.items, [0, 1], [2]).sort((a, b) =>
        a.votingItemId.localeCompare(b.votingItemId),
      ),
    );
    const draft = byJuror.get(f.jurors[2]!)!;
    expect(draft.progress).toBe('in_progress');
    expect(draft.counted).toBe(false);
    expect(draft.entries).toEqual(entries(f.both.items, [3]));
    const idle = byJuror.get(f.jurors[1]!)!;
    expect(idle.progress).toBe('not_started');
    expect(idle.entries).toEqual([]);
    // Drafts never reach the aggregate.
    expect(body.category.rows.find((r) => r.id === f.both.items[3])!.plus).toBe(
      0,
    );
    const t = resultsDetailSchema.parse(
      (await get(`/results/votings/${f.t.id}`)).json(),
    );
    expect(t.jurorVotes.map((j) => j.jurorId).sort()).toEqual(
      [f.jurors[0]!, f.jurors[1]!].sort(),
    );
  });
  it('rejects malformed/duplicate/extra claims, and keeps the overview aggregate-only with no-store and no writes', async () => {
    const f = await fixture();
    for (const path of [
      '/results/overview',
      '/results/overview?eventId=bad',
      `/results/overview?eventId=${f.event}&eventId=${f.event}`,
      `/results/overview?eventId=${f.event}&jurorId=${f.jurors[0]}`,
      '/results/votings/bad',
      `/results/votings/${f.both.id}?groupId=${f.groups[0]}`,
    ])
      expect((await get(path)).statusCode).toBe(400);
    const counts = () =>
      pool.query(
        'SELECT (SELECT count(*) FROM ballots)::int AS ballots,(SELECT count(*) FROM audit_logs)::int AS history',
      );
    const before = (await counts()).rows;
    for (const path of [
      `/results/overview?eventId=${f.event}`,
      `/results/votings/${f.both.id}`,
    ]) {
      const response = await get(path);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.statusCode).toBe(200);
      // The detail intentionally lists individual choices; the overview does not.
      const individual = path.startsWith('/results/overview')
        ? [
            'jurorId',
            'displayName',
            'entries',
            'voteValue',
            'submittedAt',
            'savedAt',
          ]
        : [];
      for (const forbidden of [
        ...individual,
        'revision',
        'token',
        'password',
        'history',
        'jurors',
      ])
        expect(response.body).not.toContain(`"${forbidden}"`);
    }
    expect((await counts()).rows).toEqual(before);
  });
  it('rejects anonymous, fabricated, expired, revoked and juror sessions on both routes', async () => {
    const f = await fixture();
    const expired = newSecret(),
      revoked = newSecret();
    const user = (
      await pool.query(
        'SELECT admin_user_id FROM sessions WHERE token_hash=$1',
        [secretHash(token)],
      )
    ).rows[0].admin_user_id;
    await pool.query(
      "INSERT INTO sessions(token_hash,admin_user_id,created_at,expires_at) VALUES ($1,$2,now()-interval '2 hours',now()-interval '1 hour')",
      [secretHash(expired), user],
    );
    await pool.query(
      "INSERT INTO sessions(token_hash,admin_user_id,expires_at,revoked_at) VALUES ($1,$2,now()+interval '1 hour',now())",
      [secretHash(revoked), user],
    );
    for (const path of [
      `/results/overview?eventId=${f.event}`,
      `/results/votings/${f.both.id}`,
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
  it.each(['overview', 'detail'] as const)(
    'waits for event writes and projects committed counts, scores and closure consistently (%s)',
    async (route) => {
      const f = await fixture();
      await allSubmit(f);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
          f.event,
        ]);
        const pending = Promise.resolve(
          get(
            route === 'overview'
              ? `/results/overview?eventId=${f.event}`
              : `/results/votings/${f.both.id}`,
          ),
        );
        await waitForLock();
        await client.query("UPDATE votings SET status='closed' WHERE id=$1", [
          f.both.id,
        ]);
        const ballot = (
          await client.query(
            'SELECT id FROM ballots WHERE voting_id=$1 AND juror_id=$2',
            [f.both.id, f.jurors[0]],
          )
        ).rows[0].id;
        await client.query(
          'UPDATE ballot_entries SET voting_item_id=$1 WHERE ballot_id=$2',
          [f.both.items[1], ballot],
        );
        await client.query('COMMIT');
        const response = await pending;
        expect(response.statusCode).toBe(200);
        const c =
          route === 'overview'
            ? resultsOverviewSchema
                .parse(response.json())
                .categories.find((c) => c.id === f.both.id)!
            : resultsDetailSchema.parse(response.json()).category;
        expect(c.status).toBe('closed');
        expect(c.stage).toBe('final');
        expect(c.counts.submitted).toBe(4);
        expect(c.rows[0]).toMatchObject({
          id: f.both.items[0],
          plus: 3,
          score: 3,
        });
        expect(c.rows[1]).toMatchObject({
          id: f.both.items[1],
          plus: 1,
          score: 1,
        });
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    },
  );
  it.each(['revoke', 'expire'] as const)(
    'rechecks admin %s after an actual event-lock wait',
    async (mode) => {
      const f = await fixture();
      const secret = (await auth.login('Disposable Phase Eleven password'))!
        .token;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
          f.event,
        ]);
        const pending = Promise.resolve(
          get(`/results/votings/${f.both.id}`, `d21-session=${secret}`),
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
  throw new Error('No actual results event-lock wait observed');
}
