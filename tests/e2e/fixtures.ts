import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';
import { test as base, expect } from '@playwright/test';
import pg from 'pg';
import { readEnvironment } from '../../apps/api/src/config';
import { setAdminPassword } from '../../apps/api/src/modules/auth/service';
import { dropTestDatabase } from '../../apps/api/src/db/test-database';

type Runtime = {
  origin: string;
  password: string;
  pool: pg.Pool;
  restart: () => Promise<void>;
};

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port.');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function stop(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 10_000);
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}

export const test = base.extend<object, { runtime: Runtime }>({
  runtime: [
    async ({ browserName }, use) => {
      expect(browserName).toBe('chromium');
      const name = `d21_test_${randomUUID().replaceAll('-', '')}`;
      const baseUrl =
        process.env.TEST_DATABASE_URL ?? readEnvironment().DATABASE_URL;
      const admin = new pg.Pool({
        connectionString: baseUrl,
        connectionTimeoutMillis: 3000,
      });
      const url = new URL(baseUrl);
      url.pathname = `/${name}`;
      const pool = new pg.Pool({
        connectionString: url.toString(),
        connectionTimeoutMillis: 3000,
      });
      let created = false;
      let server: ChildProcess | undefined;
      try {
        await admin.query(`CREATE DATABASE "${name}"`);
        created = true;
        const port = await freePort();
        const origin = `http://127.0.0.1:${port}`;
        const env = {
          ...process.env,
          DATABASE_URL: url.toString(),
          MIGRATION_DATABASE_URL: url.toString(),
          APP_ORIGIN: origin,
          SERVE_WEB: 'true',
          API_HOST: '127.0.0.1',
          API_PORT: String(port),
          TRUSTED_PROXY_CIDRS: '',
          JUROR_LINK_KEYS: JSON.stringify({
            test: randomBytes(32).toString('hex'),
          }),
          JUROR_LINK_ACTIVE_KEY_ID: 'test',
        };
        // Exercise the exact compiled migration entry point twice, on this DB only.
        for (let i = 0; i < 2; i++) {
          const migration = spawn(
            process.execPath,
            ['apps/api/dist/migrate.js'],
            {
              env: {
                ...env,
                // Prove migrations use their dedicated target, never the runtime URL.
                DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused',
              },
              stdio: 'ignore',
            },
          );
          const [code] = await once(migration, 'exit');
          expect(code, 'compiled migration exits successfully').toBe(0);
        }
        expect(
          (
            await pool.query(
              'SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations',
            )
          ).rows[0].count,
        ).toBe(6);
        const password = `Disposable E2E ${randomBytes(16).toString('hex')}`;
        await setAdminPassword(pool, password);
        async function start() {
          server = spawn(process.execPath, ['apps/api/dist/server.js'], {
            env,
            stdio: 'ignore',
          });
          const until = Date.now() + 15_000;
          while (true) {
            if (server.exitCode !== null)
              throw new Error('Built API exited before startup.');
            if (
              await fetch(`${origin}/api/ready`)
                .then((r) => r.ok)
                .catch(() => false)
            )
              break;
            if (Date.now() > until)
              throw new Error('Built API startup timed out.');
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
        await start();
        await use({
          origin,
          password,
          pool,
          restart: async () => {
            await stop(server);
            await start();
          },
        });
      } finally {
        await stop(server);
        await pool.end();
        try {
          if (created) await dropTestDatabase(admin, name);
        } finally {
          await admin.end();
        }
      }
    },
    { scope: 'worker', timeout: 60_000 },
  ],
  baseURL: async ({ runtime }, use) => {
    await use(runtime.origin);
  },
});

export { expect };
