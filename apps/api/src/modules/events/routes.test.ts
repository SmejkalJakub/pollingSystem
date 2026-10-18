import { describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { createEventService } from './service';
import { createAuthService } from '../auth/service';
import type { Pool } from 'pg';

describe('administrative event scope', () => {
  it('registers event/jury routes under the cookie/origin scope and rejects anonymous access before querying', async () => {
    const pool = {
      query: async () => {
        throw new Error('Must not query without authorization');
      },
    } as unknown as Pool;
    const app = buildApp({
      checkDatabase: async () => {},
      auth: {
        origin: 'http://127.0.0.1:5173',
        service: {
          readSession: async () => null,
          login: async () => null,
          logout: async () => {},
        },
        events: createEventService(pool, createAuthService(pool)),
      },
    });
    try {
      expect((await app.inject('/events')).statusCode).toBe(401);
      expect(
        (
          await app.inject(
            '/events/445b63d5-b700-46dc-ae86-aad67986c815/jurors',
          )
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/events',
            payload: { name: 'A', description: '' },
          })
        ).statusCode,
      ).toBe(403);
    } finally {
      await app.close();
    }
  });
});
