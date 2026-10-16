import { describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { PasswordBusyError } from './crypto';
import type { AuthService } from './service';

function failureApp(error: Error) {
  const service: AuthService = {
    login: async () => {
      throw error;
    },
    readSession: async () => {
      throw error;
    },
    logout: async () => {
      throw error;
    },
  };
  return buildApp({
    checkDatabase: async () => {},
    auth: { service, origin: 'http://127.0.0.1:5173' },
  });
}

describe('authentication failure boundaries', () => {
  it('returns a retryable 503 when password hashing is at capacity', async () => {
    const app = failureApp(new PasswordBusyError());
    try {
      const result = await app.inject({
        method: 'POST',
        url: '/auth/admin/login',
        headers: { 'x-d21-request': '1' },
        payload: { password: 'test only' },
      });
      expect(result.statusCode).toBe(503);
      expect(result.json().error.code).toBe('AUTH_BUSY');
      expect(result.headers['set-cookie']).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('fails closed when the session store is unavailable, without exposing details', async () => {
    const app = failureApp(new Error('private database connection details'));
    try {
      for (const url of ['/auth/session', '/admin/access']) {
        const result = await app.inject(url);
        expect(result.statusCode).toBe(500);
        expect(result.json().error.code).toBe('INTERNAL_ERROR');
        expect(result.body).not.toContain('private database');
        expect(result.json().authenticated).not.toBe(true);
      }
    } finally {
      await app.close();
    }
  });
});
