import type { AuthService } from '../auth/service';
import { adminEventLock, adminTransaction } from '../auth/admin-transaction';
import type { Pool } from 'pg';
import type { EventInput, EventPatch } from '@d21/contracts';
import { eventListSchema, eventSchema } from '@d21/contracts';
import { notFound } from './locking';
import { createJuryService } from '../jurors/service';
import { createLinkVault, type LinkVault } from '../auth/link-vault';

const eventColumns = `id, name, description, created_at AS "createdAt", updated_at AS "updatedAt"`;
function serializeEvent(row: Record<string, unknown>) {
  return eventSchema.parse({
    ...row,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  });
}

export function createEventService(
  pool: Pool,
  auth: AuthService,
  vault: LinkVault = createLinkVault(),
) {
  return (token: string | undefined) => {
    const withLock = adminEventLock(pool, auth, token);
    return {
      jury: createJuryService(pool, auth, token, vault),
      async list() {
        return adminTransaction(pool, auth, token, async (client) => {
          const result = await client.query(
            `SELECT ${eventColumns} FROM events ORDER BY created_at DESC, id`,
          );
          return eventListSchema.parse(result.rows.map(serializeEvent));
        });
      },
      async create(input: EventInput) {
        return adminTransaction(pool, auth, token, async (client) => {
          const result = await client.query(
            `INSERT INTO events (name, description) VALUES ($1, $2) RETURNING ${eventColumns}`,
            [input.name, input.description],
          );
          return serializeEvent(result.rows[0]);
        });
      },
      async get(eventId: string) {
        return withLock(
          eventId,
          async (client) => {
            const result = await client.query(
              `SELECT ${eventColumns} FROM events WHERE id = $1`,
              [eventId],
            );
            if (!result.rows[0]) throw notFound();
            return serializeEvent(result.rows[0]);
          },
          true,
        );
      },
      async update(eventId: string, input: EventPatch) {
        return withLock(eventId, async (client) => {
          const result = await client.query(
            `UPDATE events SET name = coalesce($2, name), description = coalesce($3, description), updated_at = now() WHERE id = $1 RETURNING ${eventColumns}`,
            [eventId, input.name, input.description],
          );
          if (!result.rows[0]) throw notFound();
          return serializeEvent(result.rows[0]);
        });
      },
    };
  };
}
export type EventService = ReturnType<typeof createEventService>;
