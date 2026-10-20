import { createWizardService } from '../wizard/service';
import { createJurorAccessService } from '../auth/juror-access';
import { createLinkVault } from '../auth/link-vault';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { jurorTableSnapshotSchema } from '@d21/contracts';
import { readEnvironment } from '../../config';
import { dropTestDatabase } from '../../db/test-database';
import { buildApp } from '../../app';
import { createAuthService, setAdminPassword } from '../auth/service';
import { newSecret, secretHash } from '../auth/crypto';
import { createEventService } from '../events/service';
import { createVotingService } from '../votings/service';

const vault = createLinkVault(
  JSON.stringify({ test: randomBytes(32).toString('hex') }),
  'test',
);
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
  const response = await request('GET', `/events/${eventId}/jurors/table`);
  expect(response.statusCode).toBe(200);
  return jurorTableSnapshotSchema.parse(response.json());
}
const row = (name = 'Same team') => ({
  id: randomUUID(),
  displayName: name,
  groupCode: 'T',
});
async function save(
  eventId: string,
  baseVersion: string,
  rows: object[],
  session = cookie,
) {
  return request(
    'PUT',
    `/events/${eventId}/jurors/table`,
    { baseVersion, rows },
    session,
  );
}
async function rowsIn(eventId: string) {
  return (
    await pool.query(
      'SELECT * FROM event_jurors WHERE event_id=$1 ORDER BY id',
      [eventId],
    )
  ).rows;
}

describe('atomic juror table against local PostgreSQL', () => {
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
        events: createEventService(pool, auth, vault),
        jurorAccess: createJurorAccessService(pool, auth, vault),
        wizard: createWizardService(pool, auth),
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

  it('reads without writes; creates missing groups and duplicate-name memberships once, with encrypted links and no sessions', async () => {
    const id = await event(),
      before = await table(id),
      a = row(' Same name '),
      b = row('Same name');
    expect(before.groups).toEqual([]);
    const responses = await Promise.all([
      save(id, before.version, [a, b]),
      save(id, before.version, [a, b]),
    ]);
    expect(responses.map((r) => r.statusCode)).toEqual([200, 200]);
    const after = await table(id),
      stored = await rowsIn(id);
    expect(after.groups.map((g) => [g.code, g.name])).toEqual([
      ['T', 'Technická porota'],
      ['V', 'Druhá část poroty'],
    ]);
    expect(after.jurors).toHaveLength(2);
    expect(
      after.jurors.every(
        (j) => j.displayName === 'Same name' && j.access === 'stored',
      ),
    ).toBe(true);
    expect((await save(id, before.version, [b, a])).json().status).toBe(
      'saved',
    );
    expect(await rowsIn(id)).toEqual(stored);
    expect(
      (await pool.query('SELECT * FROM juror_access WHERE event_id=$1', [id]))
        .rowCount,
    ).toBe(2);
    expect(
      (await pool.query('SELECT * FROM sessions WHERE event_id=$1', [id]))
        .rowCount,
    ).toBe(0);
  });
  it('copies automatically stored links without exposing secrets in roster or audit, and retains sessions on replay', async () => {
    const id = await event(),
      a = row(),
      before = await table(id);
    const saved = await save(id, before.version, [a]);
    const copy = () =>
      request('POST', `/events/${id}/jurors/${a.id}/access/copy`, {});
    const first = await copy();
    expect(first.statusCode).toBe(200);
    const link = first.json().url;
    const secret = new URLSearchParams(new URL(link).hash.slice(1)).get('key')!;
    const token = newSecret();
    await pool.query(
      'INSERT INTO sessions(token_hash,event_id,juror_id,expires_at) VALUES ($1,$2,$3,NULL)',
      [secretHash(token), id, a.id],
    );
    const persisted = async () =>
      (
        await pool.query(
          `SELECT
      (SELECT json_agg(t) FROM juror_access t WHERE event_id=$1) AS links,
      (SELECT json_agg(t) FROM sessions t WHERE event_id=$1) AS sessions,
      (SELECT json_agg(t) FROM audit_logs t WHERE event_id=$1) AS audit`,
          [id],
        )
      ).rows;
    const original = await persisted();
    expect(JSON.stringify(original).includes(secret)).toBe(false);
    expect(saved.body.includes(secret)).toBe(false);
    expect(saved.body.includes('encrypted_token')).toBe(false);
    expect(original[0].links[0].token_hash).toBe(secretHash(secret));
    expect(original[0].links[0].encrypted_token.startsWith('v1.')).toBe(true);
    expect((await save(id, before.version, [a])).statusCode).toBe(200);
    expect((await copy()).json().url === link).toBe(true);
    expect(await persisted()).toEqual(original);
    expect(first.headers['cache-control']).toContain('no-store');
  });
  it('issues only never-issued memberships on explicit save, retaining legacy links and revoked history', async () => {
    const id = await event();
    await save(id, (await table(id)).version, []);
    const group = (await table(id)).groups[0]!;
    const members = [row('Never issued'), row('Legacy'), row('Revoked')];
    for (const member of members)
      await pool.query(
        'INSERT INTO event_jurors(id,event_id,jury_group_id,display_name) VALUES ($1,$2,$3,$4)',
        [member.id, id, group.id, member.displayName],
      );
    const legacy = newSecret(),
      revoked = newSecret();
    await pool.query(
      'INSERT INTO juror_access(token_hash,event_id,juror_id,revoked_at) VALUES ($1,$2,$3,NULL),($4,$2,$5,now())',
      [
        secretHash(legacy),
        id,
        members[1]!.id,
        secretHash(revoked),
        members[2]!.id,
      ],
    );
    const credentials = (
      await pool.query(
        'SELECT * FROM juror_access WHERE event_id=$1 ORDER BY token_hash',
        [id],
      )
    ).rows;
    const before = await table(id);
    expect(before.jurors.map((j) => j.access).sort()).toEqual([
      'legacy',
      'none',
      'revoked',
    ]);
    expect(
      (
        await pool.query(
          'SELECT * FROM juror_access WHERE event_id=$1 ORDER BY token_hash',
          [id],
        )
      ).rows,
    ).toEqual(credentials);
    expect((await save(id, before.version, members)).statusCode).toBe(200);
    const after = await table(id);
    expect(after.jurors.map((j) => j.access).sort()).toEqual([
      'legacy',
      'revoked',
      'stored',
    ]);
    expect(after.version).toBe(before.version);
    expect(
      (
        await pool.query(
          'SELECT * FROM juror_access WHERE event_id=$1 AND juror_id<>$2 ORDER BY token_hash',
          [id, members[0]!.id],
        )
      ).rows,
    ).toEqual(credentials);
    const access = createJurorAccessService(
      pool,
      createAuthService(pool),
      vault,
    );
    expect((await access.start(id, legacy)).session.principal.kind).toBe(
      'juror',
    );
    await expect(access.start(id, revoked)).rejects.toMatchObject({
      code: 'INVALID_JUROR_LINK',
    });
    await expect(
      access.copy(cookie.split('=')[1], id, members[1]!.id),
    ).rejects.toMatchObject({ code: 'LEGACY_LINK' });
  });
  it('rolls back new groups, memberships, name edits and individual creation when keys are missing', async () => {
    const auth = createAuthService(pool),
      service = createEventService(pool, auth)(cookie.split('=')[1]).jury;
    const id = await event(),
      before = await table(id);
    await expect(
      service.saveTable(id, { baseVersion: before.version, rows: [row()] }),
    ).rejects.toMatchObject({ code: 'LINK_STORAGE_UNAVAILABLE' });
    expect(await table(id)).toEqual(before);
    await save(id, before.version, []);
    const group = (await table(id)).groups[0]!;
    await expect(
      service.createJuror(id, { displayName: 'Failed', juryGroupId: group.id }),
    ).rejects.toMatchObject({ code: 'LINK_STORAGE_UNAVAILABLE' });
    expect(await rowsIn(id)).toHaveLength(0);
    const a = row('Original');
    await pool.query(
      'INSERT INTO event_jurors(id,event_id,jury_group_id,display_name) VALUES ($1,$2,$3,$4)',
      [a.id, id, group.id, a.displayName],
    );
    const current = await table(id);
    await expect(
      service.saveTable(id, {
        baseVersion: current.version,
        rows: [{ ...a, displayName: 'Must roll back' }],
      }),
    ).rejects.toMatchObject({ code: 'LINK_STORAGE_UNAVAILABLE' });
    expect(await table(id)).toEqual(current);
    expect(
      (await pool.query('SELECT * FROM juror_access WHERE event_id=$1', [id]))
        .rowCount,
    ).toBe(0);
    expect(
      (await pool.query('SELECT * FROM audit_logs WHERE event_id=$1', [id]))
        .rowCount,
    ).toBe(0);
  });
  it('rolls back earlier credentials and audit records if later encryption fails', async () => {
    const id = await event(),
      before = await table(id);
    let encryptions = 0;
    const failing = {
      ...vault,
      encrypt: (...args: Parameters<typeof vault.encrypt>) => {
        if (++encryptions === 2) return createLinkVault().encrypt(...args);
        return vault.encrypt(...args);
      },
    };
    const service = createEventService(
      pool,
      createAuthService(pool),
      failing,
    )(cookie.split('=')[1]).jury;
    await expect(
      service.saveTable(id, {
        baseVersion: before.version,
        rows: [row(), row()],
      }),
    ).rejects.toMatchObject({ code: 'LINK_STORAGE_UNAVAILABLE' });
    expect(await table(id)).toEqual(before);
    expect(
      (await pool.query('SELECT * FROM juror_access WHERE event_id=$1', [id]))
        .rowCount,
    ).toBe(0);
    expect(
      (await pool.query('SELECT * FROM audit_logs WHERE event_id=$1', [id]))
        .rowCount,
    ).toBe(0);
  });
  it('does not revive a credential revoked while the save waits for the event lock', async () => {
    const id = await event();
    await save(id, (await table(id)).version, []);
    const group = (await table(id)).groups[0]!,
      a = row();
    await pool.query(
      'INSERT INTO event_jurors(id,event_id,jury_group_id,display_name) VALUES ($1,$2,$3,$4)',
      [a.id, id, group.id, a.displayName],
    );
    const before = await table(id),
      lock = await pool.connect();
    try {
      await lock.query('BEGIN');
      await lock.query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [id]);
      const pending = Promise.resolve(save(id, before.version, [a]));
      const until = Date.now() + 3000;
      while (
        !(
          await pool.query(
            "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND pid<>pg_backend_pid()",
          )
        ).rowCount
      ) {
        if (Date.now() > until)
          throw new Error('Expected actual event lock wait.');
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await lock.query(
        'INSERT INTO juror_access(token_hash,event_id,juror_id,revoked_at) VALUES ($1,$2,$3,now())',
        [secretHash(newSecret()), id, a.id],
      );
      await lock.query('COMMIT');
      expect((await pending).statusCode).toBe(200);
      expect((await table(id)).jurors[0]!.access).toBe('revoked');
      expect(
        (await pool.query('SELECT * FROM juror_access WHERE event_id=$1', [id]))
          .rowCount,
      ).toBe(1);
      expect(
        (await pool.query('SELECT * FROM audit_logs WHERE event_id=$1', [id]))
          .rowCount,
      ).toBe(0);
    } finally {
      await lock.query('ROLLBACK');
      lock.release();
    }
  });
  it('rolls back credential and roster writes when the issuance audit cannot be stored', async () => {
    const id = await event(),
      before = await table(id);
    await pool.query(
      "CREATE FUNCTION fail_link_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='juror_access.issued' THEN RAISE EXCEPTION 'injected'; END IF; RETURN NEW; END $$",
    );
    await pool.query(
      'CREATE TRIGGER fail_link_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_link_audit()',
    );
    try {
      expect((await save(id, before.version, [row()])).statusCode).toBe(500);
      expect(await table(id)).toEqual(before);
      expect(
        (await pool.query('SELECT * FROM juror_access WHERE event_id=$1', [id]))
          .rowCount,
      ).toBe(0);
      expect(
        (await pool.query('SELECT * FROM audit_logs WHERE event_id=$1', [id]))
          .rowCount,
      ).toBe(0);
    } finally {
      await pool.query('DROP TRIGGER fail_link_audit ON audit_logs');
      await pool.query('DROP FUNCTION fail_link_audit()');
    }
  });
  it('individual stable-ID retries retain one encrypted link, reject mismatches and preserve revoked access after freezing', async () => {
    const id = await event();
    await save(id, (await table(id)).version, []);
    const group = (await table(id)).groups[0]!,
      input = {
        id: randomUUID(),
        displayName: 'Individual',
        juryGroupId: group.id,
      };
    const [first, concurrent] = await Promise.all([
      request('POST', `/events/${id}/jurors`, input),
      request('POST', `/events/${id}/jurors`, input),
    ]);
    expect(concurrent.json()).toEqual(first.json());
    expect(first.statusCode).toBe(201);
    const original = (
      await pool.query('SELECT * FROM juror_access WHERE event_id=$1', [id])
    ).rows;
    const repeat = await request('POST', `/events/${id}/jurors`, input);
    expect(repeat.json()).toEqual(first.json());
    expect(
      (await pool.query('SELECT * FROM juror_access WHERE event_id=$1', [id]))
        .rows,
    ).toEqual(original);
    expect(
      (
        await request('POST', `/events/${id}/jurors`, {
          ...input,
          displayName: 'Different',
        })
      ).statusCode,
    ).toBe(409);
    const other = await event();
    expect(
      (await request('POST', `/events/${other}/jurors`, input)).statusCode,
    ).toBe(409);
    await pool.query(
      'UPDATE juror_access SET revoked_at=now() WHERE event_id=$1',
      [id],
    );
    await pool.query(
      "INSERT INTO votings(event_id,name,kind,status) VALUES ($1,'Freeze','final','active')",
      [id],
    );
    expect(
      (await request('POST', `/events/${id}/jurors`, input)).json(),
    ).toEqual(first.json());
    expect((await table(id)).jurors[0]!.access).toBe('revoked');
    expect(
      (await pool.query('SELECT * FROM juror_access WHERE event_id=$1', [id]))
        .rowCount,
    ).toBe(1);
  });
  it.each(['table', 'individual'] as const)(
    'rolls back %s membership, credential and audit on authorization loss after credential insertion',
    async (mode) => {
      const id = await event();
      await save(id, (await table(id)).version, []);
      const before = await table(id);
      await pool.query(
        'CREATE FUNCTION revoke_after_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE sessions SET revoked_at=statement_timestamp() WHERE admin_user_id IS NOT NULL; RETURN NEW; END $$',
      );
      await pool.query(
        'CREATE TRIGGER revoke_after_link AFTER INSERT ON juror_access FOR EACH ROW EXECUTE FUNCTION revoke_after_link()',
      );
      try {
        const result =
          mode === 'table'
            ? await save(id, before.version, [row()])
            : await request('POST', `/events/${id}/jurors`, {
                displayName: 'Individual',
                juryGroupId: before.groups[0]!.id,
              });
        expect(result.statusCode).toBe(401);
        expect(await table(id)).toEqual(before);
        expect(
          (
            await pool.query('SELECT * FROM juror_access WHERE event_id=$1', [
              id,
            ])
          ).rowCount,
        ).toBe(0);
        expect(
          (await pool.query('SELECT * FROM audit_logs WHERE event_id=$1', [id]))
            .rowCount,
        ).toBe(0);
      } finally {
        await pool.query('DROP TRIGGER revoke_after_link ON juror_access');
        await pool.query('DROP FUNCTION revoke_after_link()');
      }
    },
  );
  it('can explicitly save only missing groups, preserving existing names and IDs', async () => {
    const id = await event();
    const group = (
      await request('POST', `/events/${id}/jury-groups`, {
        code: 'V',
        name: 'Custom V',
      })
    ).json();
    const before = await table(id);
    expect((await save(id, before.version, [])).json().status).toBe('saved');
    expect((await table(id)).groups.find((g) => g.code === 'V')).toEqual(group);
    const current = await table(id);
    expect((await save(id, before.version, [])).json().snapshot).toEqual(
      current,
    );
  });
  it('collects invalid name and assignment fields and rolls back missing-group creation', async () => {
    const id = await event(),
      before = await table(id),
      invalid = { ...row(' '), groupCode: 'X' };
    const result = await save(id, before.version, [row(), invalid]);
    expect(result.json()).toEqual({
      status: 'invalid',
      issues: [
        { rowId: invalid.id, field: 'displayName' },
        { rowId: invalid.id, field: 'groupCode' },
      ],
    });
    expect(await table(id)).toEqual(before);
  });
  it('rejects stale juror/group edits, omission and foreign membership IDs atomically', async () => {
    const id = await event(),
      other = await event(),
      a = row(),
      b = row();
    await save(id, (await table(id)).version, [a]);
    await save(other, (await table(other)).version, [b]);
    const before = await table(id),
      remote = await table(other);
    expect((await save(id, before.version, [a, b])).statusCode).toBe(409);
    expect((await save(id, before.version, [])).statusCode).toBe(409);
    expect(await table(id)).toEqual(before);
    await request(
      'PATCH',
      `/events/${id}/jury-groups/${before.groups[0]!.id}`,
      { name: 'Renamed T' },
    );
    expect(
      (await save(id, before.version, [{ ...a, displayName: 'Stale' }]))
        .statusCode,
    ).toBe(409);
    const current = await table(id);
    await request('PATCH', `/events/${id}/jurors/${a.id}`, {
      displayName: 'Other writer',
    });
    expect((await save(id, current.version, [a])).statusCode).toBe(409);
    expect(await table(other)).toEqual(remote);
  });
  it('serializes competing assignments and supports no-write exact retries after a freeze', async () => {
    const id = await event(),
      a = row();
    await save(id, (await table(id)).version, [a]);
    const before = await table(id);
    const results = await Promise.all([
      save(id, before.version, [{ ...a, displayName: 'A' }]),
      save(id, before.version, [{ ...a, displayName: 'B', groupCode: 'V' }]),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const current = await table(id),
      desired = current.jurors.map((j) => ({
        id: j.id,
        displayName: j.displayName,
        groupCode: current.groups.find((g) => g.id === j.juryGroupId)!.code,
      }));
    await pool.query(
      "INSERT INTO votings(event_id,name,kind,status) VALUES ($1,'Started','final','active')",
      [id],
    );
    const frozen = await rowsIn(id);
    expect((await save(id, current.version, desired)).json().status).toBe(
      'saved',
    );
    expect(await rowsIn(id)).toEqual(frozen);
    const locked = await table(id);
    expect(
      (await save(id, locked.version, [...desired, row()])).json().error.code,
    ).toBe('ROSTER_LOCKED');
    expect(
      (
        await save(id, locked.version, [
          {
            ...desired[0],
            groupCode: desired[0]!.groupCode === 'T' ? 'V' : 'T',
          },
        ])
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await save(id, locked.version, [
          { ...desired[0], displayName: 'Allowed correction' },
        ])
      ).json().status,
    ).toBe('saved');
    expect((await table(id)).locked).toBe(true);
  });
  it('does not fill missing groups on frozen historical rosters, but permits name corrections', async () => {
    const id = await event();
    const group = (
      await request('POST', `/events/${id}/jury-groups`, {
        code: 'T',
        name: 'Historical T',
      })
    ).json();
    const a = (
      await request('POST', `/events/${id}/jurors`, {
        displayName: 'Historical',
        juryGroupId: group.id,
      })
    ).json();
    await pool.query(
      "INSERT INTO votings(event_id,name,kind,status) VALUES ($1,'Started','final','active')",
      [id],
    );
    const before = await table(id);
    expect(
      (
        await save(id, before.version, [
          { id: a.id, displayName: 'Correction', groupCode: 'T' },
        ])
      ).json().status,
    ).toBe('saved');
    expect((await table(id)).groups).toEqual(before.groups);
  });
  it('rolls back groups and every row on a mid-table storage failure', async () => {
    const id = await event(),
      before = await table(id);
    await pool.query(
      "CREATE FUNCTION fail_juror_table() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.display_name='FAIL' THEN RAISE EXCEPTION 'injected'; END IF; RETURN NEW; END $$",
    );
    await pool.query(
      'CREATE TRIGGER fail_juror_table BEFORE INSERT OR UPDATE ON event_jurors FOR EACH ROW EXECUTE FUNCTION fail_juror_table()',
    );
    try {
      expect(
        (await save(id, before.version, [row(), row('FAIL')])).statusCode,
      ).toBe(500);
      expect(await table(id)).toEqual(before);
    } finally {
      await pool.query('DROP TRIGGER fail_juror_table ON event_jurors');
      await pool.query('DROP FUNCTION fail_juror_table()');
    }
  });
  it('preserves links, sessions, ballots, entries and history across frozen name corrections', async () => {
    const id = await event(),
      a = row();
    await save(id, (await table(id)).version, [a]);
    const token = newSecret();
    await pool.query(
      'INSERT INTO juror_access(token_hash,event_id,juror_id) VALUES ($1,$2,$3)',
      [secretHash(token), id, a.id],
    );
    await pool.query(
      'INSERT INTO sessions(token_hash,event_id,juror_id,expires_at) VALUES ($1,$2,$3,NULL)',
      [secretHash(newSecret()), id, a.id],
    );
    const voting = (
      await pool.query(
        "INSERT INTO votings(event_id,name,kind) VALUES ($1,'Draft','final') RETURNING id",
        [id],
      )
    ).rows[0].id;
    const item = (
      await pool.query(
        "INSERT INTO voting_items(event_id,voting_id,name) VALUES ($1,$2,'Team') RETURNING id",
        [id, voting],
      )
    ).rows[0].id;
    const ballot = (
      await pool.query(
        "INSERT INTO ballots(event_id,voting_id,juror_id,status,submitted_at) VALUES ($1,$2,$3,'submitted',now()) RETURNING id",
        [id, voting, a.id],
      )
    ).rows[0].id;
    await pool.query(
      'INSERT INTO ballot_entries(ballot_id,voting_item_id,voting_id,event_id,vote_value) VALUES ($1,$2,$3,$4,1)',
      [ballot, item, voting, id],
    );
    await pool.query(
      "INSERT INTO audit_logs(event_id,action,target_type,target_id,context) VALUES ($1,'test','ballot',$2,'{}')",
      [id, ballot],
    );
    const sql = `SELECT (SELECT json_agg(t) FROM juror_access t WHERE event_id=$1) AS links,(SELECT json_agg(t) FROM sessions t WHERE event_id=$1) AS sessions,(SELECT json_agg(t) FROM ballots t WHERE event_id=$1) AS ballots,(SELECT json_agg(t) FROM ballot_entries t WHERE event_id=$1) AS entries,(SELECT json_agg(t) FROM audit_logs t WHERE event_id=$1) AS history`;
    const before = (await pool.query(sql, [id])).rows;
    expect(
      (
        await save(id, (await table(id)).version, [
          { ...a, displayName: 'Corrected' },
        ])
      ).json().status,
    ).toBe('saved');
    expect((await pool.query(sql, [id])).rows).toEqual(before);
  });
  it('guards both methods, strict fields and queries without accepting identity claims', async () => {
    const id = await event(),
      path = `/events/${id}/jurors/table`,
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
    const snapshot = await table(id);
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
      "UPDATE event_jurors SET updated_at='2026-10-18T10:00:00.123001Z' WHERE id=$1",
      [a.id],
    );
    const before = await table(id);
    await pool.query(
      "UPDATE event_jurors SET updated_at='2026-10-18T10:00:00.123002Z' WHERE id=$1",
      [a.id],
    );
    const current = await table(id);
    expect(current.jurors[0]!.updatedAt).toBe(before.jurors[0]!.updatedAt);
    expect(current.version).not.toBe(before.version);
    expect(
      (await save(id, before.version, [{ ...a, displayName: 'Stale' }]))
        .statusCode,
    ).toBe(409);
    expect(
      (
        await save(id, current.version, [
          { ...a, displayName: 'x'.repeat(70_000) },
        ])
      ).statusCode,
    ).toBe(413);
    expect(await table(id)).toEqual(current);
  });
  it('rolls back table writes when authorization is lost before transaction completion', async () => {
    const id = await event(),
      before = await table(id);
    await pool.query(
      'CREATE FUNCTION revoke_on_juror_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE sessions SET revoked_at=statement_timestamp() WHERE admin_user_id IS NOT NULL; RETURN NEW; END $$',
    );
    await pool.query(
      'CREATE TRIGGER revoke_on_juror_write AFTER INSERT ON event_jurors FOR EACH ROW EXECUTE FUNCTION revoke_on_juror_write()',
    );
    try {
      expect((await save(id, before.version, [row()])).statusCode).toBe(401);
      expect(await table(id)).toEqual(before);
    } finally {
      await pool.query('DROP TRIGGER revoke_on_juror_write ON event_jurors');
      await pool.query('DROP FUNCTION revoke_on_juror_write()');
    }
  });
  it.each(['revoke', 'expire', 'change', 'freeze'] as const)(
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
            "INSERT INTO jury_groups(event_id,code,name) VALUES ($1,'V','Other writer')",
            [id],
          );
        else if (mode === 'freeze')
          await lock.query(
            "INSERT INTO votings(event_id,name,kind,status) VALUES ($1,'Started during wait','final','active')",
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
        expect((await pending).statusCode).toBe(
          mode === 'change' || mode === 'freeze' ? 409 : 401,
        );
        expect((await rowsIn(id)).some((juror) => juror.id === a.id)).toBe(
          false,
        );
      } finally {
        await lock.query('ROLLBACK');
        lock.release();
      }
    },
  );
});
