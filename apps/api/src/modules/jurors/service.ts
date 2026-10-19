import type { AuthService } from '../auth/service';
import { adminEventLock } from '../auth/admin-transaction';
import type { Pool, PoolClient } from 'pg';
import type { JuryGroupInput, JurorInput, JurorPatch } from '@d21/contracts';
import { juryGroupSchema, jurorSchema, rosterSchema } from '@d21/contracts';
import { readRoster, createJurorTable } from './table';
import { AppError } from '../../errors';
import { notFound, rosterLocked } from '../events/locking';

const groupColumns = `id, event_id AS "eventId", code, name`;
const jurorColumns = `id, event_id AS "eventId", jury_group_id AS "juryGroupId", display_name AS "displayName", created_at AS "createdAt", updated_at AS "updatedAt"`;
function serializeJuror(row: Record<string, unknown>) {
  return jurorSchema.parse({
    ...row,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  });
}
async function requireGroup(
  client: PoolClient,
  eventId: string,
  groupId: string,
) {
  const group = await client.query(
    'SELECT id FROM jury_groups WHERE event_id = $1 AND id = $2',
    [eventId, groupId],
  );
  if (!group.rows[0])
    throw new AppError(
      400,
      'INVALID_GROUP',
      'Choose a group belonging to this event.',
    );
}
export function createJuryService(
  pool: Pool,
  auth: AuthService,
  token: string | undefined,
) {
  const withLock = adminEventLock(pool, auth, token);
  return {
    async roster(eventId: string) {
      return withLock(
        eventId,
        (client, locked) =>
          readRoster(client, eventId, locked, true).then(
            ({ groups, jurors, locked }) =>
              rosterSchema.parse({ groups, jurors, locked }),
          ),
        true,
      );
    },
    ...createJurorTable(withLock),
    async createGroup(eventId: string, input: JuryGroupInput) {
      return withLock(eventId, async (client, locked) => {
        if (locked) throw rosterLocked();
        const result = await client.query(
          `INSERT INTO jury_groups (event_id, code, name) VALUES ($1, $2, $3) RETURNING ${groupColumns}`,
          [eventId, input.code, input.name],
        );
        return juryGroupSchema.parse(result.rows[0]);
      });
    },
    async renameGroup(eventId: string, groupId: string, name: string) {
      return withLock(eventId, async (client) => {
        const result = await client.query(
          `UPDATE jury_groups SET name = $3 WHERE event_id = $1 AND id = $2 RETURNING ${groupColumns}`,
          [eventId, groupId, name],
        );
        if (!result.rows[0]) throw notFound();
        return juryGroupSchema.parse(result.rows[0]);
      });
    },
    async createJuror(eventId: string, input: JurorInput) {
      return withLock(eventId, async (client, locked) => {
        if (locked) throw rosterLocked();
        await requireGroup(client, eventId, input.juryGroupId);
        const result = await client.query(
          `INSERT INTO event_jurors (event_id, jury_group_id, display_name) VALUES ($1, $2, $3) RETURNING ${jurorColumns}`,
          [eventId, input.juryGroupId, input.displayName],
        );
        return serializeJuror(result.rows[0]);
      });
    },
    async updateJuror(eventId: string, jurorId: string, input: JurorPatch) {
      return withLock(eventId, async (client, locked) => {
        const existing = await client.query(
          'SELECT jury_group_id FROM event_jurors WHERE event_id = $1 AND id = $2',
          [eventId, jurorId],
        );
        if (!existing.rows[0]) throw notFound();
        if (
          input.juryGroupId !== undefined &&
          input.juryGroupId !== existing.rows[0].jury_group_id
        ) {
          if (locked) throw rosterLocked();
          await requireGroup(client, eventId, input.juryGroupId);
        }
        const result = await client.query(
          `UPDATE event_jurors SET display_name = coalesce($3, display_name), jury_group_id = coalesce($4, jury_group_id), updated_at = now() WHERE event_id = $1 AND id = $2 RETURNING ${jurorColumns}`,
          [eventId, jurorId, input.displayName, input.juryGroupId],
        );
        return serializeJuror(result.rows[0]);
      });
    },
    async removeJuror(eventId: string, jurorId: string) {
      return withLock(eventId, async (client, locked) => {
        const existing = await client.query(
          'SELECT id FROM event_jurors WHERE event_id = $1 AND id = $2',
          [eventId, jurorId],
        );
        if (!existing.rows[0]) throw notFound();
        if (locked) throw rosterLocked();
        await client.query(
          'DELETE FROM event_jurors WHERE event_id = $1 AND id = $2',
          [eventId, jurorId],
        );
      });
    },
  };
}
