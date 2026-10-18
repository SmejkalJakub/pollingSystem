import type { AuthService } from '../auth/service';
import { adminEventLock } from '../auth/admin-transaction';
import type { Pool } from 'pg';
import {
  teamListSchema,
  teamRecordSchema,
  type TeamInput,
  type TeamPatch,
} from '@d21/contracts';
import { notFound } from '../events/locking';
const columns = `id, event_id AS "eventId", name, description, created_at AS "createdAt", updated_at AS "updatedAt"`;
function serialize(row: Record<string, unknown>) {
  return teamRecordSchema.parse({
    ...row,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  });
}
export function createTeamService(
  pool: Pool,
  auth: AuthService,
  token: string | undefined,
) {
  const withLock = adminEventLock(pool, auth, token);
  return {
    async list(eventId: string) {
      return withLock(
        eventId,
        async (client) => {
          const result = await client.query(
            `SELECT ${columns} FROM teams WHERE event_id=$1 ORDER BY created_at,id`,
            [eventId],
          );
          return teamListSchema.parse(result.rows.map(serialize));
        },
        true,
      );
    },
    async create(eventId: string, input: TeamInput) {
      return withLock(eventId, async (client) => {
        const result = await client.query(
          `INSERT INTO teams (event_id,name,description) VALUES ($1,$2,$3) RETURNING ${columns}`,
          [eventId, input.name, input.description],
        );
        return serialize(result.rows[0]);
      });
    },
    async update(eventId: string, teamId: string, input: TeamPatch) {
      return withLock(eventId, async (client) => {
        const result = await client.query(
          `UPDATE teams SET name=coalesce($3,name),description=coalesce($4,description),updated_at=now() WHERE event_id=$1 AND id=$2 RETURNING ${columns}`,
          [eventId, teamId, input.name, input.description],
        );
        if (!result.rows[0]) throw notFound();
        // Item reads join the shared team; historical item snapshots and ballot rows stay intact.
        return serialize(result.rows[0]);
      });
    },
  };
}
export type TeamService = ReturnType<typeof createTeamService>;
