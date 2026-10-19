import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  rosterSchema,
  jurorTableSnapshotSchema,
  jurorTableFieldsSchema,
  type JurorTableInput,
  type JurorTableIssue,
} from '@d21/contracts';
import type { adminEventLock } from '../auth/admin-transaction';
import { rosterLocked } from '../events/locking';
import { AppError } from '../../errors';

export async function readRoster(
  client: PoolClient,
  eventId: string,
  locked: boolean,
  alphabetical = false,
) {
  const groups = await client.query(
    'SELECT id,event_id AS "eventId",code,name FROM jury_groups WHERE event_id=$1 ORDER BY code',
    [eventId],
  );
  const jurors = await client.query(
    `SELECT id,event_id AS "eventId",jury_group_id AS "juryGroupId",display_name AS "displayName",created_at AS "createdAt",updated_at AS "updatedAt",
    extract(epoch from updated_at)::text AS "versionAt" FROM event_jurors WHERE event_id=$1 ORDER BY ${alphabetical ? 'display_name,id' : 'created_at,id'}`,
    [eventId],
  );
  const access = await client.query(
    `SELECT DISTINCT ON (juror_id) juror_id,CASE WHEN encrypted_token IS NOT NULL THEN 'stored' ELSE 'legacy' END AS access
    FROM juror_access WHERE event_id=$1 AND revoked_at IS NULL ORDER BY juror_id,created_at DESC,token_hash`,
    [eventId],
  );
  return {
    version: createHash('sha256')
      .update(JSON.stringify([eventId, locked, groups.rows, jurors.rows]))
      .digest('hex'),
    ...rosterSchema.parse({
      groups: groups.rows,
      locked,
      jurors: jurors.rows.map((row) => ({
        id: row.id,
        eventId: row.eventId,
        juryGroupId: row.juryGroupId,
        displayName: row.displayName,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        access:
          access.rows.find((value) => value.juror_id === row.id)?.access ??
          'none',
      })),
    }),
  };
}
const conflict = () =>
  new AppError(
    409,
    'JUROR_TABLE_CONFLICT',
    'The roster changed. Review the current roster before saving again.',
  );
export function createJurorTable(withLock: ReturnType<typeof adminEventLock>) {
  return {
    table(eventId: string) {
      return withLock(
        eventId,
        async (client, locked) =>
          jurorTableSnapshotSchema.parse(
            await readRoster(client, eventId, locked),
          ),
        true,
      );
    },
    saveTable(eventId: string, input: JurorTableInput) {
      return withLock(eventId, async (client, locked) => {
        const issues: JurorTableIssue[] = [];
        const rows = input.rows.map((row) => {
          const parsed = jurorTableFieldsSchema.safeParse({
            displayName: row.displayName,
            groupCode: row.groupCode,
          });
          if (parsed.success) return { id: row.id, ...parsed.data };
          for (const issue of parsed.error.issues)
            issues.push({
              rowId: row.id,
              field:
                issue.path[0] === 'displayName' ? 'displayName' : 'groupCode',
            });
          return row;
        });
        if (issues.length) return { status: 'invalid' as const, issues };
        const current = await readRoster(client, eventId, locked);
        const byId = new Map(current.jurors.map((juror) => [juror.id, juror]));
        const groupByCode = new Map(
          current.groups.map((group) => [String(group.code), group.id]),
        );
        // Replay exact desired state without timestamps, credentials or membership writes.
        if (
          rows.length === byId.size &&
          rows.every((row) => {
            const juror = byId.get(row.id);
            return (
              juror?.displayName === row.displayName &&
              juror.juryGroupId === groupByCode.get(row.groupCode)
            );
          }) &&
          (locked || groupByCode.size === 2)
        )
          return { status: 'saved' as const, snapshot: current };
        if (input.baseVersion !== current.version) throw conflict();
        const ids = new Set(rows.map((row) => row.id));
        if (current.jurors.some((juror) => !ids.has(juror.id)))
          throw conflict();
        if (
          locked &&
          rows.some((row) => {
            const juror = byId.get(row.id);
            return (
              !juror || juror.juryGroupId !== groupByCode.get(row.groupCode)
            );
          })
        )
          throw rosterLocked();
        if (!locked) {
          for (const [code, name] of [
            ['T', 'Technická porota'],
            ['V', 'Druhá část poroty'],
          ] as const) {
            if (!groupByCode.has(code)) {
              const added = await client.query(
                'INSERT INTO jury_groups(event_id,code,name) VALUES ($1,$2,$3) RETURNING id',
                [eventId, code, name],
              );
              groupByCode.set(code, added.rows[0].id);
            }
          }
        }
        for (const row of rows) {
          const juror = byId.get(row.id),
            groupId = groupByCode.get(row.groupCode);
          if (juror) {
            if (
              juror.displayName !== row.displayName ||
              juror.juryGroupId !== groupId
            )
              await client.query(
                'UPDATE event_jurors SET display_name=$3,jury_group_id=$4,updated_at=statement_timestamp() WHERE event_id=$1 AND id=$2',
                [eventId, row.id, row.displayName, groupId],
              );
          } else {
            const added = await client.query(
              'INSERT INTO event_jurors(id,event_id,display_name,jury_group_id) VALUES ($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id',
              [row.id, eventId, row.displayName, groupId],
            );
            if (!added.rowCount) throw conflict();
          }
        }
        return {
          status: 'saved' as const,
          snapshot: await readRoster(client, eventId, locked),
        };
      });
    },
  };
}
