import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  votingSetupSnapshotSchema,
  type VotingSetupValues,
} from '@d21/contracts';
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
const path = (eventId: string, votingId: string) =>
  `/events/${eventId}/votings/${votingId}/setup`;
async function read(eventId: string, votingId: string) {
  const response = await request('GET', path(eventId, votingId));
  expect(response.statusCode).toBe(200);
  return votingSetupSnapshotSchema.parse(response.json());
}
function initial(): VotingSetupValues {
  return {
    name: 'Category',
    instructions: '',
    kind: 'final',
    configuration: {
      selectedPlaces: null,
      maxPlusVotes: null,
      maxMinusVotes: null,
      allowNegativeVotes: null,
    },
    juryGroupIds: [],
    items: [],
  };
}
async function save(
  eventId: string,
  votingId: string,
  baseVersion: string,
  values: VotingSetupValues,
  session = cookie,
) {
  return request(
    'PUT',
    path(eventId, votingId),
    { baseVersion, values },
    session,
  );
}
async function seed() {
  const eventId = await event(),
    votingId = randomUUID();
  const teams = (
    await pool.query(
      "INSERT INTO teams(event_id,name) SELECT $1,'Same team' FROM generate_series(1,5) RETURNING id",
      [eventId],
    )
  ).rows.map((row) => row.id as string);
  const groups = (
    await pool.query(
      "INSERT INTO jury_groups(event_id,code,name) VALUES ($1,'T','Custom technical'),($1,'V','Custom second') RETURNING id",
      [eventId],
    )
  ).rows.map((row) => row.id as string);
  const values: VotingSetupValues = {
    ...initial(),
    configuration: {
      selectedPlaces: 1,
      maxPlusVotes: 2,
      maxMinusVotes: 1,
      allowNegativeVotes: true,
    },
    juryGroupIds: groups,
    items: teams.map((teamId, i) => ({
      id: randomUUID(),
      teamId,
      displayOrder: i,
    })),
  };
  return { eventId, votingId, teams, groups, values };
}
async function stored(eventId: string) {
  const tables = [
    'votings',
    'voting_items',
    'voting_allowed_groups',
    'audit_logs',
    'events',
  ];
  return Promise.all(
    tables.map(
      async (table) =>
        (
          await pool.query(
            `SELECT row_to_json(t)::text AS row FROM ${table} t WHERE ${table === 'events' ? 'id' : 'event_id'}=$1 ORDER BY row_to_json(t)::text`,
            [eventId],
          )
        ).rows,
    ),
  );
}

describe('combined category setup against local PostgreSQL', () => {
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
  it('reads a new template without writes; creates an incomplete category and replays exactly', async () => {
    const eventId = await event(),
      votingId = randomUUID(),
      before = await stored(eventId),
      base = await read(eventId, votingId);
    expect(base.voting).toBeNull();
    expect(await stored(eventId)).toEqual(before);
    const values = initial();
    expect(
      (await save(eventId, votingId, base.version, values)).json().status,
    ).toBe('saved');
    const saved = await stored(eventId);
    expect(
      (await save(eventId, votingId, base.version, values)).json().status,
    ).toBe('saved');
    expect(await stored(eventId)).toEqual(saved);
    expect((await read(eventId, votingId)).voting?.status).toBe('draft');
  });
  it('atomically saves all sections and swaps/reorders entries without changing IDs or untouched snapshots', async () => {
    const { eventId, votingId, values } = await seed(),
      base = await read(eventId, votingId);
    values.name = ' Category ';
    expect(
      (await save(eventId, votingId, base.version, values)).json().status,
    ).toBe('saved');
    let current = await read(eventId, votingId);
    expect(current.voting?.name).toBe('Category');
    expect(current.items).toHaveLength(5);
    expect(current.groups.map((group) => group.name)).toEqual([
      'Custom technical',
      'Custom second',
    ]);
    const before = (
      await pool.query(
        'SELECT * FROM voting_items WHERE voting_id=$1 ORDER BY id',
        [votingId],
      )
    ).rows;
    await pool.query(
      "UPDATE teams SET name='Corrected shared name',description='New description' WHERE id=$1",
      [values.items[2]!.teamId],
    );
    current = await read(eventId, votingId);
    const updated = structuredClone(values);
    updated.name = 'New';
    updated.instructions = ' Instructions ';
    updated.kind = 'selection';
    updated.juryGroupIds = updated.juryGroupIds.slice(0, 1);
    [updated.items[0]!.teamId, updated.items[1]!.teamId] = [
      updated.items[1]!.teamId,
      updated.items[0]!.teamId,
    ];
    updated.items[2]!.displayOrder = 12;
    expect(
      (await save(eventId, votingId, current.version, updated)).json().status,
    ).toBe('saved');
    const after = (
      await pool.query(
        'SELECT * FROM voting_items WHERE voting_id=$1 ORDER BY id',
        [votingId],
      )
    ).rows;
    expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id));
    const unchanged = after.find((row) => row.id === updated.items[2]!.id);
    expect(unchanged.name).toBe(
      before.find((row) => row.id === unchanged.id).name,
    );
    expect(unchanged.description).toBe('');
    const saved = await stored(eventId);
    expect(
      (await save(eventId, votingId, current.version, updated)).json().status,
    ).toBe('saved');
    expect(await stored(eventId)).toEqual(saved);
  });
  it('reports all field errors without creating any category, group, entry or audit', async () => {
    const { eventId, votingId, values } = await seed(),
      base = await read(eventId, votingId),
      before = await stored(eventId);
    values.name = ' ';
    values.kind = 'wrong';
    values.configuration = {
      selectedPlaces: 2,
      maxPlusVotes: 1,
      maxMinusVotes: 2,
      allowNegativeVotes: false,
    };
    values.items[0]!.teamId = randomUUID();
    values.items[1]!.displayOrder = null;
    const result = await save(eventId, votingId, base.version, values);
    expect(result.statusCode).toBe(200);
    expect(result.json().status).toBe('invalid');
    expect(result.json().issues.length).toBeGreaterThanOrEqual(6);
    expect(await stored(eventId)).toEqual(before);
  });
  it('rejects duplicate teams, foreign groups, omission, foreign entry IDs, duplicate IDs and extra claims', async () => {
    const { eventId, votingId, values } = await seed(),
      base = await read(eventId, votingId);
    expect(
      (await save(eventId, votingId, base.version, values)).json().status,
    ).toBe('saved');
    const current = await read(eventId, votingId),
      before = await stored(eventId);
    const duplicate = structuredClone(values);
    duplicate.items[1]!.teamId = duplicate.items[0]!.teamId;
    expect(
      (await save(eventId, votingId, current.version, duplicate)).json().status,
    ).toBe('invalid');
    expect(
      (
        await save(eventId, votingId, current.version, {
          ...values,
          juryGroupIds: [randomUUID()],
        })
      ).json().status,
    ).toBe('invalid');
    expect(
      (
        await save(eventId, votingId, current.version, {
          ...values,
          items: values.items.slice(1),
        })
      ).statusCode,
    ).toBe(409);
    const other = await seed();
    expect(
      (
        await save(
          other.eventId,
          other.votingId,
          (await read(other.eventId, other.votingId)).version,
          other.values,
        )
      ).statusCode,
    ).toBe(200);
    const collide = structuredClone(values);
    collide.items.push({
      ...other.values.items[0]!,
      teamId: values.items[0]!.teamId,
    });
    collide.items[0]!.teamId = null;
    expect(
      (await save(eventId, votingId, current.version, collide)).json().status,
    ).toBe('invalid');
    expect(
      (
        await request('PUT', path(eventId, votingId), {
          baseVersion: current.version,
          values: { ...values, items: [values.items[0], values.items[0]] },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request('PUT', path(eventId, votingId), {
          baseVersion: current.version,
          values,
          status: 'active',
        })
      ).statusCode,
    ).toBe(400);
    expect(await stored(eventId)).toEqual(before);
  });
  it('rolls back metadata/permissions and earlier entries after a later storage failure', async () => {
    const { eventId, votingId, values } = await seed(),
      base = await read(eventId, votingId),
      before = await stored(eventId);
    await pool.query(
      `CREATE FUNCTION fail_setup_item() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.display_order=444 THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END $$`,
    );
    await pool.query(
      'CREATE TRIGGER fail_setup_item BEFORE INSERT OR UPDATE ON voting_items FOR EACH ROW EXECUTE FUNCTION fail_setup_item()',
    );
    try {
      values.items[2]!.displayOrder = 444;
      expect(
        (await save(eventId, votingId, base.version, values)).statusCode,
      ).toBe(500);
      expect(await stored(eventId)).toEqual(before);
    } finally {
      await pool.query('DROP TRIGGER fail_setup_item ON voting_items');
      await pool.query('DROP FUNCTION fail_setup_item()');
    }
  });
  it('detects legacy metadata/config/group/team/item changes including precise timestamps', async () => {
    const { eventId, votingId, values, teams } = await seed(),
      base = await read(eventId, votingId);
    await save(eventId, votingId, base.version, values);
    for (const query of [
      "UPDATE votings SET instructions='remote' WHERE id=$1",
      "UPDATE votings SET updated_at=updated_at+interval '1 microsecond' WHERE id=$1",
      'UPDATE voting_items SET display_order=display_order+1 WHERE voting_id=$1',
      'UPDATE voting_allowed_groups SET jury_group_id=jury_group_id WHERE voting_id=$1',
    ]) {
      const current = await read(eventId, votingId);
      await pool.query(query, [votingId]);
      if (query.includes('jury_group_id=jury_group_id')) continue;
      expect(
        (
          await save(eventId, votingId, current.version, {
            ...values,
            name: randomUUID(),
          })
        ).statusCode,
      ).toBe(409);
    }
    const current = await read(eventId, votingId);
    await pool.query("UPDATE teams SET description='remote' WHERE id=$1", [
      teams[0],
    ]);
    expect(
      (
        await save(eventId, votingId, current.version, {
          ...values,
          name: 'local',
        })
      ).statusCode,
    ).toBe(409);
  });
  it('serializes identical new-category saves and conflicts with differing concurrent saves', async () => {
    const { eventId, votingId, values } = await seed(),
      base = await read(eventId, votingId);
    const identical = await Promise.all([
      save(eventId, votingId, base.version, values),
      save(eventId, votingId, base.version, values),
    ]);
    expect(identical.map((response) => response.statusCode)).toEqual([
      200, 200,
    ]);
    const current = await read(eventId, votingId);
    const differing = await Promise.all([
      save(eventId, votingId, current.version, { ...values, name: 'A' }),
      save(eventId, votingId, current.version, { ...values, name: 'B' }),
    ]);
    expect(differing.map((response) => response.statusCode).sort()).toEqual([
      200, 409,
    ]);
    expect((await read(eventId, votingId)).items).toHaveLength(5);
  });
  it('preserves legacy partial rules/unlinked snapshots but rejects new partial rules and clearing', async () => {
    const eventId = await event(),
      votingId = randomUUID();
    await pool.query(
      "INSERT INTO votings(id,event_id,name,kind,selected_places) VALUES($1,$2,'Legacy','final',1)",
      [votingId, eventId],
    );
    await pool.query(
      "INSERT INTO voting_items(event_id,voting_id,name) VALUES($1,$2,'Legacy item')",
      [eventId, votingId],
    );
    let current = await read(eventId, votingId);
    const values = {
      ...initial(),
      name: 'Corrected',
      configuration: { ...initial().configuration, selectedPlaces: 1 },
      items: current.items.map(({ id, teamId, displayOrder }) => ({
        id,
        teamId,
        displayOrder,
      })),
    };
    expect(
      (await save(eventId, votingId, current.version, values)).json().status,
    ).toBe('saved');
    current = await read(eventId, votingId);
    expect(
      (
        await save(eventId, votingId, current.version, {
          ...values,
          configuration: initial().configuration,
        })
      ).json().status,
    ).toBe('invalid');
    const nextId = randomUUID();
    expect(
      (
        await save(
          eventId,
          nextId,
          (await read(eventId, nextId)).version,
          values,
        )
      ).json().status,
    ).toBe('invalid');
  });
  it('never edits frozen configuration or history and allows only exact read-only confirmation after activation', async () => {
    const { eventId, votingId, values } = await seed();
    const base = await read(eventId, votingId);
    await save(eventId, votingId, base.version, values);
    for (const code of ['T', 'V'])
      await pool.query(
        "INSERT INTO event_jurors(event_id,jury_group_id,display_name) SELECT $1,id,'Juror' FROM jury_groups CROSS JOIN generate_series(1,5) WHERE event_id=$1 AND code=$2",
        [eventId, code],
      );
    expect(
      (await request('POST', `/votings/${votingId}/activate`, {})).statusCode,
    ).toBe(200);
    const before = await stored(eventId);
    expect(
      (await save(eventId, votingId, base.version, values)).json().status,
    ).toBe('saved');
    const current = await read(eventId, votingId);
    expect(current.editable).toBe(false);
    expect(
      (
        await save(eventId, votingId, current.version, {
          ...values,
          name: 'forbidden',
        })
      ).statusCode,
    ).toBe(409);
    expect(await stored(eventId)).toEqual(before);
  });
  it('enforces actor/origin/query/no-store/body-size guards', async () => {
    const { eventId, votingId, values } = await seed(),
      base = await read(eventId, votingId),
      url = path(eventId, votingId);
    expect((await request('GET', url, undefined, '')).statusCode).toBe(401);
    expect(
      (
        await request(
          'PUT',
          url,
          { baseVersion: base.version, values },
          cookie,
          {} as typeof headers,
        )
      ).statusCode,
    ).toBe(403);
    expect((await request('GET', url + '?actor=admin')).statusCode).toBe(400);
    expect((await request('GET', url)).headers['cache-control']).toContain(
      'no-store',
    );
    await pool.query(
      "INSERT INTO event_jurors(event_id,jury_group_id,display_name) SELECT $1,id,'Guard juror' FROM jury_groups WHERE event_id=$1 LIMIT 1",
      [eventId],
    );
    const secret = newSecret();
    await pool.query(
      'INSERT INTO sessions(token_hash,juror_id,event_id,expires_at) SELECT $1,j.id,j.event_id,NULL FROM event_jurors j WHERE j.event_id=$2 LIMIT 1',
      [secretHash(secret), eventId],
    );
    expect(
      (
        await save(eventId, votingId, base.version, {
          ...values,
          instructions: 'a'.repeat(70000),
        })
      ).statusCode,
    ).toBe(413);
    const jurorCookie = cookie.split('=')[0] + '=' + secret;
    expect((await request('GET', url, undefined, jurorCookie)).statusCode).toBe(
      403,
    );
    expect(
      (await save(eventId, votingId, base.version, values, jurorCookie))
        .statusCode,
    ).toBe(403);
    const next = await event();
    await save(eventId, votingId, base.version, values);
    expect(
      (
        await save(
          next,
          votingId,
          (await read(next, votingId)).version,
          initial(),
        )
      ).statusCode,
    ).toBe(409);
  });
  it.each(['revoke', 'expire', 'change', 'freeze'] as const)(
    'rechecks %s after a real event-lock wait',
    async (mode) => {
      const { eventId, votingId, values } = await seed(),
        base = await read(eventId, votingId);
      await save(eventId, votingId, base.version, values);
      const current = await read(eventId, votingId);
      const token = newSecret(),
        adminId = (
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
        await lock.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
          eventId,
        ]);
        const pending = Promise.resolve(
          save(
            eventId,
            votingId,
            current.version,
            { ...values, name: 'Pending local' },
            cookie.split('=')[0] + '=' + token,
          ),
        );
        const until = Date.now() + 3000;
        while (true) {
          const blocked = await pool.query(
            "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND pid<>pg_backend_pid()",
          );
          if (blocked.rowCount) break;
          if (Date.now() > until)
            throw Error('Expected actual event lock wait');
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        if (mode === 'revoke')
          await lock.query(
            'UPDATE sessions SET revoked_at=statement_timestamp() WHERE token_hash=$1',
            [secretHash(token)],
          );
        else if (mode === 'expire')
          await lock.query(
            "UPDATE sessions SET created_at=now()-interval '2 hours',expires_at=statement_timestamp()-interval '1 second' WHERE token_hash=$1",
            [secretHash(token)],
          );
        else if (mode === 'change')
          await lock.query(
            "UPDATE votings SET instructions='Other writer' WHERE id=$1",
            [votingId],
          );
        else
          await lock.query("UPDATE votings SET status='active' WHERE id=$1", [
            votingId,
          ]);
        await lock.query('COMMIT');
        expect((await pending).statusCode).toBe(
          mode === 'revoke' || mode === 'expire' ? 401 : 409,
        );
        expect((await read(eventId, votingId)).voting?.name).toBe('Category');
      } finally {
        await lock.query('ROLLBACK');
        lock.release();
      }
    },
  );
  it('rolls back all setup resources when authorization is lost at transaction completion', async () => {
    const { eventId, votingId, values } = await seed(),
      base = await read(eventId, votingId),
      before = await stored(eventId);
    await pool.query(
      'CREATE FUNCTION revoke_on_setup_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE sessions SET revoked_at=statement_timestamp() WHERE admin_user_id IS NOT NULL; RETURN NEW; END $$',
    );
    await pool.query(
      'CREATE TRIGGER revoke_on_setup_write AFTER INSERT ON voting_items FOR EACH ROW EXECUTE FUNCTION revoke_on_setup_write()',
    );
    try {
      expect(
        (await save(eventId, votingId, base.version, values)).statusCode,
      ).toBe(401);
      expect(await stored(eventId)).toEqual(before);
    } finally {
      await pool.query('DROP TRIGGER revoke_on_setup_write ON voting_items');
      await pool.query('DROP FUNCTION revoke_on_setup_write()');
    }
  });
  it('rejects cross-category entry-ID collisions with rollback', async () => {
    const { eventId, votingId, values } = await seed(),
      base = await read(eventId, votingId);
    await save(eventId, votingId, base.version, values);
    const nextId = randomUUID(),
      next = await read(eventId, nextId),
      before = await stored(eventId);
    expect((await save(eventId, nextId, next.version, values)).statusCode).toBe(
      409,
    );
    expect(await stored(eventId)).toEqual(before);
  });
  it('treats any ballot as a category freeze, preserving choices, history, access and sessions exactly', async () => {
    const { eventId, votingId, values } = await seed(),
      base = await read(eventId, votingId);
    await save(eventId, votingId, base.version, values);
    const juror = (
      await pool.query(
        "INSERT INTO event_jurors(event_id,jury_group_id,display_name) VALUES($1,$2,'History juror') RETURNING id",
        [eventId, values.juryGroupIds[0]],
      )
    ).rows[0].id;
    const ballot = (
      await pool.query(
        "INSERT INTO ballots(event_id,voting_id,juror_id,status) VALUES($1,$2,$3,'draft') RETURNING id",
        [eventId, votingId, juror],
      )
    ).rows[0].id;
    await pool.query(
      'INSERT INTO ballot_entries(event_id,voting_id,ballot_id,voting_item_id,vote_value) VALUES($1,$2,$3,$4,1)',
      [eventId, votingId, ballot, values.items[0]!.id],
    );
    await pool.query(
      "INSERT INTO audit_logs(event_id,action,target_type,target_id,context) VALUES($1,'fixture.history','ballot',$2,'{}')",
      [eventId, ballot],
    );
    const tables = [
      'ballots',
      'ballot_entries',
      'audit_logs',
      'juror_access',
      'sessions',
    ];
    const captured = async () =>
      Promise.all(
        tables.map(
          async (table) =>
            (
              await pool.query(
                `SELECT row_to_json(t)::text AS row FROM ${table} t ORDER BY row_to_json(t)::text`,
              )
            ).rows,
        ),
      );
    const before = await captured(),
      storedBefore = await stored(eventId),
      current = await read(eventId, votingId);
    expect(current.editable).toBe(false);
    expect(
      (
        await save(eventId, votingId, current.version, {
          ...values,
          name: 'Rejected',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await save(eventId, votingId, base.version, values)).json().status,
    ).toBe('saved');
    expect(await captured()).toEqual(before);
    expect(await stored(eventId)).toEqual(storedBefore);
  });
});
