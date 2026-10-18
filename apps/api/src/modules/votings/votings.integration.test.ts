import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  votingRecordSchema,
  votingListSchema,
  teamRecordSchema,
  votingItemRecordSchema,
} from '@d21/contracts';
import { readEnvironment } from '../../config';
import { dropTestDatabase } from '../../db/test-database';
import { buildApp } from '../../app';
import { createAuthService, setAdminPassword } from '../auth/service';
import { newSecret, secretHash } from '../auth/crypto';
import { createEventService } from '../events/service';
import { createVotingService } from './service';
import { requireReadyRoster } from './readiness';
import { withEventLock } from '../events/locking';

const databaseName = `d21_votings_test_${randomUUID().replaceAll('-', '')}`;
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
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  payload?: object,
  session = cookie,
  requestHeaders: Record<string, string> = headers,
) {
  return app.inject({
    method,
    url: path,
    headers: { ...requestHeaders, ...(session ? { cookie: session } : {}) },
    payload,
  });
}
async function event() {
  return (
    await pool.query(
      "INSERT INTO events (name) VALUES ('Voting test') RETURNING id",
    )
  ).rows[0].id as string;
}
const input = {
  name: ' Overall ',
  instructions: ' Instructions ',
  kind: 'final',
};
async function voting(eventId: string) {
  const result = await request('POST', `/events/${eventId}/votings`, input);
  expect(result.statusCode).toBe(201);
  return votingRecordSchema.parse(result.json());
}
async function team(eventId: string, name = 'Same team') {
  const result = await request('POST', `/events/${eventId}/teams`, {
    name,
    description: '',
  });
  expect(result.statusCode).toBe(201);
  return teamRecordSchema.parse(result.json());
}
async function item(votingId: string, teamId: string, displayOrder = 0) {
  const result = await request('POST', `/votings/${votingId}/items`, {
    teamId,
    displayOrder,
  });
  expect(result.statusCode).toBe(201);
  return votingItemRecordSchema.parse(result.json());
}

async function roster(eventId: string, t = 5, v: number | null = 5) {
  const groups: string[] = [];
  for (const [code, count] of [
    ['T', t],
    ['V', v],
  ] as const) {
    if (count === null) continue;
    const group = (
      await pool.query(
        'INSERT INTO jury_groups(event_id,code,name) VALUES ($1,$2::jury_group_code,$2::text) RETURNING id',
        [eventId, code],
      )
    ).rows[0].id as string;
    groups.push(group);
    await pool.query(
      "INSERT INTO event_jurors(event_id,jury_group_id,display_name) SELECT $1,$2,'Juror ' || n FROM generate_series(1,$3::int) n",
      [eventId, group, count],
    );
  }
  return groups;
}

const limits = {
  selectedPlaces: 1,
  maxPlusVotes: 2,
  maxMinusVotes: 1,
  allowNegativeVotes: true,
};
async function prepared(size = 5, groupsChoice = 'both') {
  const record = await voting(await event());
  const groups = await roster(record.eventId, size, size);
  for (let i = 0; i < 4; i++)
    await item(record.id, (await team(record.eventId, `Team ${i + 1}`)).id, i);
  expect(
    (await request('PUT', `/votings/${record.id}/configuration`, limits))
      .statusCode,
  ).toBe(200);
  const selected =
    groupsChoice === 'T'
      ? [groups[0]]
      : groupsChoice === 'V'
        ? [groups[1]]
        : groups;
  expect(
    (
      await request('PUT', `/votings/${record.id}/allowed-groups`, {
        juryGroupIds: selected,
      })
    ).statusCode,
  ).toBe(200);
  return { ...record, groups };
}

describe('draft voting preparation against PostgreSQL', () => {
  beforeAll(async () => {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    await migrate(drizzle(pool), {
      migrationsFolder: fileURLToPath(
        new URL('../../db/migrations', import.meta.url),
      ),
    });
    await setAdminPassword(pool, 'phase four disposable password');
    app = buildApp({
      checkDatabase: async () => {},
      auth: {
        service: createAuthService(pool),
        origin: headers.origin,
        events: createEventService(pool, createAuthService(pool)),
        votings: createVotingService(pool, createAuthService(pool)),
      },
    });
    const login = await request(
      'POST',
      '/auth/admin/login',
      { password: 'phase four disposable password' },
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

  it.each([5, 7, 9])(
    'accepts equal T/V rosters of %i under the event lock',
    async (size) => {
      const eventId = await event();
      await roster(eventId, size, size);
      await expect(
        withEventLock(pool, eventId, (client) =>
          requireReadyRoster(client, eventId),
        ),
      ).resolves.toBeUndefined();
    },
  );

  it.each([
    [0, 0],
    [4, 4],
    [6, 6],
    [8, 8],
    [10, 10],
    [5, 7],
    [5, null],
  ])(
    'rejects incomplete or unequal T/V rosters (%s/%s) without freezing setup',
    async (t, v) => {
      const eventId = await event();
      await roster(eventId, t!, v!);
      await expect(
        withEventLock(pool, eventId, (client) =>
          requireReadyRoster(client, eventId),
        ),
      ).rejects.toMatchObject({ code: 'ROSTER_NOT_READY' });
      expect(
        (
          await pool.query('SELECT roster_locked_at FROM events WHERE id=$1', [
            eventId,
          ])
        ).rows[0].roster_locked_at,
      ).toBeNull();
    },
  );

  it.each(['selection', 'final'] as const)(
    'configures and activates %s with three advancing teams or winners and an explicit four-plus/two-minus allowance',
    async (kind) => {
      const record = await prepared();
      for (let i = 4; i < 8; i++)
        await item(
          record.id,
          (await team(record.eventId, `Team ${i + 1}`)).id,
          i,
        );
      expect(
        (await request('PATCH', `/votings/${record.id}`, { kind })).statusCode,
      ).toBe(200);
      const explicit = {
        selectedPlaces: 3,
        maxPlusVotes: 4,
        maxMinusVotes: 2,
        allowNegativeVotes: true,
      };
      expect(
        (await request('PUT', `/votings/${record.id}/configuration`, explicit))
          .statusCode,
      ).toBe(200);
      const activated = await request(
        'POST',
        `/votings/${record.id}/activate`,
        {},
      );
      expect(activated.statusCode).toBe(200);
      expect(activated.json()).toMatchObject({
        ...explicit,
        status: 'active',
        kind,
      });
    },
  );

  it('stores explicit limits without defaults or automatic rounding and rejects invalid tuples atomically', async () => {
    const record = await voting(await event());
    const path = `/votings/${record.id}/configuration`;
    const saved = await request('PUT', path, limits);
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject(limits);
    for (const bad of [
      { ...limits, maxPlusVotes: 1 },
      { ...limits, maxMinusVotes: 2 },
      { ...limits, allowNegativeVotes: false },
      { ...limits, selectedPlaces: 0 },
      { ...limits, maxPlusVotes: 2.5 },
      { ...limits, maxPlusVotes: '2' },
      { ...limits, maxPlusVotes: 2147483648 },
      { ...limits, eventId: randomUUID() },
      {},
    ]) {
      expect((await request('PUT', path, bad)).statusCode).toBe(400);
      expect((await request('GET', `/votings/${record.id}`)).json()).toEqual(
        saved.json(),
      );
    }
    expect(
      (
        await request('PUT', path, {
          ...limits,
          maxMinusVotes: 0,
          allowNegativeVotes: false,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await pool.query('SELECT roster_locked_at FROM events WHERE id=$1', [
          record.eventId,
        ])
      ).rows[0].roster_locked_at,
    ).toBeNull();
    expect(
      (await request('PUT', `/votings/${randomUUID()}/configuration`, limits))
        .statusCode,
    ).toBe(404);
  });

  it.each([
    [5, 'T'],
    [7, 'V'],
    [9, 'both'],
  ] as const)(
    'activates valid setup with %i jurors per group and %s permission, freezes configuration and supports retries',
    async (size, choice) => {
      const record = await prepared(size, choice);
      if (choice === 'T')
        expect(
          (
            await request('PATCH', `/votings/${record.id}`, {
              kind: 'selection',
            })
          ).statusCode,
        ).toBe(200);
      const activated = await request(
        'POST',
        `/votings/${record.id}/activate`,
        {},
      );
      expect(activated.statusCode).toBe(200);
      expect(activated.json()).toMatchObject({ ...limits, status: 'active' });
      expect(
        (await request('POST', `/votings/${record.id}/activate`)).json(),
      ).toEqual(activated.json());
      expect(
        (
          await pool.query('SELECT roster_locked_at FROM events WHERE id=$1', [
            record.eventId,
          ])
        ).rows[0].roster_locked_at,
      ).not.toBeNull();
      expect(
        (
          await request('PUT', `/votings/${record.id}/configuration`, {
            ...limits,
            maxMinusVotes: 0,
            allowNegativeVotes: false,
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await request('PUT', `/votings/${record.id}/allowed-groups`, {
            juryGroupIds: [],
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await request('POST', `/events/${record.eventId}/jurors`, {
            displayName: 'Late juror',
            juryGroupId: record.groups[0],
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (await request('POST', `/votings/${record.id}/close`, {})).statusCode,
      ).toBe(200);
      expect(
        (await request('POST', `/votings/${record.id}/activate`, {}))
          .statusCode,
      ).toBe(409);
      expect(
        (await request('POST', `/votings/${record.id}/reopen`, {})).statusCode,
      ).toBe(200);
      expect(
        (await request('GET', `/votings/${record.id}`)).json(),
      ).toMatchObject(limits);
    },
  );

  it.each([
    'configuration',
    'groups',
    'entries',
    'unlinked',
    'limits',
    'roster',
    'places',
  ])(
    'rejects invalid activation (%s) without changing status or freezing setup',
    async (problem) => {
      const record = await prepared();
      if (problem === 'configuration')
        await pool.query('UPDATE votings SET max_plus_votes=NULL WHERE id=$1', [
          record.id,
        ]);
      if (problem === 'groups')
        await request('PUT', `/votings/${record.id}/allowed-groups`, {
          juryGroupIds: [],
        });
      if (problem === 'entries')
        await pool.query('DELETE FROM voting_items WHERE voting_id=$1', [
          record.id,
        ]);
      if (problem === 'unlinked')
        await pool.query(
          'UPDATE voting_items SET team_id=NULL WHERE voting_id=$1',
          [record.id],
        );
      if (problem === 'limits')
        await request('PUT', `/votings/${record.id}/configuration`, {
          ...limits,
          maxPlusVotes: 3,
        });
      if (problem === 'places')
        await request('PUT', `/votings/${record.id}/configuration`, {
          ...limits,
          selectedPlaces: 4,
          maxPlusVotes: 5,
        });
      if (problem === 'roster')
        await pool.query(
          'DELETE FROM event_jurors WHERE id=(SELECT id FROM event_jurors WHERE event_id=$1 LIMIT 1)',
          [record.eventId],
        );
      const before = (await request('GET', `/votings/${record.id}`)).json();
      const result = await request(
        'POST',
        `/votings/${record.id}/activate`,
        {},
      );
      expect(result.statusCode).toBe(409);
      expect((await request('GET', `/votings/${record.id}`)).json()).toEqual(
        before,
      );
      expect(
        (
          await pool.query('SELECT roster_locked_at FROM events WHERE id=$1', [
            record.eventId,
          ])
        ).rows[0].roster_locked_at,
      ).toBeNull();
    },
  );

  it('validates activation body/identifier and rejects draft ballot history while retaining all references', async () => {
    const record = await prepared();
    expect(
      (await request('POST', `/votings/${record.id}/activate`, { force: true }))
        .statusCode,
    ).toBe(400);
    expect(
      (await request('POST', `/votings/${randomUUID()}/activate`, {}))
        .statusCode,
    ).toBe(404);
    expect(
      (await request('POST', '/votings/invalid/activate', {})).statusCode,
    ).toBe(400);
    const juror = (
      await pool.query(
        'SELECT id FROM event_jurors WHERE event_id=$1 LIMIT 1',
        [record.eventId],
      )
    ).rows[0].id;
    await pool.query(
      'INSERT INTO ballots(event_id,voting_id,juror_id) VALUES ($1,$2,$3)',
      [record.eventId, record.id, juror],
    );
    expect(
      (await request('POST', `/votings/${record.id}/activate`, {})).statusCode,
    ).toBe(409);
    expect(
      (await request('PUT', `/votings/${record.id}/configuration`, limits))
        .statusCode,
    ).toBe(409);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS count FROM ballots WHERE voting_id=$1',
          [record.id],
        )
      ).rows[0].count,
    ).toBe(1);
  });

  it('serializes activation against real roster removal and rechecks the winning transaction', async () => {
    const record = await prepared();
    const juror = (
      await pool.query(
        'SELECT id FROM event_jurors WHERE event_id=$1 LIMIT 1',
        [record.eventId],
      )
    ).rows[0].id;
    const [activation, removal] = await Promise.all([
      request('POST', `/votings/${record.id}/activate`, {}),
      request('DELETE', `/events/${record.eventId}/jurors/${juror}`),
    ]);
    expect([
      [200, 409],
      [409, 204],
    ]).toContainEqual([activation.statusCode, removal.statusCode]);
    const state = (await request('GET', `/votings/${record.id}`)).json();
    const frozen = (
      await pool.query('SELECT roster_locked_at FROM events WHERE id=$1', [
        record.eventId,
      ])
    ).rows[0].roster_locked_at;
    expect(state.status).toBe(
      activation.statusCode === 200 ? 'active' : 'draft',
    );
    expect(frozen !== null).toBe(activation.statusCode === 200);
  });

  it('waits for the event lock then rejects a roster changed before activation; other events remain independent', async () => {
    const record = await prepared();
    const other = await prepared();
    const blocker = await pool.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
        record.eventId,
      ]);
      const pending = request(
        'POST',
        `/votings/${record.id}/activate`,
        {},
      ).then((result) => result);
      let waiting = false;
      const until = Date.now() + 3000;
      while (Date.now() < until) {
        const result = await pool.query(
          "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT roster_locked_at FROM events%'",
        );
        if (result.rowCount) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
      expect(
        (await request('POST', `/votings/${other.id}/activate`, {})).statusCode,
      ).toBe(200);
      await blocker.query(
        'DELETE FROM event_jurors WHERE id=(SELECT id FROM event_jurors WHERE event_id=$1 LIMIT 1)',
        [record.eventId],
      );
      await blocker.query('COMMIT');
      expect((await pending).json().error.code).toBe('ROSTER_NOT_READY');
      expect(
        (
          await pool.query('SELECT roster_locked_at FROM events WHERE id=$1', [
            record.eventId,
          ])
        ).rows[0].roster_locked_at,
      ).toBeNull();
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
  });

  it('creates, lists, reads and edits selection/final drafts without configuring D21 or freezing the roster', async () => {
    const eventId = await event();
    expect((await request('GET', `/events/${eventId}/votings`)).json()).toEqual(
      [],
    );
    const record = await voting(eventId);
    expect(record).toMatchObject({
      name: 'Overall',
      instructions: 'Instructions',
      status: 'draft',
      kind: 'final',
      eventId,
    });
    const patch = await request('PATCH', `/votings/${record.id}`, {
      kind: 'selection',
      instructions: '',
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json()).toMatchObject({
      kind: 'selection',
      instructions: '',
      name: 'Overall',
    });
    expect((await request('GET', `/votings/${record.id}`)).json()).toEqual(
      patch.json(),
    );
    expect(
      votingListSchema.parse(
        (await request('GET', `/events/${eventId}/votings`)).json(),
      ),
    ).toEqual([patch.json()]);
    expect(
      (
        await pool.query(
          'SELECT selected_places, max_plus_votes, max_minus_votes, allow_negative_votes, deadline FROM votings WHERE id = $1',
          [record.id],
        )
      ).rows[0],
    ).toEqual({
      selected_places: null,
      max_plus_votes: null,
      max_minus_votes: null,
      allow_negative_votes: null,
      deadline: null,
    });
    expect(
      (
        await pool.query('SELECT roster_locked_at FROM events WHERE id = $1', [
          eventId,
        ])
      ).rows[0].roster_locked_at,
    ).toBeNull();
  });

  it('isolates event lists and rejects missing resources and malformed identifiers', async () => {
    const a = await event(),
      b = await event();
    const record = await voting(a);
    expect((await request('GET', `/events/${b}/votings`)).json()).toEqual([]);
    expect(
      (await request('PATCH', `/votings/${record.id}`, { eventId: b }))
        .statusCode,
    ).toBe(400);
    for (const path of [
      `/events/${randomUUID()}/votings`,
      `/votings/${randomUUID()}`,
    ])
      expect((await request('GET', path)).statusCode).toBe(404);
    expect(
      (await request('POST', `/events/${randomUUID()}/votings`, input))
        .statusCode,
    ).toBe(404);
    expect(
      (await request('PATCH', `/votings/${randomUUID()}`, { name: 'Missing' }))
        .statusCode,
    ).toBe(404);
    expect((await request('GET', '/votings/invalid')).statusCode).toBe(400);
    expect((await request('GET', '/events/invalid/votings')).statusCode).toBe(
      400,
    );
  });

  it('rejects unknown fields, empty patches, invalid names/kinds and configuration through metadata', async () => {
    const eventId = await event();
    const record = await voting(eventId);
    for (const body of [
      {},
      { name: ' ' },
      { kind: 'elimination' },
      { instructions: 'a'.repeat(5001) },
      { status: 'active' },
      { maxPlusVotes: 3 },
      { selectedPlaces: 1 },
      { deadline: '2026-10-17T10:00:00Z' },
    ]) {
      expect(
        (await request('PATCH', `/votings/${record.id}`, body)).statusCode,
      ).toBe(400);
    }
    expect(
      (
        await request('POST', `/events/${eventId}/votings`, {
          ...input,
          name: 'a'.repeat(201),
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request('POST', `/events/${eventId}/votings`, {
          ...input,
          status: 'active',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await request('POST', `/votings/${record.id}/activate`, {})).statusCode,
    ).toBe(409);
    expect(
      (await request('POST', `/votings/${record.id}/close`, {})).statusCode,
    ).toBe(409);
    expect((await request('DELETE', `/votings/${record.id}`)).statusCode).toBe(
      404,
    );
  });

  it('guards every route for anonymous, expired, revoked and juror sessions and preserves origin checks', async () => {
    const eventId = await event();
    const record = await voting(eventId);
    const group = (
      await pool.query(
        "INSERT INTO jury_groups (event_id, code, name) VALUES ($1, 'T', 'T') RETURNING id",
        [eventId],
      )
    ).rows[0].id;
    const juror = (
      await pool.query(
        "INSERT INTO event_jurors (event_id,jury_group_id,display_name) VALUES ($1,$2,'Juror') RETURNING id",
        [eventId, group],
      )
    ).rows[0].id;
    const jurorToken = newSecret();
    await pool.query(
      "INSERT INTO sessions (token_hash,event_id,juror_id,expires_at) VALUES ($1,$2,$3,now()+interval '1 hour')",
      [secretHash(jurorToken), eventId, juror],
    );
    const user = (await pool.query('SELECT user_id FROM admin_access')).rows[0]
      .user_id;
    const invalid: string[] = [''];
    const sharedTeam = await team(eventId);
    const votingItem = await item(record.id, sharedTeam.id);
    for (const state of ['expired', 'revoked']) {
      const token = newSecret();
      await pool.query(
        "INSERT INTO sessions (token_hash,admin_user_id,created_at,expires_at,revoked_at) VALUES ($1,$2,now()-interval '2 hours',now()+($3::int * interval '1 hour'),CASE WHEN $4 THEN now() END)",
        [
          secretHash(token),
          user,
          state === 'expired' ? -1 : 1,
          state === 'revoked',
        ],
      );
      invalid.push(`d21-session=${token}`);
    }
    const routes = [
      {
        method: 'PUT' as const,
        path: `/votings/${record.id}/configuration`,
        payload: limits,
      },
      {
        method: 'POST' as const,
        path: `/votings/${record.id}/activate`,
        payload: {},
      },
      {
        method: 'POST' as const,
        path: `/votings/${record.id}/reopen`,
        payload: {},
      },
      {
        method: 'POST' as const,
        path: `/votings/${record.id}/close`,
        payload: {},
      },
      {
        method: 'GET' as const,
        path: `/events/${eventId}/teams`,
        payload: undefined,
      },
      {
        method: 'POST' as const,
        path: `/events/${eventId}/teams`,
        payload: { name: 'Team', description: '' },
      },
      {
        method: 'PATCH' as const,
        path: `/events/${eventId}/teams/${sharedTeam.id}`,
        payload: { name: 'Changed' },
      },
      {
        method: 'GET' as const,
        path: `/votings/${record.id}/items`,
        payload: undefined,
      },
      {
        method: 'POST' as const,
        path: `/votings/${record.id}/items`,
        payload: { teamId: sharedTeam.id, displayOrder: 0 },
      },
      {
        method: 'PATCH' as const,
        path: `/votings/${record.id}/items/${votingItem.id}`,
        payload: { displayOrder: 1 },
      },
      {
        method: 'GET' as const,
        path: `/votings/${record.id}/allowed-groups`,
        payload: undefined,
      },
      {
        method: 'PUT' as const,
        path: `/votings/${record.id}/allowed-groups`,
        payload: { juryGroupIds: [group] },
      },
      {
        method: 'GET' as const,
        path: `/events/${eventId}/votings`,
        payload: undefined,
      },
      {
        method: 'POST' as const,
        path: `/events/${eventId}/votings`,
        payload: input,
      },
      {
        method: 'GET' as const,
        path: `/votings/${record.id}`,
        payload: undefined,
      },
      {
        method: 'PATCH' as const,
        path: `/votings/${record.id}`,
        payload: { name: 'Changed' },
      },
    ];
    for (const route of routes) {
      for (const session of invalid)
        expect(
          (await request(route.method, route.path, route.payload, session))
            .statusCode,
        ).toBe(401);
      expect(
        (
          await request(
            route.method,
            route.path,
            route.payload,
            `d21-session=${jurorToken}`,
          )
        ).statusCode,
      ).toBe(403);
      if (route.method !== 'GET') {
        expect(
          (await request(route.method, route.path, route.payload, cookie, {}))
            .statusCode,
        ).toBe(403);
        expect(
          (
            await request(route.method, route.path, route.payload, cookie, {
              ...headers,
              origin: 'https://other.example',
            })
          ).statusCode,
        ).toBe(403);
      }
    }
  });

  it.each(['active', 'closed', 'archived'])(
    'rejects configuration edits to %s voting after first activation',
    async (status) => {
      const record = await voting(await event());
      await pool.query('UPDATE votings SET status = $2 WHERE id = $1', [
        record.id,
        status,
      ]);
      const response = await request('PATCH', `/votings/${record.id}`, {
        name: 'Changed',
      });
      expect(response.statusCode).toBe(409);
      expect(
        (await request('PUT', `/votings/${record.id}/configuration`, limits))
          .statusCode,
      ).toBe(409);
      expect(response.json().error.code).toBe('VOTING_NOT_EDITABLE');
      expect(
        (
          await request('PUT', `/votings/${record.id}/allowed-groups`, {
            juryGroupIds: [],
          })
        ).statusCode,
      ).toBe(409);
      expect((await request('GET', `/votings/${record.id}`)).json().name).toBe(
        'Overall',
      );
    },
  );

  it.each(['details', 'groups'])(
    'rejects %s edits to drafts with ballot history and serializes with an event-first activation fixture',
    async (operation) => {
      const record = await voting(await event());
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM events WHERE id = $1 FOR UPDATE', [
          record.eventId,
        ]);
        const pending = (
          operation === 'details'
            ? request('PATCH', `/votings/${record.id}`, { name: 'Racing edit' })
            : request('PUT', `/votings/${record.id}/allowed-groups`, {
                juryGroupIds: [],
              })
        ).then((value) => value);
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
        expect(waiting, 'draft edit must wait for the parent event lock').toBe(
          true,
        );
        await client.query(
          "UPDATE votings SET status = 'active' WHERE id = $1",
          [record.id],
        );
        await client.query('COMMIT');
        expect((await pending).statusCode).toBe(409);
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
      const draft = await voting(await event());
      const group = (
        await pool.query(
          "INSERT INTO jury_groups (event_id, code, name) VALUES ($1, 'T', 'T') RETURNING id",
          [draft.eventId],
        )
      ).rows[0].id;
      const juror = (
        await pool.query(
          "INSERT INTO event_jurors (event_id,jury_group_id,display_name) VALUES ($1,$2,'Juror') RETURNING id",
          [draft.eventId, group],
        )
      ).rows[0].id;
      await pool.query(
        'INSERT INTO ballots (event_id,voting_id,juror_id) VALUES ($1,$2,$3)',
        [draft.eventId, draft.id, juror],
      );
      expect(
        (
          await request('PATCH', `/votings/${draft.id}`, {
            instructions: 'Changed',
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await request('PUT', `/votings/${draft.id}/allowed-groups`, {
            juryGroupIds: [],
          })
        ).statusCode,
      ).toBe(409);
    },
  );

  it('persists T-only, V-only, combined and incomplete draft permissions without freezing the roster', async () => {
    const record = await voting(await event());
    const result = await pool.query(
      "INSERT INTO jury_groups (event_id,code,name) VALUES ($1,'T','Technical'),($1,'V','Second') RETURNING id,code",
      [record.eventId],
    );
    const t = result.rows.find((group) => group.code === 'T').id as string;
    const v = result.rows.find((group) => group.code === 'V').id as string;
    const path = `/votings/${record.id}/allowed-groups`;
    expect((await request('GET', path)).json()).toEqual([]);
    for (const ids of [[t], [v], [v, t], [t, v], []]) {
      const saved = await request('PUT', path, { juryGroupIds: ids });
      expect(saved.statusCode).toBe(200);
      expect(
        saved
          .json()
          .map((group: { id: string }) => group.id)
          .sort(),
      ).toEqual([...ids].sort());
      expect((await request('GET', path)).json()).toEqual(saved.json());
      expect(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM voting_allowed_groups WHERE voting_id = $1',
            [record.id],
          )
        ).rows[0].n,
      ).toBe(ids.length);
    }
    expect(
      (
        await pool.query('SELECT roster_locked_at FROM events WHERE id = $1', [
          record.eventId,
        ])
      ).rows[0].roster_locked_at,
    ).toBeNull();
  });

  it('rejects foreign/missing/duplicate group IDs and preserves prior draft permissions atomically', async () => {
    const a = await voting(await event()),
      b = await voting(await event());
    const first = (
      await pool.query(
        "INSERT INTO jury_groups (event_id,code,name) VALUES ($1,'T','Technical') RETURNING id",
        [a.eventId],
      )
    ).rows[0].id;
    const foreign = (
      await pool.query(
        "INSERT INTO jury_groups (event_id,code,name) VALUES ($1,'V','Second') RETURNING id",
        [b.eventId],
      )
    ).rows[0].id;
    const path = `/votings/${a.id}/allowed-groups`;
    const initial = await request('PUT', path, { juryGroupIds: [first] });
    expect(initial.statusCode).toBe(200);
    for (const body of [
      { juryGroupIds: [foreign] },
      { juryGroupIds: [first, foreign] },
      { juryGroupIds: [randomUUID()] },
      { juryGroupIds: [first, first] },
      { juryGroupIds: ['invalid'] },
      {},
      { juryGroupIds: [], eventId: b.eventId },
    ]) {
      expect((await request('PUT', path, body)).statusCode).toBe(400);
      expect((await request('GET', path)).json()).toEqual(initial.json());
    }
    expect(
      (await request('GET', `/votings/${b.id}/allowed-groups`)).json(),
    ).toEqual([]);
    expect(
      (await request('GET', `/votings/${randomUUID()}/allowed-groups`))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await request('PUT', `/votings/${randomUUID()}/allowed-groups`, {
          juryGroupIds: [],
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await request('GET', '/votings/invalid/allowed-groups')).statusCode,
    ).toBe(400);
  });

  it('shares event teams across categories and propagates descriptive corrections without rewriting snapshots', async () => {
    const e = await event(),
      a = await voting(e),
      b = await voting(e);
    expect((await request('GET', `/events/${e}/teams`)).json()).toEqual([]);
    const shared = await team(e, ' Shared team '),
      sameName = await team(e, 'Shared team');
    expect(shared.id).not.toBe(sameName.id);
    const first = await item(a.id, shared.id),
      second = await item(b.id, shared.id);
    await pool.query("UPDATE votings SET status='active' WHERE id=$1", [a.id]);
    const correction = await request(
      'PATCH',
      `/events/${e}/teams/${shared.id}`,
      { name: 'Corrected team', description: 'Corrected description' },
    );
    expect(correction.statusCode).toBe(200);
    for (const votingId of [a.id, b.id])
      expect(
        (await request('GET', `/votings/${votingId}/items`)).json()[0],
      ).toMatchObject({
        name: 'Corrected team',
        description: 'Corrected description',
        teamId: shared.id,
      });
    expect(
      (
        await pool.query(
          'SELECT name FROM voting_items WHERE id=ANY($1::uuid[])',
          [[first.id, second.id]],
        )
      ).rows.every((row) => row.name === 'Shared team'),
    ).toBe(true);
    expect((await request('GET', `/events/${e}/teams`)).json()).toHaveLength(2);
    expect(
      (await request('DELETE', `/events/${e}/teams/${shared.id}`)).statusCode,
    ).toBe(404);
    expect(
      (await request('DELETE', `/votings/${a.id}/items/${first.id}`))
        .statusCode,
    ).toBe(404);
  });

  it('adds and reorders/reassigns draft entries while preserving distinct item IDs', async () => {
    const record = await voting(await event()),
      a = await team(record.eventId, 'A'),
      b = await team(record.eventId, 'B');
    const first = await item(record.id, a.id, 5);
    const changed = await request(
      'PATCH',
      `/votings/${record.id}/items/${first.id}`,
      { teamId: b.id, displayOrder: 2 },
    );
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({
      id: first.id,
      teamId: b.id,
      name: 'B',
      displayOrder: 2,
    });
    await item(record.id, a.id, 1);
    expect(
      (await request('GET', `/votings/${record.id}/items`))
        .json()
        .map((entry: { displayOrder: number }) => entry.displayOrder),
    ).toEqual([1, 2]);
    expect(
      (
        await pool.query('SELECT roster_locked_at FROM events WHERE id=$1', [
          record.eventId,
        ])
      ).rows[0].roster_locked_at,
    ).toBeNull();
  });

  it('enforces team/item event isolation, strict payloads and composite database references', async () => {
    const a = await voting(await event()),
      b = await voting(await event());
    const ta = await team(a.eventId),
      tb = await team(b.eventId);
    const ia = await item(a.id, ta.id);
    expect(
      (
        await request('PATCH', `/events/${b.eventId}/teams/${ta.id}`, {
          name: 'Foreign',
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await request('GET', `/events/${b.eventId}/teams`)).json(),
    ).toHaveLength(1);
    expect(
      (
        await request('POST', `/votings/${a.id}/items`, {
          teamId: tb.id,
          displayOrder: 0,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request('PATCH', `/votings/${b.id}/items/${ia.id}`, {
          displayOrder: 2,
        })
      ).statusCode,
    ).toBe(404);
    for (const payload of [
      { teamId: ta.id, displayOrder: -1 },
      { teamId: ta.id, displayOrder: 1.5 },
      { teamId: ta.id, displayOrder: 0, eventId: b.eventId },
      { name: 'Independent item', displayOrder: 0 },
    ])
      expect(
        (await request('POST', `/votings/${a.id}/items`, payload)).statusCode,
      ).toBe(400);
    expect(
      (await request('PATCH', `/events/${a.eventId}/teams/${ta.id}`, {}))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await request('POST', `/events/${randomUUID()}/teams`, {
          name: 'Missing event',
          description: '',
        })
      ).statusCode,
    ).toBe(404);
    await expect(
      pool.query('UPDATE voting_items SET team_id=$2 WHERE id=$1', [
        ia.id,
        tb.id,
      ]),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      pool.query('DELETE FROM teams WHERE id=$1', [ta.id]),
    ).rejects.toMatchObject({ code: '23503' });
    expect(
      (await request('GET', `/votings/${a.id}/items`)).json()[0].teamId,
    ).toBe(ta.id);
  });

  it('serializes duplicate entry creation and rejects duplicate reassignment', async () => {
    const record = await voting(await event()),
      a = await team(record.eventId),
      b = await team(record.eventId);
    const responses = await Promise.all(
      [1, 2].map(() =>
        request('POST', `/votings/${record.id}/items`, {
          teamId: a.id,
          displayOrder: 0,
        }),
      ),
    );
    expect(responses.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    await expect(
      pool.query(
        'INSERT INTO voting_items (event_id,voting_id,team_id,name) VALUES ($1,$2,$3,$4)',
        [record.eventId, record.id, a.id, a.name],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    const second = await item(record.id, b.id);
    expect(
      (
        await request('PATCH', `/votings/${record.id}/items/${second.id}`, {
          teamId: a.id,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await request('GET', `/votings/${record.id}/items`)).json(),
    ).toHaveLength(2);
  });

  it('blocks item additions/reassignment/order changes after activation or any ballot history', async () => {
    for (const status of ['active', 'closed', 'archived', 'draft']) {
      const record = await voting(await event()),
        t = await team(record.eventId),
        entry = await item(record.id, t.id);
      if (status === 'draft') {
        const g = (
          await pool.query(
            "INSERT INTO jury_groups (event_id,code,name) VALUES ($1,'T','T') RETURNING id",
            [record.eventId],
          )
        ).rows[0].id;
        const j = (
          await pool.query(
            "INSERT INTO event_jurors (event_id,jury_group_id,display_name) VALUES ($1,$2,'Juror') RETURNING id",
            [record.eventId, g],
          )
        ).rows[0].id;
        await pool.query(
          'INSERT INTO ballots (event_id,voting_id,juror_id) VALUES ($1,$2,$3)',
          [record.eventId, record.id, j],
        );
      } else
        await pool.query('UPDATE votings SET status=$2 WHERE id=$1', [
          record.id,
          status,
        ]);
      expect(
        (
          await request('PATCH', `/votings/${record.id}/items/${entry.id}`, {
            displayOrder: 9,
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await request('POST', `/votings/${record.id}/items`, {
            teamId: t.id,
            displayOrder: 9,
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (await request('GET', `/votings/${record.id}/items`)).json()[0]
          .displayOrder,
      ).toBe(0);
    }
  });
  it('closes active voting idempotently under the event lock, preserving configuration and ballot references', async () => {
    const record = await voting(await event()),
      t = await team(record.eventId),
      entry = await item(record.id, t.id);
    const g = (
      await pool.query(
        "INSERT INTO jury_groups (event_id,code,name) VALUES ($1,'T','T') RETURNING id",
        [record.eventId],
      )
    ).rows[0].id;
    expect(
      (
        await request('PUT', `/votings/${record.id}/allowed-groups`, {
          juryGroupIds: [g],
        })
      ).statusCode,
    ).toBe(200);
    await pool.query(
      'UPDATE votings SET selected_places=1,max_plus_votes=1,max_minus_votes=0,allow_negative_votes=false WHERE id=$1',
      [record.id],
    );
    const j = (
      await pool.query(
        "INSERT INTO event_jurors (event_id,jury_group_id,display_name) VALUES ($1,$2,'Juror') RETURNING id",
        [record.eventId, g],
      )
    ).rows[0].id;
    const ballot = (
      await pool.query(
        "INSERT INTO ballots (event_id,voting_id,juror_id,status,submitted_at) VALUES ($1,$2,$3,'submitted',now()) RETURNING id",
        [record.eventId, record.id, j],
      )
    ).rows[0].id;
    await pool.query(
      'INSERT INTO ballot_entries (event_id,voting_id,ballot_id,voting_item_id,vote_value) VALUES ($1,$2,$3,$4,1)',
      [record.eventId, record.id, ballot, entry.id],
    );
    await pool.query("UPDATE votings SET status='active' WHERE id=$1", [
      record.id,
    ]);
    const lock = (
      await pool.query('SELECT roster_locked_at FROM events WHERE id=$1', [
        record.eventId,
      ])
    ).rows[0].roster_locked_at;
    const before = (
      await pool.query('SELECT * FROM ballots WHERE id=$1', [ballot])
    ).rows[0];
    const closed = await request('POST', `/votings/${record.id}/close`, {});
    expect(closed.statusCode).toBe(200);
    expect(closed.json().status).toBe('closed');
    expect(
      (await request('POST', `/votings/${record.id}/close`, {})).json(),
    ).toEqual(closed.json());
    expect(
      (await pool.query('SELECT * FROM ballots WHERE id=$1', [ballot])).rows[0],
    ).toEqual(before);
    expect(
      (
        await pool.query(
          'SELECT voting_item_id,vote_value FROM ballot_entries WHERE ballot_id=$1',
          [ballot],
        )
      ).rows,
    ).toEqual([{ voting_item_id: entry.id, vote_value: 1 }]);
    expect(
      (
        await pool.query('SELECT roster_locked_at FROM events WHERE id=$1', [
          record.eventId,
        ])
      ).rows[0].roster_locked_at,
    ).toEqual(lock);
    expect(
      (
        await request('POST', `/votings/${record.id}/close`, {
          status: 'active',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await request('POST', `/votings/${randomUUID()}/close`, {})).statusCode,
    ).toBe(404);
    await pool.query("UPDATE votings SET status='archived' WHERE id=$1", [
      record.id,
    ]);
    expect(
      (await request('POST', `/votings/${record.id}/close`, {})).statusCode,
    ).toBe(409);
    const frozenConfiguration = (
      await pool.query(
        'SELECT selected_places,max_plus_votes,max_minus_votes,allow_negative_votes,deadline FROM votings WHERE id=$1',
        [record.id],
      )
    ).rows[0];
    const reopened = await request('POST', `/votings/${record.id}/reopen`, {});
    expect(reopened.statusCode).toBe(200);
    expect(reopened.json().status).toBe('active');
    expect(
      (await request('GET', `/votings/${record.id}/items`)).json(),
    ).toEqual([entry]);
    expect(
      (await request('GET', `/votings/${record.id}/allowed-groups`))
        .json()
        .map((group: { id: string }) => group.id),
    ).toEqual([g]);
    expect(
      (await request('POST', `/votings/${record.id}/reopen`)).json(),
    ).toEqual(reopened.json());
    expect(
      (await pool.query('SELECT * FROM ballots WHERE id=$1', [ballot])).rows[0],
    ).toEqual(before);
    expect(
      (
        await pool.query(
          'SELECT voting_item_id,vote_value FROM ballot_entries WHERE ballot_id=$1',
          [ballot],
        )
      ).rows,
    ).toEqual([{ voting_item_id: entry.id, vote_value: 1 }]);
    expect(
      (
        await pool.query(
          'SELECT selected_places,max_plus_votes,max_minus_votes,allow_negative_votes,deadline FROM votings WHERE id=$1',
          [record.id],
        )
      ).rows[0],
    ).toEqual(frozenConfiguration);
    expect(
      (
        await pool.query('SELECT roster_locked_at FROM events WHERE id=$1', [
          record.eventId,
        ])
      ).rows[0].roster_locked_at,
    ).toEqual(lock);
    expect(
      (await request('PATCH', `/votings/${record.id}`, { name: 'Changed' }))
        .statusCode,
    ).toBe(409);
  });

  it('reopens closed and archived voting with incomplete setup but never activates a draft', async () => {
    for (const status of ['closed', 'archived']) {
      const record = await voting(await event());
      await pool.query('UPDATE votings SET status=$2 WHERE id=$1', [
        record.id,
        status,
      ]);
      const reopened = await request(
        'POST',
        `/votings/${record.id}/reopen`,
        {},
      );
      expect(reopened.statusCode).toBe(200);
      expect(reopened.json().status).toBe('active');
      expect(
        (await request('GET', `/votings/${record.id}/items`)).json(),
      ).toEqual([]);
      expect(
        (await request('GET', `/votings/${record.id}/allowed-groups`)).json(),
      ).toEqual([]);
    }
    const draft = await voting(await event());
    expect(
      (await request('POST', `/votings/${draft.id}/reopen`, {})).statusCode,
    ).toBe(409);
    expect((await request('GET', `/votings/${draft.id}`)).json()).toEqual(
      draft,
    );
    expect(
      (
        await pool.query('SELECT roster_locked_at FROM events WHERE id=$1', [
          draft.eventId,
        ])
      ).rows[0].roster_locked_at,
    ).toBeNull();
    expect(
      (await request('POST', `/votings/${draft.id}/reopen`, { reset: true }))
        .statusCode,
    ).toBe(400);
    expect(
      (await request('POST', `/votings/${randomUUID()}/reopen`, {})).statusCode,
    ).toBe(404);
    expect(
      (await request('POST', '/votings/invalid/reopen', {})).statusCode,
    ).toBe(400);
  });

  it('waits for the event lock before reopening and serializes concurrent lifecycle actions', async () => {
    const record = await voting(await event());
    await pool.query("UPDATE votings SET status='closed' WHERE id=$1", [
      record.id,
    ]);
    const blocker = await pool.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [
        record.eventId,
      ]);
      const pending = request('POST', `/votings/${record.id}/reopen`, {});
      const waiting = Promise.resolve(pending);
      let eventLockWait = false;
      const until = Date.now() + 2000;
      while (Date.now() < until) {
        const result = await pool.query(
          "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT roster_locked_at FROM events%'",
        );
        if (result.rowCount) {
          eventLockWait = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(eventLockWait).toBe(true);
      await blocker.query('COMMIT');
      expect((await waiting).statusCode).toBe(200);
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
    const results = await Promise.all([
      request('POST', `/votings/${record.id}/close`, {}),
      request('POST', `/votings/${record.id}/reopen`, {}),
    ]);
    expect(results.map((result) => result.statusCode)).toEqual([200, 200]);
    expect(['active', 'closed']).toContain(
      (await request('GET', `/votings/${record.id}`)).json().status,
    );
  });
});
