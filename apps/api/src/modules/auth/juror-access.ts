import { createLinkVault, type LinkVault } from './link-vault';
import { adminEventLock } from './admin-transaction';
import { auditAdminAction } from '../events/audit';
import type { Pool } from 'pg';
import { AppError } from '../../errors';
import { notFound, withEventLock } from '../events/locking';
import { isSecret, newSecret, secretHash } from './crypto';
import type { AuthService } from './service';

const invalidLink = () =>
  new AppError(
    401,
    'INVALID_JUROR_LINK',
    'This personal link is invalid or revoked. Ask the organizer for a new link.',
  );

export function createJurorAccessService(
  pool: Pool,
  auth: AuthService,
  vault: LinkVault = createLinkVault(),
) {
  async function manage(
    token: string | undefined,
    eventId: string,
    jurorId: string,
    issue: boolean,
  ) {
    return adminEventLock(
      pool,
      auth,
      token,
    )(eventId, async (client, _locked, adminId) => {
      const juror = await client.query(
        'SELECT id FROM event_jurors WHERE event_id=$1 AND id=$2',
        [eventId, jurorId],
      );
      if (!juror.rowCount) throw notFound();
      // Serialize issuance, redemption, roster changes and revocation on the event.
      const revokedLinks = await client.query(
        'UPDATE juror_access SET revoked_at=now() WHERE event_id=$1 AND juror_id=$2 AND revoked_at IS NULL',
        [eventId, jurorId],
      );
      const revokedSessions = await client.query(
        'UPDATE sessions SET revoked_at=now() WHERE event_id=$1 AND juror_id=$2 AND revoked_at IS NULL',
        [eventId, jurorId],
      );
      if (!issue) {
        if (revokedLinks.rowCount || revokedSessions.rowCount)
          await auditAdminAction(
            client,
            eventId,
            adminId,
            'juror_access.revoked',
            'juror',
            jurorId,
            {
              links: revokedLinks.rowCount ?? 0,
              sessions: revokedSessions.rowCount ?? 0,
            },
          );
        return;
      }
      const linkToken = newSecret();
      await client.query(
        'INSERT INTO juror_access(token_hash,event_id,juror_id,encrypted_token) VALUES ($1,$2,$3,$4)',
        [
          secretHash(linkToken),
          eventId,
          jurorId,
          vault.encrypt(linkToken, {
            eventId,
            jurorId,
            tokenHash: secretHash(linkToken),
          }),
        ],
      );
      await auditAdminAction(
        client,
        eventId,
        adminId,
        'juror_access.issued',
        'juror',
        jurorId,
        {
          replacedLinks: revokedLinks.rowCount ?? 0,
          revokedSessions: revokedSessions.rowCount ?? 0,
        },
      );
      return linkToken;
    });
  }
  return {
    async copy(token: string | undefined, eventId: string, jurorId: string) {
      return adminEventLock(pool, auth, token)(
        eventId,
        async (client) => {
          const juror = await client.query(
            'SELECT id FROM event_jurors WHERE event_id=$1 AND id=$2',
            [eventId, jurorId],
          );
          if (!juror.rowCount) throw notFound();
          const result = await client.query(
            'SELECT token_hash, encrypted_token FROM juror_access WHERE event_id=$1 AND juror_id=$2 AND revoked_at IS NULL ORDER BY created_at DESC, token_hash LIMIT 1',
            [eventId, jurorId],
          );
          const row = result.rows[0];
          if (!row)
            throw new AppError(
              409,
              'NO_ACTIVE_LINK',
              'This juror has no active personal link.',
            );
          if (!row.encrypted_token)
            throw new AppError(
              409,
              'LEGACY_LINK',
              'This legacy link still works but cannot be recovered. Explicit replacement is required to enable copying.',
            );
          return vault.decrypt(row.encrypted_token, {
            eventId,
            jurorId,
            tokenHash: row.token_hash,
          });
        },
        true,
      );
    },
    issue: (token: string | undefined, eventId: string, jurorId: string) =>
      manage(token, eventId, jurorId, true),
    revoke: (token: string | undefined, eventId: string, jurorId: string) =>
      manage(token, eventId, jurorId, false),
    async status(token: string | undefined, eventId: string, jurorId: string) {
      return adminEventLock(pool, auth, token)(
        eventId,
        async (client) => {
          const result = await client.query(
            `SELECT EXISTS(SELECT 1 FROM juror_access a WHERE a.event_id=j.event_id AND a.juror_id=j.id AND a.revoked_at IS NULL) AS issued
        FROM event_jurors j WHERE j.event_id=$1 AND j.id=$2`,
            [eventId, jurorId],
          );
          if (!result.rows[0]) throw notFound();
          return { issued: result.rows[0].issued as boolean };
        },
        true,
      );
    },
    async start(eventId: string, accessToken: string, previousToken?: string) {
      if (!isSecret(accessToken)) throw invalidLink();
      // Do not disclose whether an event exists to someone without its secret.
      const candidate = await pool.query(
        'SELECT 1 FROM juror_access WHERE token_hash=$1 AND event_id=$2 AND revoked_at IS NULL',
        [secretHash(accessToken), eventId],
      );
      if (!candidate.rowCount) throw invalidLink();
      const token = newSecret();
      await withEventLock(pool, eventId, async (client) => {
        const access = await client.query(
          'SELECT juror_id FROM juror_access WHERE token_hash=$1 AND event_id=$2 AND revoked_at IS NULL',
          [secretHash(accessToken), eventId],
        );
        if (!access.rows[0]) throw invalidLink();
        if (isSecret(previousToken))
          await client.query(
            'UPDATE sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL',
            [secretHash(previousToken)],
          );
        await client.query(
          `INSERT INTO sessions(token_hash,event_id,juror_id,expires_at) VALUES ($1,$2,$3,NULL)`,
          [secretHash(token), eventId, access.rows[0].juror_id],
        );
      });
      const session = await auth.readSession(token);
      if (!session) throw invalidLink();
      return { token, session };
    },
  };
}
export type JurorAccessService = ReturnType<typeof createJurorAccessService>;
