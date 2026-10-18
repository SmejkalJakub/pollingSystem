import type { Pool, PoolClient } from 'pg';
import { AppError } from '../../errors';

export const notFound = () =>
  new AppError(404, 'NOT_FOUND', 'Resource not found in this event.');
export const rosterLocked = () =>
  new AppError(
    409,
    'ROSTER_LOCKED',
    'Voting has started or ballots exist. Membership and group assignments are frozen.',
  );

// All roster mutations share this lock with the voting/ballot freeze triggers.
export async function withEventLock<T>(
  pool: Pool,
  eventId: string,
  action: (client: PoolClient, locked: boolean) => Promise<T>,
  readOnly = false,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT roster_locked_at FROM events WHERE id = $1 FOR ${readOnly ? 'SHARE' : 'UPDATE'}`,
      [eventId],
    );
    if (!result.rows[0]) throw notFound();
    const value = await action(
      client,
      result.rows[0].roster_locked_at !== null,
    );
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    // RESTRICT also protects preexisting secret/session/audit references.
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === '23503')
        throw new AppError(
          409,
          'MEMBERSHIP_REFERENCED',
          'This membership has historical references and cannot be removed.',
        );
      if (error.code === '23505')
        throw new AppError(
          409,
          'GROUP_EXISTS',
          'This event already has a group with this code.',
        );
    }
    throw error;
  } finally {
    client.release();
  }
}
