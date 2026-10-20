import type { PoolClient } from 'pg';
import { newSecret, secretHash } from './crypto';
import type { LinkVault } from './link-vault';
import { auditAdminAction } from '../events/audit';

// Caller holds the event lock and current administration authorization.
// Any history, including revoked and legacy credentials, prevents automatic issuance.
export async function ensureInitialJurorLink(
  client: PoolClient,
  vault: LinkVault,
  eventId: string,
  jurorId: string,
  adminId: string,
) {
  const history = await client.query(
    'SELECT 1 FROM juror_access WHERE event_id=$1 AND juror_id=$2 LIMIT 1',
    [eventId, jurorId],
  );
  if (history.rowCount) return;
  const token = newSecret();
  const tokenHash = secretHash(token);
  const encrypted = vault.encrypt(token, { eventId, jurorId, tokenHash });
  await client.query(
    'INSERT INTO juror_access(token_hash,event_id,juror_id,encrypted_token) VALUES ($1,$2,$3,$4)',
    [tokenHash, eventId, jurorId, encrypted],
  );
  await auditAdminAction(
    client,
    eventId,
    adminId,
    'juror_access.issued',
    'juror',
    jurorId,
    { replacedLinks: 0, revokedSessions: 0 },
  );
}
