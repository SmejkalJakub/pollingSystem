import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  eventSchema,
  eventListSchema,
  rosterSchema,
  jurorSchema,
  juryGroupSchema,
} from '@d21/contracts';
import { readEnvironment } from '../../config';
import { dropTestDatabase } from '../../db/test-database';
import { buildApp } from '../../app';
import { createAuthService, setAdminPassword } from '../auth/service';
import { newSecret, secretHash } from '../auth/crypto';
import { createEventService } from './service';

const databaseName = `d21_events_test_${randomUUID().replaceAll('-', '')}`;
const baseUrl = process.env.TEST_DATABASE_URL ?? readEnvironment().DATABASE_URL;
const admin = new pg.Pool({
  connectionString: baseUrl,
  max: 2,
  connectionTimeoutMillis: 3000,
});
const url = new URL(baseUrl);
url.pathname = `/${databaseName}`;
const pool = new pg.Pool({
  connectionString: url.toString(),
  max: 6,
  connectionTimeoutMillis: 3000,
});
const headers = { 'x-d21-request': '1', origin: 'http://127.0.0.1:5173' };
let created = false;
let app: ReturnType<typeof buildApp>;
let cookie: string;
function request(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: object,
  session = cookie,
  requestHeaders: Record<string, string> = headers,
) {
  return app.inject({
    method,
    url,
    headers: { ...requestHeaders, ...(session ? { cookie: session } : {}) },
    payload,
  });
}
async function event(name = 'Event') {
  const response = await request('POST', '/events', { name, description: '' });
  expect(response.statusCode).toBe(201);
  return eventSchema.parse(response.json());
}
async function fixture() {
  const e = await event();
  const base = `/events/${e.id}`;
  const t = await request('POST', `${base}/jury-groups`, {
    code: 'T',
    name: 'Technical',
  });
  const v = await request('POST', `${base}/jury-groups`, {
    code: 'V',
    name: 'Second',
  });
  const groupT = juryGroupSchema.parse(t.json()),
    groupV = juryGroupSchema.parse(v.json());
  const result = await request('POST', `${base}/jurors`, {
    displayName: 'Alex',
    juryGroupId: groupT.id,
  });
  const juror = jurorSchema.parse(result.json());
  return { e, base, groupT, groupV, juror };
}
async function addVoting(eventId: string, status = 'draft') {
  const result = await pool.query(
    "INSERT INTO votings (event_id,name,kind,status) VALUES ($1,'Test category','final',$2) RETURNING id",
    [eventId, status],
  );
  return result.rows[0].id as string;
}

describe('event and jury management against PostgreSQL', () => {
  beforeAll(async () => {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    await migrate(drizzle(pool), {
      migrationsFolder: fileURLToPath(
        new URL('../../db/migrations', import.meta.url),
      ),
    });
    await setAdminPassword(pool, 'phase three disposable password');
    app = buildApp({
      checkDatabase: async () => {},
      auth: {
        service: createAuthService(pool),
        origin: headers.origin,
        events: createEventService(pool, createAuthService(pool)),
      },
    });
    const login = await request(
      'POST',
      '/auth/admin/login',
      { password: 'phase three disposable password' },
      '',
    );
    expect(login.statusCode).toBe(200);
    cookie = String(login.headers['set-cookie']).split(';')[0]!;
  });
  afterAll(async () => {
    await app?.close();
    await pool.end();
    try {
      if (created) await dropTestDatabase(admin, databaseName);
    } finally {
      await admin.end();
    }
  });

  it('upgrades Phase 2 data additively, backfills existing history and preserves credentials', async () => {
    const name = `d21_upgrade_${randomUUID().replaceAll('-', '')}`;
    const upgradeUrl = new URL(baseUrl);
    upgradeUrl.pathname = `/${name}`;
    const upgrade = new pg.Pool({
      connectionString: upgradeUrl.toString(),
      connectionTimeoutMillis: 3000,
    });
    const folder = await mkdtemp(join(tmpdir(), 'd21-phase3-upgrade-'));
    let databaseCreated = false;
    try {
      await admin.query(`CREATE DATABASE "${name}"`);
      databaseCreated = true;
      const original = fileURLToPath(
        new URL('../../db/migrations', import.meta.url),
      );
      await mkdir(join(folder, 'meta'));
      const journal = JSON.parse(
        await readFile(join(original, 'meta/_journal.json'), 'utf8'),
      );
      journal.entries = journal.entries.slice(0, 2);
      await writeFile(
        join(folder, 'meta/_journal.json'),
        JSON.stringify(journal),
      );
      for (const entry of journal.entries)
        await writeFile(
          join(folder, `${entry.tag}.sql`),
          await readFile(join(original, `${entry.tag}.sql`)),
        );
      await migrate(drizzle(upgrade), { migrationsFolder: folder });
      const ids = Array.from({ length: 7 }, () => randomUUID());
      const [draft, active, hasBallot, group, juror, voting, user] = ids;
      await upgrade.query(
        "INSERT INTO events (id,name) VALUES ($1,'Draft'),($2,'Active'),($3,'Has ballot')",
        [draft, active, hasBallot],
      );
      await upgrade.query(
        "INSERT INTO jury_groups (id,event_id,code,name) VALUES ($1,$2,'T','T')",
        [group, hasBallot],
      );
      await upgrade.query(
        "INSERT INTO event_jurors (id,event_id,jury_group_id,display_name) VALUES ($1,$2,$3,'Original name')",
        [juror, hasBallot, group],
      );
      await upgrade.query(
        "INSERT INTO votings (event_id,name,kind,status) VALUES ($1,'Active','final','active')",
        [active],
      );
      await upgrade.query(
        "INSERT INTO votings (id,event_id,name,kind) VALUES ($1,$2,'Draft with ballot','final')",
        [voting, hasBallot],
      );
      await upgrade.query(
        'INSERT INTO ballots (event_id,voting_id,juror_id) VALUES ($1,$2,$3)',
        [hasBallot, voting, juror],
      );
      const oldItems = await upgrade.query(
        "INSERT INTO voting_items (event_id,voting_id,name,description) VALUES ($1,$2,'Same legacy name','Keep snapshot'),($1,$2,'Same legacy name','Separate identity') RETURNING id",
        [hasBallot, voting],
      );
      await upgrade.query(
        'INSERT INTO ballot_entries (event_id,voting_id,ballot_id,voting_item_id,vote_value) SELECT $1,$2,id,$3,1 FROM ballots WHERE voting_id=$2',
        [hasBallot, voting, oldItems.rows[0].id],
      );
      await upgrade.query(
        "INSERT INTO users (id,display_name) VALUES ($1,'Administrace')",
        [user],
      );
      await upgrade.query(
        "INSERT INTO admin_access (user_id,password_hash) VALUES ($1,'preserve-existing-hash')",
        [user],
      );
      await migrate(drizzle(upgrade), { migrationsFolder: original });
      await migrate(drizzle(upgrade), { migrationsFolder: original });
      const events = await upgrade.query(
        'SELECT id,roster_locked_at FROM events',
      );
      expect(
        events.rows.find((row) => row.id === draft).roster_locked_at,
      ).toBeNull();
      expect(
        events.rows.filter((row) => row.roster_locked_at !== null),
      ).toHaveLength(2);
      expect(
        (await upgrade.query('SELECT password_hash FROM admin_access')).rows[0]
          .password_hash,
      ).toBe('preserve-existing-hash');
      expect(
        (await upgrade.query('SELECT display_name FROM event_jurors')).rows[0]
          .display_name,
      ).toBe('Original name');
      expect(
        (await upgrade.query('SELECT count(*)::int AS count FROM ballots'))
          .rows[0].count,
      ).toBe(1);
      expect(
        (
          await upgrade.query(
            'SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations',
          )
        ).rows[0].count,
      ).toBe(4);
      const migratedItems = await upgrade.query(
        'SELECT id,team_id,name,description FROM voting_items ORDER BY id',
      );
      expect(migratedItems.rows).toHaveLength(2);
      expect(new Set(migratedItems.rows.map((row) => row.team_id)).size).toBe(
        2,
      );
      for (const item of migratedItems.rows) {
        expect(item.team_id).toBe(item.id);
        expect(item.name).toBe('Same legacy name');
      }
      expect(
        (await upgrade.query('SELECT count(*)::int AS n FROM teams')).rows[0].n,
      ).toBe(2);
      expect(
        (
          await upgrade.query(
            'SELECT voting_item_id,vote_value FROM ballot_entries',
          )
        ).rows,
      ).toEqual([{ voting_item_id: oldItems.rows[0].id, vote_value: 1 }]);
    } finally {
      await upgrade.end();
      if (databaseCreated) await dropTestDatabase(admin, name);
      await rm(folder, { recursive: true, force: true });
    }
  });

  it('creates, lists, reads and edits real events with trimmed validated fields', async () => {
    const e = await event('  Hackathon  ');
    expect(e.name).toBe('Hackathon');
    expect((await request('GET', `/events/${e.id}`)).json()).toEqual(e);
    const list = await request('GET', '/events');
    expect(
      eventListSchema.parse(list.json()).some((value) => value.id === e.id),
    ).toBe(true);
    const changed = await request('PATCH', `/events/${e.id}`, {
      description: ' Instructions ',
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({
      name: 'Hackathon',
      description: 'Instructions',
      createdAt: e.createdAt,
    });
    expect(Date.parse(changed.json().updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(e.updatedAt),
    );
    expect(changed.json()).not.toHaveProperty('rosterLockedAt');
    expect(list.headers['cache-control']).toBe('no-store');
  });

  it('manages T/V groups and duplicate-name jurors while allowing incomplete setup', async () => {
    const f = await fixture();
    const duplicate = await request('POST', `${f.base}/jurors`, {
      displayName: 'Alex',
      juryGroupId: f.groupV.id,
    });
    expect(duplicate.statusCode).toBe(201);
    expect(duplicate.json().id).not.toBe(f.juror.id);
    const renamed = await request(
      'PATCH',
      `${f.base}/jury-groups/${f.groupT.id}`,
      { name: 'Engineering' },
    );
    expect(renamed.json().name).toBe('Engineering');
    const changed = await request('PATCH', `${f.base}/jurors/${f.juror.id}`, {
      displayName: 'Alex Corrected',
      juryGroupId: f.groupV.id,
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({
      eventId: f.e.id,
      juryGroupId: f.groupV.id,
      displayName: 'Alex Corrected',
    });
    const roster = rosterSchema.parse(
      (await request('GET', `${f.base}/roster`)).json(),
    );
    expect(roster.locked).toBe(false);
    expect(roster.jurors).toHaveLength(2);
    expect((await request('GET', `${f.base}/jurors`)).json()).toEqual(
      roster.jurors,
    );
    expect((await request('GET', `${f.base}/jury-groups`)).json()).toEqual(
      roster.groups,
    );
    expect(
      (
        await request('POST', `${f.base}/jury-groups`, {
          code: 'T',
          name: 'Duplicate',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await request('PATCH', `${f.base}/jury-groups/${f.groupT.id}`, {
          code: 'V',
          name: 'Unsafe',
        })
      ).statusCode,
    ).toBe(400);
  });

  it('guards every new endpoint against anonymous, juror, expired and revoked sessions', async () => {
    const f = await fixture();
    const token = newSecret();
    await pool.query(
      "INSERT INTO sessions (token_hash,event_id,juror_id,expires_at) VALUES ($1,$2,$3,now()+interval '12 hours')",
      [secretHash(token), f.e.id, f.juror.id],
    );
    const adminId = (await pool.query('SELECT user_id FROM admin_access'))
      .rows[0].user_id;
    const expired = newSecret(),
      revoked = newSecret();
    await pool.query(
      "INSERT INTO sessions (token_hash,admin_user_id,created_at,expires_at,revoked_at) VALUES ($1,$3,now()-interval '13 hours',now()-interval '1 hour',null),($2,$3,now(),now()+interval '12 hours',now())",
      [secretHash(expired), secretHash(revoked), adminId],
    );
    const endpoints = [
      ['GET', '/events'],
      ['POST', '/events'],
      ['GET', f.base],
      ['PATCH', f.base],
      ['GET', `${f.base}/roster`],
      ['GET', `${f.base}/jury-groups`],
      ['POST', `${f.base}/jury-groups`],
      ['PATCH', `${f.base}/jury-groups/${f.groupT.id}`],
      ['GET', `${f.base}/jurors`],
      ['POST', `${f.base}/jurors`],
      ['PATCH', `${f.base}/jurors/${f.juror.id}`],
      ['DELETE', `${f.base}/jurors/${f.juror.id}`],
    ] as const;
    for (const [method, path] of endpoints) {
      for (const session of [
        '',
        `d21-session=${expired}`,
        `d21-session=${revoked}`,
      ])
        expect(
          (await request(method, path, undefined, session)).statusCode,
          `${method} ${path}`,
        ).toBe(401);
      expect(
        (await request(method, path, undefined, `d21-session=${token}`))
          .statusCode,
      ).toBe(403);
    }
  });

  it('inherits origin and custom-header protections on every mutation', async () => {
    const f = await fixture();
    const mutations = [
      ['POST', '/events'],
      ['PATCH', f.base],
      ['POST', `${f.base}/jury-groups`],
      ['PATCH', `${f.base}/jury-groups/${f.groupT.id}`],
      ['POST', `${f.base}/jurors`],
      ['PATCH', `${f.base}/jurors/${f.juror.id}`],
      ['DELETE', `${f.base}/jurors/${f.juror.id}`],
    ] as const;
    for (const [method, path] of mutations)
      for (const invalid of [
        {},
        { ...headers, origin: 'https://attacker.test' },
        { ...headers, 'sec-fetch-site': 'cross-site' },
      ])
        expect(
          (await request(method, path, {}, cookie, invalid)).statusCode,
        ).toBe(403);
  });

  it('rejects invalid input, unknown fields, empty patches and malformed/missing identifiers', async () => {
    const f = await fixture();
    for (const payload of [
      { name: ' ', description: '' },
      { name: 'x'.repeat(201), description: '' },
      { name: 'A', description: 'x'.repeat(5001) },
      { name: 'A', description: '', status: 'active' },
    ])
      expect((await request('POST', '/events', payload)).statusCode).toBe(400);
    for (const path of [
      f.base,
      `${f.base}/jurors/${f.juror.id}`,
      `${f.base}/jury-groups/${f.groupT.id}`,
    ])
      expect((await request('PATCH', path, {})).statusCode).toBe(400);
    expect(
      (
        await request('POST', `${f.base}/jury-groups`, {
          code: 'X',
          name: 'Unknown',
        })
      ).statusCode,
    ).toBe(400);
    for (const payload of [
      { displayName: ' ', juryGroupId: f.groupT.id },
      { displayName: 'A', juryGroupId: 'bad' },
      { displayName: 'A', juryGroupId: f.groupT.id, eventId: randomUUID() },
    ])
      expect(
        (await request('POST', `${f.base}/jurors`, payload)).statusCode,
      ).toBe(400);
    expect((await request('GET', '/events/not-a-uuid')).statusCode).toBe(400);
    expect((await request('GET', `/events/${randomUUID()}`)).statusCode).toBe(
      404,
    );
    for (const suffix of ['/roster', '/jurors', '/jury-groups'])
      expect(
        (await request('GET', `/events/${randomUUID()}${suffix}`)).statusCode,
      ).toBe(404);
  });

  it('rejects cross-event groups, child edits and membership removals without changing either event', async () => {
    const a = await fixture(),
      b = await fixture();
    for (const path of [`${a.base}/jurors`, `${a.base}/jurors/${a.juror.id}`])
      expect(
        (
          await request(path.endsWith('/jurors') ? 'POST' : 'PATCH', path, {
            displayName: 'Cross event',
            juryGroupId: b.groupT.id,
          })
        ).statusCode,
      ).toBe(400);
    expect(
      (
        await request('PATCH', `${a.base}/jurors/${b.juror.id}`, {
          displayName: 'Cross',
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await request('DELETE', `${a.base}/jurors/${b.juror.id}`)).statusCode,
    ).toBe(404);
    expect(
      (
        await request('PATCH', `${a.base}/jury-groups/${b.groupT.id}`, {
          name: 'Cross',
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await request('PATCH', `${a.base}/jurors/${a.juror.id}`, {
          eventId: b.e.id,
        })
      ).statusCode,
    ).toBe(400);
    const roster = (await request('GET', `${b.base}/roster`)).json();
    expect(roster.jurors).toEqual([b.juror]);
    expect(roster.groups[0].name).toBe('Technical');
    await expect(
      pool.query('UPDATE event_jurors SET jury_group_id=$1 WHERE id=$2', [
        b.groupT.id,
        a.juror.id,
      ]),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('removes only an unreferenced setup membership and exposes no event/group deletion or archive', async () => {
    const f = await fixture();
    expect(
      (await request('DELETE', `${f.base}/jurors/${f.juror.id}`)).statusCode,
    ).toBe(204);
    expect((await request('GET', `${f.base}/jurors`)).json()).toEqual([]);
    expect(
      (await request('DELETE', `${f.base}/jurors/${f.juror.id}`)).statusCode,
    ).toBe(404);
    expect((await request('DELETE', f.base)).statusCode).toBe(404);
    expect(
      (await request('DELETE', `${f.base}/jury-groups/${f.groupT.id}`))
        .statusCode,
    ).toBe(404);
    expect(
      (await request('PATCH', f.base, { archived: true })).statusCode,
    ).toBe(400);
  });

  it('retains membership and historical references when RESTRICT refuses removal', async () => {
    const f = await fixture();
    const hash = secretHash(newSecret());
    await pool.query(
      'INSERT INTO juror_access (token_hash,event_id,juror_id) VALUES ($1,$2,$3)',
      [hash, f.e.id, f.juror.id],
    );
    const response = await request('DELETE', `${f.base}/jurors/${f.juror.id}`);
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MEMBERSHIP_REFERENCED');
    expect((await request('GET', `${f.base}/jurors`)).json()).toHaveLength(1);
    expect(
      (
        await pool.query(
          'SELECT token_hash FROM juror_access WHERE token_hash=$1',
          [hash],
        )
      ).rowCount,
    ).toBe(1);
  });

  it.each(['active', 'closed', 'archived'])(
    'freezes membership for %s voting, but allows descriptive corrections',
    async (status) => {
      const f = await fixture();
      const votingId = await addVoting(f.e.id, status);
      expect((await request('GET', `${f.base}/roster`)).json().locked).toBe(
        true,
      );
      for (const [method, path, body] of [
        [
          'POST',
          `${f.base}/jurors`,
          { displayName: 'New', juryGroupId: f.groupT.id },
        ],
        [
          'PATCH',
          `${f.base}/jurors/${f.juror.id}`,
          { juryGroupId: f.groupV.id },
        ],
        ['DELETE', `${f.base}/jurors/${f.juror.id}`, undefined],
        ['POST', `${f.base}/jury-groups`, { code: 'T', name: 'New' }],
      ] as const) {
        const response = await request(method, path, body);
        expect(response.statusCode).toBe(409);
        expect(response.json().error.code).toBe('ROSTER_LOCKED');
      }
      expect(
        (
          await request('PATCH', `${f.base}/jurors/${f.juror.id}`, {
            displayName: 'Correction',
            juryGroupId: f.groupT.id,
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await request('PATCH', `${f.base}/jury-groups/${f.groupT.id}`, {
            name: 'Corrected',
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (await request('PATCH', f.base, { name: 'Corrected event' }))
          .statusCode,
      ).toBe(200);
      await pool.query("UPDATE votings SET status='draft' WHERE id=$1", [
        votingId,
      ]);
      expect((await request('GET', `${f.base}/roster`)).json().locked).toBe(
        true,
      );
    },
  );

  it.each(['draft', 'submitted', 'cancelled'])(
    'freezes for any %s ballot even with only draft voting',
    async (status) => {
      const f = await fixture();
      const voting = await addVoting(f.e.id);
      expect((await request('GET', `${f.base}/roster`)).json().locked).toBe(
        false,
      );
      const inserted = await pool.query(
        "INSERT INTO ballots (event_id,voting_id,juror_id,status,submitted_at) VALUES ($1,$2,$3,$4::ballot_status,CASE WHEN $4::ballot_status='submitted' THEN now() END) RETURNING id",
        [f.e.id, voting, f.juror.id, status],
      );
      expect(
        (
          await request('PATCH', `${f.base}/jurors/${f.juror.id}`, {
            juryGroupId: f.groupV.id,
          })
        ).statusCode,
      ).toBe(409);
      await pool.query('DELETE FROM ballots WHERE id=$1', [
        inserted.rows[0].id,
      ]);
      expect((await request('GET', `${f.base}/roster`)).json().locked).toBe(
        true,
      );
      const other = await fixture();
      expect((await request('GET', `${other.base}/roster`)).json().locked).toBe(
        false,
      );
    },
  );

  it('serializes roster mutations against uncommitted voting activation', async () => {
    const f = await fixture();
    const voting = await addVoting(f.e.id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE votings SET status='active' WHERE id=$1", [
        voting,
      ]);
      const mutation = request('PATCH', `${f.base}/jurors/${f.juror.id}`, {
        juryGroupId: f.groupV.id,
      }).then((value) => value);
      let waiting = false;
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const blocked = await pool.query(
          "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT roster_locked_at FROM events%'",
        );
        if (blocked.rowCount) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(
        waiting,
        'membership update must wait for the activation event lock',
      ).toBe(true);
      await client.query('COMMIT');
      expect((await mutation).statusCode).toBe(409);
      expect(
        (await request('GET', `${f.base}/jurors`)).json()[0].juryGroupId,
      ).toBe(f.groupT.id);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
