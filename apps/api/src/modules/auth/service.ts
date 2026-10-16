import type { Pool } from 'pg';
import type { AuthenticatedSession } from '@d21/contracts';
import {
  newAdminPasswordSchema,
  authenticatedSessionSchema,
  jurorPrincipalSchema,
} from '@d21/contracts';
import {
  hashPassword,
  isSecret,
  newSecret,
  secretHash,
  verifyPassword,
} from './crypto';

export const SESSION_SECONDS = 12 * 60 * 60;

export function createAuthService(pool: Pool) {
  async function readSession(
    token: string | undefined,
  ): Promise<AuthenticatedSession | null> {
    if (!isSecret(token)) return null;
    const result = await pool.query(
      `SELECT s.expires_at, s.admin_user_id, s.event_id, s.juror_id,
              u.display_name AS admin_name, j.display_name AS juror_name, j.jury_group_id
       FROM sessions s
       LEFT JOIN admin_access a ON a.user_id = s.admin_user_id
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN event_jurors j ON j.id = s.juror_id AND j.event_id = s.event_id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
      [secretHash(token)],
    );
    const row = result.rows[0];
    if (!row) return null;
    const principal = row.admin_user_id
      ? { kind: 'admin', id: row.admin_user_id, displayName: row.admin_name }
      : {
          kind: 'juror',
          id: row.juror_id,
          eventId: row.event_id,
          juryGroupId: row.jury_group_id,
          displayName: row.juror_name,
        };
    return authenticatedSessionSchema.parse({
      authenticated: true,
      principal,
      expiresAt: row.expires_at.toISOString(),
    });
  }

  async function login(password: string, previousToken?: string) {
    const found = await pool.query(
      'SELECT user_id, password_hash FROM admin_access WHERE key = $1',
      ['administration'],
    );
    const credential = found.rows[0];
    const valid = await verifyPassword(password, credential?.password_hash);
    if (!credential || !valid) return null;
    const token = newSecret();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize with credential replacement/revocation, then recheck the verified hash.
      const locked = await client.query(
        'SELECT password_hash FROM admin_access WHERE user_id = $1 FOR UPDATE',
        [credential.user_id],
      );
      if (locked.rows[0]?.password_hash !== credential.password_hash) {
        await client.query('ROLLBACK');
        return null;
      }
      if (isSecret(previousToken))
        await client.query(
          'UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
          [secretHash(previousToken)],
        );
      await client.query(
        `INSERT INTO sessions (token_hash, admin_user_id, expires_at) VALUES ($1, $2, now() + interval '12 hours')`,
        [secretHash(token), credential.user_id],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    const session = await readSession(token);
    // A concurrent password replacement may revoke the new session immediately.
    if (!session) return null;
    return { token, session };
  }

  async function logout(token: string | undefined) {
    if (isSecret(token))
      await pool.query(
        'UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
        [secretHash(token)],
      );
  }

  return { login, readSession, logout };
}
export type AuthService = ReturnType<typeof createAuthService>;

export async function setAdminPassword(pool: Pool, password: string) {
  newAdminPasswordSchema.parse(password);
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Also serialize first-time provisioning, when no credential row exists yet.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('d21-admin-provisioning'))",
    );
    const existing = await client.query(
      "SELECT user_id FROM admin_access WHERE key = 'administration' FOR UPDATE",
    );
    let userId: string = existing.rows[0]?.user_id;
    if (!userId) {
      const user = await client.query(
        "INSERT INTO users (display_name) VALUES ('Administrace') RETURNING id",
      );
      userId = user.rows[0].id;
      await client.query(
        'INSERT INTO admin_access (user_id, password_hash) VALUES ($1, $2)',
        [userId, passwordHash],
      );
    } else {
      await client.query(
        'UPDATE admin_access SET password_hash = $1, updated_at = now() WHERE user_id = $2',
        [passwordHash, userId],
      );
      await client.query(
        'UPDATE sessions SET revoked_at = now() WHERE admin_user_id = $1 AND revoked_at IS NULL',
        [userId],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeAdminSessions(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT user_id FROM admin_access FOR UPDATE');
    const result = await client.query(
      'UPDATE sessions SET revoked_at = now() WHERE admin_user_id IS NOT NULL AND revoked_at IS NULL',
    );
    await client.query('COMMIT');
    return result.rowCount ?? 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Internal preparation, not a public entry endpoint. Never resolve by display name.
export async function resolveJurorAccess(
  pool: Pool,
  eventId: string,
  token: string,
) {
  if (!isSecret(token)) return null;
  const result = await pool.query(
    `SELECT j.id, j.event_id, j.jury_group_id, j.display_name FROM juror_access a
     JOIN event_jurors j ON j.id = a.juror_id AND j.event_id = a.event_id
     WHERE a.token_hash = $1 AND a.event_id = $2 AND a.revoked_at IS NULL`,
    [secretHash(token), eventId],
  );
  const row = result.rows[0];
  return row
    ? jurorPrincipalSchema.parse({
        kind: 'juror',
        id: row.id,
        eventId: row.event_id,
        juryGroupId: row.jury_group_id,
        displayName: row.display_name,
      })
    : null;
}
