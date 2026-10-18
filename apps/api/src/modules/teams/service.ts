import type { AuthService } from '../auth/service';
import { adminEventLock } from '../auth/admin-transaction';
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  teamListSchema,
  teamRecordSchema,
  teamInputSchema,
  teamTableSnapshotSchema,
  type TeamTableInput,
  type TeamTableIssue,
  type TeamInput,
  type TeamPatch,
} from '@d21/contracts';
import { notFound } from '../events/locking';
import { AppError } from '../../errors';
const columns = `id, event_id AS "eventId", name, description, created_at AS "createdAt", updated_at AS "updatedAt"`;
function serialize(row: Record<string, unknown>) {
  return teamRecordSchema.parse({
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    description: row.description,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  });
}
async function tableSnapshot(client: PoolClient, eventId: string) {
  const result = await client.query(
    `SELECT ${columns}, extract(epoch from updated_at)::text AS "versionAt"
     FROM teams WHERE event_id=$1 ORDER BY created_at,id`,
    [eventId],
  );
  // Include precise database timestamps, including edits made by legacy PATCH.
  const version = createHash('sha256')
    .update(JSON.stringify([eventId, result.rows]))
    .digest('hex');
  return teamTableSnapshotSchema.parse({
    version,
    teams: result.rows.map(serialize),
  });
}
const tableConflict = () =>
  new AppError(
    409,
    'TEAM_TABLE_CONFLICT',
    'The team table changed. Review the current table before saving again.',
  );
export function createTeamService(
  pool: Pool,
  auth: AuthService,
  token: string | undefined,
) {
  const withLock = adminEventLock(pool, auth, token);
  return {
    async table(eventId: string) {
      return withLock(
        eventId,
        (client) => tableSnapshot(client, eventId),
        true,
      );
    },
    async saveTable(eventId: string, input: TeamTableInput) {
      return withLock(eventId, async (client) => {
        const issues: TeamTableIssue[] = [];
        const rows = input.rows.map((row) => {
          const parsed = teamInputSchema.safeParse({
            name: row.name,
            description: row.description,
          });
          if (parsed.success) return { id: row.id, ...parsed.data };
          for (const issue of parsed.error.issues)
            issues.push({
              rowId: row.id,
              field: issue.path[0] === 'name' ? 'name' : 'description',
            });
          return row;
        });
        if (issues.length) return { status: 'invalid' as const, issues };
        const current = await tableSnapshot(client, eventId);
        const byId = new Map(current.teams.map((team) => [team.id, team]));
        // Exact desired-state replay is read-only, even if the first response was lost.
        if (
          rows.length === byId.size &&
          rows.every((row) => {
            const team = byId.get(row.id);
            return (
              team?.name === row.name && team.description === row.description
            );
          })
        )
          return { status: 'saved' as const, snapshot: current };
        if (current.version !== input.baseVersion) throw tableConflict();
        const desiredIds = new Set(rows.map((row) => row.id));
        // Omission never deletes an existing team.
        if (current.teams.some((team) => !desiredIds.has(team.id)))
          throw tableConflict();
        for (const row of rows) {
          const team = byId.get(row.id);
          if (team) {
            if (team.name !== row.name || team.description !== row.description)
              await client.query(
                'UPDATE teams SET name=$3,description=$4,updated_at=statement_timestamp() WHERE event_id=$1 AND id=$2',
                [eventId, row.id, row.name, row.description],
              );
          } else {
            const added = await client.query(
              'INSERT INTO teams(id,event_id,name,description) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING RETURNING id',
              [row.id, eventId, row.name, row.description],
            );
            if (!added.rowCount) throw tableConflict();
          }
        }
        return {
          status: 'saved' as const,
          snapshot: await tableSnapshot(client, eventId),
        };
      });
    },
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
