import { adminEventLock } from '../auth/admin-transaction';
import type { Pool, PoolClient } from 'pg';
import { adminBallotSchema, adminBallotsSchema } from '@d21/contracts';
import { AppError } from '../../errors';
import { notFound } from '../events/locking';
import type { AuthService } from '../auth/service';

const columns = `b.id,b.juror_id AS "jurorId",j.display_name AS "displayName",b.status,b.revision,
  to_char(b.submitted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "submittedAt"`;
async function list(client: PoolClient, eventId: string, votingId: string) {
  return adminBallotsSchema.parse(
    (
      await client.query(
        `SELECT ${columns} FROM ballots b JOIN event_jurors j ON j.event_id=b.event_id AND j.id=b.juror_id
     WHERE b.event_id=$1 AND b.voting_id=$2 ORDER BY j.display_name,b.id`,
        [eventId, votingId],
      )
    ).rows,
  );
}
export function createBallotAdminService(pool: Pool, auth: AuthService) {
  async function run<T>(
    token: string | undefined,
    votingId: string,
    readOnly: boolean,
    action: (
      client: PoolClient,
      eventId: string,
      adminId: string,
    ) => Promise<T>,
  ) {
    const voting = (
      await pool.query('SELECT event_id FROM votings WHERE id=$1', [votingId])
    ).rows[0];
    if (!voting) throw notFound();
    return adminEventLock(pool, auth, token)(
      voting.event_id,
      (client, _locked, adminId) => action(client, voting.event_id, adminId),
      readOnly,
    );
  }
  return {
    list: (token: string | undefined, votingId: string) =>
      run(token, votingId, true, (client, eventId) =>
        list(client, eventId, votingId),
      ),
    unlock: (
      token: string | undefined,
      votingId: string,
      ballotId: string,
      expectedRevision: number,
    ) =>
      run(token, votingId, false, async (client, eventId, adminId) => {
        const ballot = (
          await client.query(
            `SELECT b.*, coalesce((SELECT json_agg(json_build_object('votingItemId',e.voting_item_id,'voteValue',e.vote_value)
           ORDER BY e.voting_item_id) FROM ballot_entries e WHERE e.ballot_id=b.id),'[]') AS entries
           FROM ballots b WHERE b.event_id=$1 AND b.voting_id=$2 AND b.id=$3 FOR UPDATE`,
            [eventId, votingId, ballotId],
          )
        ).rows[0];
        if (!ballot) throw notFound();
        // A replay is harmless only while the exact resulting draft is still current.
        const replay =
          ballot.status === 'draft' &&
          ballot.revision === expectedRevision + 1 &&
          (
            await client.query(
              `SELECT 1 FROM audit_logs WHERE event_id=$1 AND target_id=$2
            AND action='ballot.unlocked' AND context->>'revision'=$3`,
              [eventId, ballotId, String(ballot.revision)],
            )
          ).rowCount;
        if (!replay) {
          if (ballot.revision !== expectedRevision)
            throw new AppError(
              409,
              'BALLOT_CONFLICT',
              'This ballot changed. Refresh before unlocking.',
            );
          if (ballot.status !== 'submitted')
            throw new AppError(
              409,
              'BALLOT_NOT_SUBMITTED',
              'Only submitted ballots can be unlocked.',
            );
          if (ballot.revision === 2147483647)
            throw new AppError(
              409,
              'REVISION_EXHAUSTED',
              'This ballot cannot accept more revisions.',
            );
          // Capture legacy submissions too; the history write and state transition roll back together.
          await client.query(
            `INSERT INTO audit_logs(event_id,actor_user_id,action,target_type,target_id,context)
            VALUES ($1,$2,'ballot.unlocked','ballot',$3,$4::jsonb)`,
            [
              eventId,
              adminId,
              ballotId,
              JSON.stringify({
                votingId,
                jurorId: ballot.juror_id,
                revision: ballot.revision + 1,
                previousRevision: ballot.revision,
                submittedAt: ballot.submitted_at.toISOString(),
                entries: ballot.entries,
              }),
            ],
          );
          await client.query(
            `UPDATE ballots SET status='draft',revision=revision+1,submitted_at=NULL,
            updated_at=statement_timestamp() WHERE id=$1`,
            [ballotId],
          );
        }
        return adminBallotSchema.parse(
          (await list(client, eventId, votingId)).find(
            (b) => b.id === ballotId,
          ),
        );
      }),
  };
}
export type BallotAdminService = ReturnType<typeof createBallotAdminService>;
