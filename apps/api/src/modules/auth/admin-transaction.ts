import type { Pool, PoolClient } from 'pg';
import { AppError } from '../../errors';
import { withEventLock } from '../events/locking';
import type { AuthService } from './service';

export async function requireAdminSession(
  auth: AuthService,
  token: string | undefined,
  client: PoolClient,
) {
  const session = await auth.readSession(token, client);
  if (!session)
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  if (session.principal.kind !== 'admin')
    throw new AppError(403, 'FORBIDDEN', 'Administrative access is required.');
  return session.principal.id;
}

// Bind only the request's cookie, never a browser-supplied actor identity.
export function adminEventLock(
  pool: Pool,
  auth: AuthService,
  token: string | undefined,
) {
  return async function run<T>(
    eventId: string,
    action: (
      client: PoolClient,
      locked: boolean,
      adminId: string,
    ) => Promise<T>,
    readOnly = false,
  ) {
    return withEventLock(
      pool,
      eventId,
      async (client, locked) => {
        const adminId = await requireAdminSession(auth, token, client);
        const result = await action(client, locked, adminId);
        // Expiry or committed revocation during the operation rolls back writes.
        await requireAdminSession(auth, token, client);
        return result;
      },
      readOnly,
    );
  };
}

// Event creation/listing has no existing parent row to lock.
export async function adminTransaction<T>(
  pool: Pool,
  auth: AuthService,
  token: string | undefined,
  action: (client: PoolClient) => Promise<T>,
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await requireAdminSession(auth, token, client);
    const result = await action(client);
    await requireAdminSession(auth, token, client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
