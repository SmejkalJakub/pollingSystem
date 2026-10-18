import type { PoolClient } from 'pg';

export async function auditAdminAction(
  client: PoolClient,
  eventId: string,
  adminId: string,
  action:
    | 'voting.activated'
    | 'voting.closed'
    | 'voting.reopened'
    | 'juror_access.issued'
    | 'juror_access.revoked',
  targetType: 'voting' | 'juror',
  targetId: string,
  context: Record<string, string | number>,
) {
  await client.query(
    `INSERT INTO audit_logs(event_id,actor_user_id,action,target_type,target_id,context,created_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,statement_timestamp())`,
    [eventId, adminId, action, targetType, targetId, JSON.stringify(context)],
  );
}
