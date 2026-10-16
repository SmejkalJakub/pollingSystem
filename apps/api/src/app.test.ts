import { describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  healthResponseSchema,
  readinessResponseSchema,
} from '@d21/contracts';
import { buildApp } from './app';

describe('foundation API', () => {
  it('reports liveness separately from database readiness', async () => {
    const app = buildApp({
      checkDatabase: async () => {
        throw new Error('private database details');
      },
    });
    try {
      const health = await app.inject('/health');
      expect(health.statusCode).toBe(200);
      expect(healthResponseSchema.parse(health.json()).status).toBe('ok');
      const ready = await app.inject('/ready');
      expect(ready.statusCode).toBe(503);
      expect(readinessResponseSchema.parse(ready.json()).database).toBe(
        'unavailable',
      );
      expect(ready.body).not.toContain('private database');
    } finally {
      await app.close();
    }
  });

  it('checks the database before declaring readiness', async () => {
    let checked = false;
    const app = buildApp({
      checkDatabase: async () => {
        checked = true;
      },
    });
    try {
      const response = await app.inject('/ready');
      expect(checked).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(readinessResponseSchema.parse(response.json()).status).toBe(
        'ready',
      );
    } finally {
      await app.close();
    }
  });

  it('returns a stable error contract for unknown routes', async () => {
    const app = buildApp({ checkDatabase: async () => {} });
    try {
      const response = await app.inject('/events');
      expect(response.statusCode).toBe(404);
      expect(apiErrorSchema.parse(response.json()).error.code).toBe(
        'NOT_FOUND',
      );
    } finally {
      await app.close();
    }
  });
});
