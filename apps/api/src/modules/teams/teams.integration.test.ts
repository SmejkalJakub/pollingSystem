import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { teamTableSnapshotSchema } from '@d21/contracts';
import { readEnvironment } from '../../config';
import { dropTestDatabase } from '../../db/test-database';
import { buildApp } from '../../app';
import { createAuthService, setAdminPassword } from '../auth/service';
import { newSecret, secretHash } from '../auth/crypto';
import { createVotingService } from '../votings/service';

const name = `d21_test_${randomUUID().replaceAll('-', '')}`;
const baseUrl = process.env.TEST_DATABASE_URL ?? readEnvironment().DATABASE_URL;
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname))
  throw new Error('Team tests require local PostgreSQL.');
const admin = new pg.Pool({
  connectionString: baseUrl,
  max: 2,
  connectionTimeoutMillis: 3000,
});
const url = new URL(baseUrl);
url.pathname = `/${name}`;
const pool = new pg.Pool({
  connectionString: url.toString(),
  max: 6,
  connectionTimeoutMillis: 3000,
});
const headers = { 'x-d21-request': '1', origin: 'http://127.0.0.1:5173' };
let app: ReturnType<typeof buildApp>,
  cookie: string,
  created = false;
function request(
  method: 'GET' | 'PUT' | 'POST' | 'PATCH',
  path: string,
  payload?: object,
  session = cookie,
  guard = headers,
) {
  return app.inject({
    method,
    url: path,
    headers: { ...guard, ...(session ? { cookie: session } : {}) },
    payload,
  });
}
async function event() {
  return (
    await pool.query(
      "INSERT INTO events(name) VALUES ('Team table test') RETURNING id",
    )
  ).rows[0].id as string;
}
async function table(eventId: string) {
  const response = await request('GET', `/events/${eventId}/teams/table`);
  expect(response.statusCode).toBe(200);
  return teamTableSnapshotSchema.parse(response.json());
}
const row = (name = 'Same team') => ({
  id: randomUUID(),
  name,
  description: '',
});
async function save(
  eventId: string,
  baseVersion: string,
  rows: object[],
  session = cookie,
) {
  return request(
    'PUT',
    `/events/${eventId}/teams/table`,
    { baseVersion, rows },
    session,
  );
}
async function rowsIn(eventId: string) {
  return (
    await pool.query('SELECT * FROM teams WHERE event_id=$1 ORDER BY id', [
      eventId,
    ])
  ).rows;
}

describe('atomic team table against local PostgreSQL', () => {
  beforeAll(async () => {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    await migrate(drizzle(pool), {
      migrationsFolder: fileURLToPath(
        new URL('../../db/migrations', import.meta.url),
      ),
    });
    await setAdminPassword(pool, 'Disposable team table password');
    const auth = createAuthService(pool);
    app = buildApp({
      checkDatabase: async () => {},
      auth: {
        service: auth,
        origin: headers.origin,
        votings: createVotingService(pool, auth),
      },
    });
    const login = await request(
      'POST',
      '/auth/admin/login',
      { password: 'Disposable team table password' },
      '',
    );
    expect(login.statusCode).toBe(200);
    cookie = String(login.headers['set-cookie']).split(';')[0]!;
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
  it('creates distinct duplicate-name IDs, trims fields, updates atomically and replays without timestamp changes', async () => {
    const id = await event(),
      before = await table(id),
      added = [row(' Same team '), row()];
    const first = await save(id, before.version, added);
    expect(first.statusCode).toBe(200);
    expect(first.json().status).toBe('saved');
    const stored = await rowsIn(id);
    expect(stored).toHaveLength(2);
    expect(stored.every((team) => team.name === 'Same team')).toBe(true);
    expect(
      (await save(id, before.version, [...added].reverse())).json().status,
    ).toBe('saved');
    expect(await rowsIn(id)).toEqual(stored);
    const current = await table(id);
    const revised = current.teams.map((team) => ({
      id: team.id,
      name: team.name,
      description: ' Updated ',
    }));
    expect((await save(id, current.version, revised)).json().status).toBe(
      'saved',
    );
    expect(
      (await rowsIn(id)).every((team) => team.description === 'Updated'),
    ).toBe(true);
  });
  it('reports every invalid field and writes nothing, including an earlier valid row', async () => {
    const id = await event(),
      before = await table(id),
      invalid = { ...row(' '), description: 'x'.repeat(5001) };
    const response = await save(id, before.version, [row(), invalid]);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'invalid',
      issues: [
        { rowId: invalid.id, field: 'name' },
        { rowId: invalid.id, field: 'description' },
      ],
    });
    expect(await table(id)).toEqual(before);
  });
  it('rejects stale versions from legacy writes and table saves, and never deletes omitted teams', async () => {
    const id = await event(),
      empty = await table(id),
      a = row();
    await save(id, empty.version, [a]);
    const current = await table(id);
    await request('PATCH', `/events/${id}/teams/${a.id}`, {
      name: 'Changed elsewhere',
    });
    expect(
      (await save(id, current.version, [{ ...a, name: 'Stale' }])).statusCode,
    ).toBe(409);
    const newer = await table(id);
    expect((await save(id, newer.version, [])).statusCode).toBe(409);
    expect(await table(id)).toEqual(newer);
    expect((await save(id, empty.version, [a])).statusCode).toBe(409);
  });
  it('serializes concurrent saves and matching retries without duplicate additions', async () => {
    const id = await event(),
      before = await table(id),
      a = row();
    const responses = await Promise.all([
      save(id, before.version, [a]),
      save(id, before.version, [a]),
    ]);
    expect(responses.map((response) => response.statusCode)).toEqual([
      200, 200,
    ]);
    expect(await rowsIn(id)).toHaveLength(1);
    const current = await table(id);
    const changes = await Promise.all([
      save(id, current.version, [{ ...a, name: 'A' }]),
      save(id, current.version, [{ ...a, name: 'B' }]),
    ]);
    expect(changes.map((response) => response.statusCode).sort()).toEqual([
      200, 409,
    ]);
    expect(await rowsIn(id)).toHaveLength(1);
  });
  it('rejects foreign IDs with full rollback and keeps other events unchanged', async () => {
    const id = await event(),
      other = await event(),
      foreign = row();
    await save(other, (await table(other)).version, [foreign]);
    const original = await table(other),
      before = await table(id);
    expect(
      (
        await save(id, before.version, [
          row('Would otherwise succeed'),
          { ...foreign, name: 'Foreign' },
        ])
      ).statusCode,
    ).toBe(409);
    expect(await table(id)).toEqual(before);
    expect(await table(other)).toEqual(original);
  });
  it('rolls back all changes on a mid-table database failure', async () => {
    const id = await event(),
      before = await table(id),
      a = row('Before failure'),
      b = row('FAIL TEAM');
    await pool.query(
      "CREATE FUNCTION fail_team_table() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name='FAIL TEAM' THEN RAISE EXCEPTION 'injected'; END IF; RETURN NEW; END $$",
    );
    await pool.query(
      'CREATE TRIGGER fail_team_table BEFORE INSERT OR UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION fail_team_table()',
    );
    try {
      expect((await save(id, before.version, [a, b])).statusCode).toBe(500);
      expect(await table(id)).toEqual(before);
    } finally {
      await pool.query('DROP TRIGGER fail_team_table ON teams');
      await pool.query('DROP FUNCTION fail_team_table()');
    }
  });
  it('keeps shared entry snapshots, current ballot choices, history and frozen setup intact', async () => {
    const id = await event(),
      a = row();
    await save(id, (await table(id)).version, [a]);
    const group = (
      await pool.query(
        "INSERT INTO jury_groups(event_id,code,name) VALUES ($1,'T','T') RETURNING id",
        [id],
      )
    ).rows[0].id;
    const juror = (
      await pool.query(
        "INSERT INTO event_jurors(event_id,jury_group_id,display_name) VALUES ($1,$2,'J') RETURNING id",
        [id, group],
      )
    ).rows[0].id;
    const voting = (
      await pool.query(
        "INSERT INTO votings(event_id,name,kind,status) VALUES ($1,'V','final','active') RETURNING id",
        [id],
      )
    ).rows[0].id;
    const item = (
      await pool.query(
        "INSERT INTO voting_items(event_id,voting_id,team_id,name,description) VALUES ($1,$2,$3,'Original snapshot','Old') RETURNING id",
        [id, voting, a.id],
      )
    ).rows[0].id;
    const ballot = (
      await pool.query(
        "INSERT INTO ballots(event_id,voting_id,juror_id,status,submitted_at) VALUES ($1,$2,$3,'submitted',now()) RETURNING id",
        [id, voting, juror],
      )
    ).rows[0].id;
    await pool.query(
      'INSERT INTO ballot_entries(ballot_id,voting_item_id,voting_id,event_id,vote_value) VALUES ($1,$2,$3,$4,1)',
      [ballot, item, voting, id],
    );
    const sql = `SELECT (SELECT json_agg(t) FROM voting_items t WHERE event_id=$1) AS items,(SELECT json_agg(t) FROM ballots t WHERE event_id=$1) AS ballots,(SELECT json_agg(t) FROM ballot_entries t WHERE event_id=$1) AS entries,(SELECT json_agg(t) FROM audit_logs t WHERE event_id=$1) AS history,(SELECT roster_locked_at FROM events WHERE id=$1) AS frozen`;
    const before = (await pool.query(sql, [id])).rows;
    expect(
      (
        await save(id, (await table(id)).version, [
          { ...a, name: 'Corrected shared label' },
        ])
      ).json().status,
    ).toBe('saved');
    expect((await pool.query(sql, [id])).rows).toEqual(before);
    const response = await request('GET', `/votings/${voting}/items`);
    expect(response.json()[0].name).toBe('Corrected shared label');
  });
  it('guards both methods, strict fields and queries without accepting identity claims', async () => {
    const id = await event(),
      snapshot = await table(id),
      path = `/events/${id}/teams/table`,
      a = row();
    const group = (
      await pool.query(
        "INSERT INTO jury_groups(event_id,code,name) VALUES ($1,'T','T') RETURNING id",
        [id],
      )
    ).rows[0].id;
    const juror = (
      await pool.query(
        "INSERT INTO event_jurors(event_id,jury_group_id,display_name) VALUES ($1,$2,'J') RETURNING id",
        [id, group],
      )
    ).rows[0].id;
    const token = newSecret();
    await pool.query(
      'INSERT INTO sessions(token_hash,event_id,juror_id,expires_at) VALUES ($1,$2,$3,NULL)',
      [secretHash(token), id, juror],
    );
    for (const method of ['GET', 'PUT'] as const) {
      const body =
        method === 'PUT'
          ? { baseVersion: snapshot.version, rows: [a] }
          : undefined;
      expect((await request(method, path, body, '')).statusCode).toBe(401);
      expect(
        (await request(method, path, body, cookie.split('=')[0] + '=' + token))
          .statusCode,
      ).toBe(403);
      expect(
        (await request(method, path + '?actor=admin', body)).statusCode,
      ).toBe(400);
    }
    expect(
      (
        await request(
          'PUT',
          path,
          { baseVersion: snapshot.version, rows: [a] },
          cookie,
          { origin: headers.origin } as typeof headers,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          'PUT',
          path,
          { baseVersion: snapshot.version, rows: [a] },
          cookie,
          { ...headers, origin: 'https://foreign.test' },
        )
      ).statusCode,
    ).toBe(403);
    for (const body of [
      { baseVersion: snapshot.version, rows: [a, a] },
      { baseVersion: snapshot.version, rows: [{ ...a, eventId: id }] },
      { baseVersion: snapshot.version, rows: [a], delete: true },
      { baseVersion: 'bad', rows: [a] },
    ])
      expect((await request('PUT', path, body)).statusCode).toBe(400);
    expect(await table(id)).toEqual(snapshot);
    const response = await request('GET', path);
    expect(response.headers['cache-control']).toContain('no-store');
  });
  it('rejects sub-millisecond stale edits and oversized requests without writes', async () => {
    const id = await event(),
      a = row();
    await save(id, (await table(id)).version, [a]);
    await pool.query(
      "UPDATE teams SET updated_at='2026-10-18T10:00:00.123001Z' WHERE id=$1",
      [a.id],
    );
    const before = await table(id);
    await pool.query(
      "UPDATE teams SET updated_at='2026-10-18T10:00:00.123002Z' WHERE id=$1",
      [a.id],
    );
    const current = await table(id);
    expect(current.teams[0]!.updatedAt).toBe(before.teams[0]!.updatedAt);
    expect(current.version).not.toBe(before.version);
    expect(
      (await save(id, before.version, [{ ...a, name: 'Stale' }])).statusCode,
    ).toBe(409);
    expect(
      (
        await save(id, current.version, [
          { ...a, description: 'x'.repeat(70_000) },
        ])
      ).statusCode,
    ).toBe(413);
    expect(await table(id)).toEqual(current);
  });
  it('rolls back table writes when authorization is lost before transaction completion', async () => {
    const id = await event(),
      before = await table(id);
    await pool.query(
      'CREATE FUNCTION revoke_on_team_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE sessions SET revoked_at=statement_timestamp() WHERE admin_user_id IS NOT NULL; RETURN NEW; END $$',
    );
    await pool.query(
      'CREATE TRIGGER revoke_on_team_write AFTER INSERT ON teams FOR EACH ROW EXECUTE FUNCTION revoke_on_team_write()',
    );
    try {
      expect((await save(id, before.version, [row()])).statusCode).toBe(401);
      expect(await table(id)).toEqual(before);
    } finally {
      await pool.query('DROP TRIGGER revoke_on_team_write ON teams');
      await pool.query('DROP FUNCTION revoke_on_team_write()');
    }
  });
  it.each(['revoke', 'expire', 'change'] as const)(
    'rechecks %s after a real event-lock wait',
    async (mode) => {
      const id = await event(),
        snapshot = await table(id),
        a = row(),
        token = newSecret();
      const adminId = (
        await pool.query(
          'SELECT admin_user_id FROM sessions WHERE token_hash=$1',
          [secretHash(cookie.split('=')[1]!)],
        )
      ).rows[0].admin_user_id;
      await pool.query(
        "INSERT INTO sessions(token_hash,admin_user_id,expires_at) VALUES ($1,$2,now()+interval '1 hour')",
        [secretHash(token), adminId],
      );
      const lock = await pool.connect();
      try {
        await lock.query('BEGIN');
        await lock.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [id]);
        const waiting = save(
          id,
          snapshot.version,
          [a],
          cookie.split('=')[0] + '=' + token,
        );
        // app.inject starts when awaited/thened.
        const pending = Promise.resolve(waiting);
        const until = Date.now() + 3000;
        while (true) {
          const blocked = await pool.query(
            "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND pid<>pg_backend_pid()",
          );
          if (blocked.rowCount) break;
          if (Date.now() > until)
            throw new Error('Expected actual event lock wait.');
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        if (mode === 'change')
          await lock.query(
            "INSERT INTO teams(event_id,name) VALUES ($1,'Other writer')",
            [id],
          );
        else if (mode === 'revoke')
          await lock.query(
            'UPDATE sessions SET revoked_at=statement_timestamp() WHERE token_hash=$1',
            [secretHash(token)],
          );
        else
          await lock.query(
            "UPDATE sessions SET created_at=now()-interval '2 hours',expires_at=statement_timestamp()-interval '1 second' WHERE token_hash=$1",
            [secretHash(token)],
          );
        await lock.query('COMMIT');
        expect((await pending).statusCode).toBe(mode === 'change' ? 409 : 401);
        expect((await rowsIn(id)).some((team) => team.id === a.id)).toBe(false);
      } finally {
        await lock.query('ROLLBACK');
        lock.release();
      }
    },
  );
});
