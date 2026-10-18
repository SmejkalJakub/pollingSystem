import type { PoolClient } from 'pg';
import { AppError } from '../../errors';

// Caller holds the parent event lock, shared with every roster mutation.
export async function requireReadyRoster(client: PoolClient, eventId: string) {
  const result = await client.query<{ code: string; count: number }>(
    `SELECT g.code,count(j.id)::int AS count FROM jury_groups g
     LEFT JOIN event_jurors j ON j.event_id=g.event_id AND j.jury_group_id=g.id
     WHERE g.event_id=$1 GROUP BY g.code ORDER BY g.code`,
    [eventId],
  );
  const t = result.rows.find((group) => group.code === 'T')?.count;
  const v = result.rows.find((group) => group.code === 'V')?.count;
  if (t === undefined || t !== v || ![5, 7, 9].includes(t))
    throw new AppError(
      409,
      'ROSTER_NOT_READY',
      'Both T and V must have the same number of jurors: 5, 7 or 9 each.',
    );
}
