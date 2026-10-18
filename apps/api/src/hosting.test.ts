import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { readEnvironment } from './config';

describe('same-origin built hosting', () => {
  it('serves refreshable HTML routes and assets while keeping API errors as JSON', async () => {
    const root = await mkdtemp(join(tmpdir(), 'd21-host-'));
    await mkdir(join(root, 'assets'));
    await writeFile(
      join(root, 'index.html'),
      '<!doctype html><title>D21</title>',
    );
    await writeFile(join(root, 'assets', 'app.js'), '/* built asset */');
    const app = buildApp({ checkDatabase: async () => {}, webRoot: root });
    try {
      for (const path of ['/', '/admin/login', '/wizard/review']) {
        const response = await app.inject({
          url: path,
          headers: { accept: 'text/html' },
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.headers['referrer-policy']).toBe('no-referrer');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
      }
      expect((await app.inject('/assets/app.js')).body).toBe(
        '/* built asset */',
      );
      expect((await app.inject('/api/ready')).json().status).toBe('ready');
      for (const path of ['/api/absent', '/assets/absent.js']) {
        const response = await app.inject({
          url: path,
          headers: { accept: 'text/html' },
        });
        expect(response.statusCode).toBe(404);
        expect(response.headers['content-type']).toContain('application/json');
      }
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/wizard',
            headers: { accept: 'text/html' },
          })
        ).statusCode,
      ).toBe(404);
    } finally {
      await app.close();
      await rm(root, { recursive: true });
    }
  });

  it('ignores forged forwarding headers from untrusted peers and accepts a configured proxy', async () => {
    for (const trusted of [false, true]) {
      const app = buildApp({
        checkDatabase: async () => {},
        trustedProxy: trusted ? ['192.0.2.10/32'] : [],
      });
      app.get('/ip', (request) => ({ ip: request.ip }));
      try {
        const response = await app.inject({
          url: '/ip',
          remoteAddress: '192.0.2.10',
          headers: { 'x-forwarded-for': '198.51.100.20' },
        });
        expect(response.json().ip).toBe(
          trusted ? '198.51.100.20' : '192.0.2.10',
        );
        const direct = await app.inject({
          url: '/ip',
          remoteAddress: '192.0.2.11',
          headers: { 'x-forwarded-for': '198.51.100.20' },
        });
        expect(direct.json().ip).toBe('192.0.2.11');
      } finally {
        await app.close();
      }
    }
  });
});

describe('hosting configuration', () => {
  const values = { DATABASE_URL: 'postgresql://test:private@localhost/test' };
  it('defaults to local development without proxy trust and validates explicit IP ranges', () => {
    expect(readEnvironment(values).TRUSTED_PROXY_CIDRS).toEqual([]);
    expect(
      readEnvironment({
        ...values,
        MIGRATION_DATABASE_URL:
          'postgresql://operator:private@localhost/migrations',
      }).MIGRATION_DATABASE_URL,
    ).toBe('postgresql://operator:private@localhost/migrations');
    expect(() =>
      readEnvironment({ ...values, MIGRATION_DATABASE_URL: 'private-secret' }),
    ).toThrow(/^Invalid configuration: MIGRATION_DATABASE_URL$/);
    expect(
      readEnvironment({
        ...values,
        SERVE_WEB: 'true',
        APP_ORIGIN: 'https://test.example',
        TRUSTED_PROXY_CIDRS: '192.0.2.10/32, ::1',
      }).TRUSTED_PROXY_CIDRS,
    ).toEqual(['192.0.2.10/32', '::1']);
    for (const proxy of ['true', '1', '0.0.0.0/0,wrong'])
      expect(() =>
        readEnvironment({ ...values, TRUSTED_PROXY_CIDRS: proxy }),
      ).toThrow('TRUSTED_PROXY_CIDRS');
  });
  it('rejects insecure remote origins, paths and malformed settings without exposing secrets', () => {
    for (const APP_ORIGIN of [
      'http://test.example',
      'https://test.example/',
      'https://test.example/admin',
    ])
      expect(() => readEnvironment({ ...values, APP_ORIGIN })).toThrow(
        'APP_ORIGIN',
      );
    expect(() => readEnvironment({ DATABASE_URL: 'private-secret' })).toThrow(
      /^Invalid configuration: DATABASE_URL$/,
    );
    expect(() => readEnvironment({ ...values, SERVE_WEB: 'yes' })).toThrow(
      'SERVE_WEB',
    );
  });
});
