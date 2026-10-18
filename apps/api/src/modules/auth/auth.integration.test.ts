import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { sessionResponseSchema } from '@d21/contracts';
import { readEnvironment } from '../../config';
import { dropTestDatabase } from '../../db/test-database';
import { buildApp } from '../../app';
import {
  createAuthService,
  resolveJurorAccess,
  revokeAdminSessions,
  setAdminPassword,
} from './service';
import { newSecret, secretHash } from './crypto';

const databaseName = `d21_auth_test_${randomUUID().replaceAll('-', '')}`;
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
  max: 4,
  connectionTimeoutMillis: 3000,
});
const password = 'test-only shared password 2026';
const headers = { 'x-d21-request': '1', origin: 'http://127.0.0.1:5173' };
let created = false;
let app: ReturnType<typeof buildApp>;
function makeApp(origin = headers.origin) {
  return buildApp({
    checkDatabase: async () => {},
    auth: { service: createAuthService(pool), origin },
  });
}
async function login(cookie?: string, value = password) {
  return app.inject({
    method: 'POST',
    url: '/auth/admin/login',
    headers: { ...headers, ...(cookie ? { cookie } : {}) },
    payload: { password: value },
  });
}
function responseCookie(response: Awaited<ReturnType<typeof login>>) {
  return String(response.headers['set-cookie']).split(';')[0]!;
}

describe('authentication against PostgreSQL', () => {
  beforeAll(async () => {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    await migrate(drizzle(pool), {
      migrationsFolder: fileURLToPath(
        new URL('../../db/migrations', import.meta.url),
      ),
    });
    await setAdminPassword(pool, password);
  });
  beforeEach(() => {
    app = makeApp();
  });
  afterEach(async () => {
    await app.close();
  });
  afterAll(async () => {
    await pool.end();
    try {
      if (created) await dropTestDatabase(admin, databaseName);
    } finally {
      await admin.end();
    }
  });

  it('rejects anonymous access and accepts only the shared password, with no email', async () => {
    expect((await app.inject('/admin/access')).statusCode).toBe(401);
    expect((await app.inject('/auth/session')).json()).toEqual({
      authenticated: false,
    });
    const wrong = await login(undefined, 'wrong');
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json().error.code).toBe('INVALID_CREDENTIALS');
    expect(wrong.headers['set-cookie']).toBeUndefined();
    const extra = await app.inject({
      method: 'POST',
      url: '/auth/admin/login',
      headers,
      payload: { password, email: 'unused@example.test' },
    });
    expect(extra.statusCode).toBe(400);
    const correct = await login();
    expect(correct.statusCode).toBe(200);
    const session = sessionResponseSchema.parse(correct.json());
    expect(session.authenticated).toBe(true);
    const access = await app.inject({
      url: '/admin/access',
      headers: { cookie: responseCookie(correct) },
    });
    expect(access.statusCode).toBe(200);
    expect(access.json().permissions).toEqual(['administer']);
    expect(access.json().principal.displayName).toBe('Administrace');
  });

  it('stores only a token hash, uses HttpOnly/SameSite cookies and a 12-hour absolute expiry', async () => {
    const result = await login();
    const cookie = responseCookie(result);
    const token = cookie.split('=')[1]!;
    expect(result.headers['set-cookie']).toContain('HttpOnly');
    expect(result.headers['set-cookie']).toContain('SameSite=Strict');
    expect(result.headers['set-cookie']).toContain('Max-Age=43200');
    const record = await pool.query(
      'SELECT *, extract(epoch FROM (expires_at - created_at)) AS lifetime FROM sessions WHERE token_hash = $1',
      [secretHash(token)],
    );
    expect(Number(record.rows[0].lifetime)).toBe(43200);
    expect(JSON.stringify(record.rows[0])).not.toContain(token);
    expect(result.body).not.toContain(token);
    expect(result.body).not.toContain('password');
    expect(result.headers['cache-control']).toBe('no-store');
    const before = result.json().expiresAt;
    expect(
      (await app.inject({ url: '/auth/session', headers: { cookie } })).json()
        .expiresAt,
    ).toBe(before);
    await pool.query(
      "UPDATE sessions SET created_at = now() - interval '13 hours', expires_at = now() WHERE token_hash = $1",
      [secretHash(token)],
    );
    expect(
      (await app.inject({ url: '/auth/session', headers: { cookie } })).json(),
    ).toEqual({ authenticated: false });
    expect(
      (await app.inject({ url: '/admin/access', headers: { cookie } }))
        .statusCode,
    ).toBe(401);
  });

  it('logout revokes only the current session and is idempotent', async () => {
    const first = responseCookie(await login());
    const second = responseCookie(await login());
    const out = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { ...headers, cookie: first },
      payload: {},
    });
    expect(out.statusCode).toBe(204);
    expect(out.headers['set-cookie']).toContain('Max-Age=0');
    expect(
      (await app.inject({ url: '/admin/access', headers: { cookie: first } }))
        .statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ url: '/admin/access', headers: { cookie: second } }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/logout',
          headers: { ...headers, cookie: first },
          payload: {},
        })
      ).statusCode,
    ).toBe(204);
  });

  it('rotates a supplied session on successful login and never accepts fabricated tokens', async () => {
    const first = responseCookie(await login());
    const next = responseCookie(await login(first));
    expect(next).not.toBe(first);
    expect(
      (await app.inject({ url: '/admin/access', headers: { cookie: first } }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          url: '/admin/access',
          headers: { cookie: `d21-session=${newSecret()}` },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          url: '/auth/session',
          headers: { cookie: 'd21-session=malformed' },
        })
      ).json(),
    ).toEqual({ authenticated: false });
  });

  it('operator revocation invalidates all admin sessions', async () => {
    const cookies = [
      responseCookie(await login()),
      responseCookie(await login()),
    ];
    await revokeAdminSessions(pool);
    for (const cookie of cookies)
      expect(
        (await app.inject({ url: '/admin/access', headers: { cookie } }))
          .statusCode,
      ).toBe(401);
    expect((await login()).statusCode).toBe(200);
  });

  it('replacing the shared password revokes existing sessions and rejects the previous password', async () => {
    const cookie = responseCookie(await login());
    const replacement = 'replacement shared password 2026';
    try {
      await setAdminPassword(pool, replacement);
      expect((await login()).statusCode).toBe(401);
      expect((await login(undefined, replacement)).statusCode).toBe(200);
      expect(
        (await app.inject({ url: '/admin/access', headers: { cookie } }))
          .statusCode,
      ).toBe(401);
      const credential = await pool.query(
        'SELECT password_hash FROM admin_access',
      );
      expect(credential.rows[0].password_hash).toMatch(/^scrypt:131072:8:1:/);
      expect(credential.rows[0].password_hash).not.toContain(replacement);
    } finally {
      await setAdminPassword(pool, password);
    }
  });

  it('serializes password replacement with an in-flight login', async () => {
    const replacement = 'concurrent replacement password';
    try {
      const [result] = await Promise.all([
        login(),
        setAdminPassword(pool, replacement),
      ]);
      expect([200, 401]).toContain(result.statusCode);
      if (result.statusCode === 200) {
        expect(
          (
            await app.inject({
              url: '/admin/access',
              headers: { cookie: responseCookie(result) },
            })
          ).statusCode,
        ).toBe(401);
      }
      expect((await login()).statusCode).toBe(401);
      expect((await login(undefined, replacement)).statusCode).toBe(200);
    } finally {
      await setAdminPassword(pool, password);
    }
  });

  it('rejects cross-origin, missing custom headers, cross-site and invalid login input', async () => {
    for (const requestHeaders of [
      {},
      { ...headers, origin: 'https://attacker.test' },
      { ...headers, 'sec-fetch-site': 'cross-site' },
    ]) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/auth/admin/login',
            headers: requestHeaders,
            payload: { password },
          })
        ).statusCode,
      ).toBe(403);
    }
    for (const payload of [
      {},
      { password: '' },
      { password: 'x'.repeat(257) },
      { password: 1 },
    ]) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/auth/admin/login',
            headers,
            payload,
          })
        ).statusCode,
      ).toBe(400);
    }
    const cookie = responseCookie(await login());
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/logout',
          headers: { cookie },
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ url: '/admin/access', headers: { cookie } }))
        .statusCode,
    ).toBe(200);
  });

  it('limits repeated password attempts with a stable error response', async () => {
    for (let i = 0; i < 10; i++) await login(undefined, 'wrong');
    const limited = await login(undefined, 'wrong');
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe('RATE_LIMITED');
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('uses a host-only Secure cookie on HTTPS', async () => {
    const secureApp = makeApp('https://voting.example.test');
    try {
      const result = await secureApp.inject({
        method: 'POST',
        url: '/auth/admin/login',
        headers: { ...headers, origin: 'https://voting.example.test' },
        payload: { password },
      });
      expect(result.statusCode).toBe(200);
      expect(result.headers['set-cookie']).toContain('__Host-d21-session=');
      expect(result.headers['set-cookie']).toContain('Secure');
      expect(result.headers['set-cookie']).not.toContain('Domain=');
    } finally {
      await secureApp.close();
    }
  });

  it('binds duplicate-name jurors and their secret to one event, and rejects jurors at admin endpoints', async () => {
    const eventA = randomUUID(),
      eventB = randomUUID(),
      groupA = randomUUID(),
      groupB = randomUUID(),
      jurorA = randomUUID(),
      jurorB = randomUUID();
    await pool.query("INSERT INTO events (id,name) VALUES ($1,'A'), ($2,'B')", [
      eventA,
      eventB,
    ]);
    await pool.query(
      "INSERT INTO jury_groups (id,event_id,code,name) VALUES ($1,$2,'T','T'), ($3,$4,'V','V')",
      [groupA, eventA, groupB, eventB],
    );
    await pool.query(
      "INSERT INTO event_jurors (id,event_id,jury_group_id,display_name) VALUES ($1,$2,$3,'Same name'), ($4,$5,$6,'Same name')",
      [jurorA, eventA, groupA, jurorB, eventB, groupB],
    );
    const tokenA = newSecret(),
      tokenB = newSecret();
    await pool.query(
      'INSERT INTO juror_access (token_hash,event_id,juror_id) VALUES ($1,$2,$3), ($4,$5,$6)',
      [secretHash(tokenA), eventA, jurorA, secretHash(tokenB), eventB, jurorB],
    );
    expect(await resolveJurorAccess(pool, eventA, tokenA)).toMatchObject({
      id: jurorA,
      eventId: eventA,
    });
    expect(await resolveJurorAccess(pool, eventA, tokenB)).toBeNull();
    expect(await resolveJurorAccess(pool, eventB, tokenB)).toMatchObject({
      id: jurorB,
      eventId: eventB,
    });
    await pool.query(
      'UPDATE juror_access SET revoked_at = now() WHERE token_hash = $1',
      [secretHash(tokenA)],
    );
    expect(await resolveJurorAccess(pool, eventA, tokenA)).toBeNull();
    const token = newSecret();
    await pool.query(
      "INSERT INTO sessions (token_hash,event_id,juror_id,expires_at) VALUES ($1,$2,$3,now()+interval '12 hours')",
      [secretHash(token), eventB, jurorB],
    );
    const cookie = `d21-session=${token}`;
    expect(
      (await app.inject({ url: '/auth/session', headers: { cookie } })).json()
        .principal,
    ).toMatchObject({
      kind: 'juror',
      id: jurorB,
      eventId: eventB,
      juryGroupId: groupB,
    });
    expect(
      (await app.inject({ url: '/admin/access', headers: { cookie } }))
        .statusCode,
    ).toBe(403);
    await expect(
      pool.query(
        'INSERT INTO juror_access (token_hash,event_id,juror_id) VALUES ($1,$2,$3)',
        [secretHash(newSecret()), eventA, jurorB],
      ),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      pool.query(
        "INSERT INTO sessions (token_hash,event_id,juror_id,expires_at) VALUES ($1,$2,$3,now()+interval '12 hours')",
        [secretHash(newSecret()), eventA, jurorB],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('enforces exactly one session actor and refuses weak operator passwords', async () => {
    await expect(
      pool.query(
        "INSERT INTO sessions (token_hash,expires_at) VALUES ($1,now()+interval '12 hours')",
        [secretHash(newSecret())],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(setAdminPassword(pool, 'too short')).rejects.toThrow();
    expect((await login()).statusCode).toBe(200);
    await expect(
      pool.query("UPDATE admin_access SET key = 'second'"),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
