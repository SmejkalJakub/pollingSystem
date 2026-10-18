import type { PoolClient } from 'pg';
import {
  ballotDraftSchema,
  type BallotDraft,
  type BallotDraftInput,
  type WizardStep,
} from '@d21/contracts';
import { validateBallot } from '@d21/voting-domain';
import { AppError } from '../../errors';

// Called only within the wizard's event/session/current-group transaction.
export async function readBallots(
  client: PoolClient,
  eventId: string,
  jurorId: string,
  steps: WizardStep[],
) {
  const result = await client.query(
    `SELECT b.voting_id,b.status,b.revision,b.updated_at,b.submitted_at,
     coalesce((SELECT json_agg(json_build_object('votingItemId',e.voting_item_id,'voteValue',e.vote_value)
       ORDER BY i.display_order,i.id) FROM ballot_entries e
       JOIN voting_items i ON i.event_id=e.event_id AND i.voting_id=e.voting_id AND i.id=e.voting_item_id
       WHERE e.event_id=b.event_id AND e.voting_id=b.voting_id AND e.ballot_id=b.id),'[]') AS entries,
     ARRAY(SELECT id FROM voting_items WHERE event_id=b.event_id AND voting_id=b.voting_id) AS item_ids
     FROM ballots b WHERE b.event_id=$1 AND b.juror_id=$2 AND b.voting_id=ANY($3::uuid[])`,
    [eventId, jurorId, steps.map((step) => step.id)],
  );
  const saved = new Map<string, BallotDraft>();
  for (const row of result.rows) {
    const step = steps.find((step) => step.id === row.voting_id)!;
    const validation = validateBallot(step, row.item_ids, row.entries);
    // Availability and draft quality are independent: closure retains draft progress.
    const ruleValid = validateBallot(
      { ...step, status: 'active' },
      row.item_ids,
      row.entries,
    ).valid;
    saved.set(
      step.id,
      ballotDraftSchema.parse({
        status: row.status,
        revision: row.revision,
        savedAt: row.updated_at.toISOString(),
        submittedAt: row.submitted_at?.toISOString() ?? null,
        entries: row.entries,
        validation,
        progress:
          row.status === 'submitted'
            ? 'submitted'
            : row.status !== 'draft'
              ? 'locked'
              : ruleValid
                ? 'in_progress'
                : 'invalid_draft',
      }),
    );
  }
  return saved;
}

export async function submitBallot(
  client: PoolClient,
  eventId: string,
  jurorId: string,
  step: WizardStep,
  itemIds: string[],
  input: BallotDraftInput,
) {
  // The exclusive event lock serializes absence, draft saves, submits and unlocks.
  const current = (await readBallots(client, eventId, jurorId, [step])).get(
    step.id,
  );
  if (current?.status === 'submitted') {
    const sameEntries =
      current.entries.length === input.entries.length &&
      current.entries.every((entry) =>
        input.entries.some(
          (other) =>
            entry.votingItemId === other.votingItemId &&
            entry.voteValue === other.voteValue,
        ),
      );
    if (current.revision === (input.expectedRevision ?? 0) + 1 && sameEntries)
      return current;
    throw new AppError(
      409,
      'BALLOT_NOT_EDITABLE',
      'This ballot is already submitted.',
    );
  }
  const report = validateBallot(step, itemIds, input.entries);
  if (!report.valid) {
    const code = report.issues.includes('VOTING_UNAVAILABLE')
      ? 'VOTING_UNAVAILABLE'
      : report.issues.includes('CONFIGURATION_NOT_READY')
        ? 'CONFIGURATION_NOT_READY'
        : 'INVALID_BALLOT';
    throw new AppError(409, code, 'This selection cannot be submitted.');
  }
  await saveDraft(client, eventId, jurorId, step, itemIds, input);
  const result = await client.query(
    `UPDATE ballots SET status='submitted',submitted_at=statement_timestamp(),updated_at=statement_timestamp()
     WHERE event_id=$1 AND voting_id=$2 AND juror_id=$3 RETURNING id`,
    [eventId, step.id, jurorId],
  );
  const snapshot = (await readBallots(client, eventId, jurorId, [step])).get(
    step.id,
  )!;
  await client.query(
    `INSERT INTO audit_logs(event_id,actor_juror_id,action,target_type,target_id,context)
     VALUES ($1,$2,'ballot.submitted','ballot',$3,$4::jsonb)`,
    [
      eventId,
      jurorId,
      result.rows[0].id,
      JSON.stringify({
        votingId: step.id,
        ...snapshot,
        rules: {
          selectedPlaces: step.selectedPlaces,
          maxPlusVotes: step.maxPlusVotes,
          maxMinusVotes: step.maxMinusVotes,
          allowNegativeVotes: step.allowNegativeVotes,
        },
      }),
    ],
  );
  return snapshot;
}

export async function saveDraft(
  client: PoolClient,
  eventId: string,
  jurorId: string,
  step: WizardStep,
  itemIds: string[],
  input: BallotDraftInput,
) {
  const report = validateBallot(step, itemIds, input.entries);
  if (report.issues.includes('VOTING_UNAVAILABLE'))
    throw new AppError(
      409,
      'VOTING_UNAVAILABLE',
      'This category is not open. Its saved draft is preserved.',
    );
  if (report.issues.includes('CONFIGURATION_NOT_READY'))
    throw new AppError(
      409,
      'CONFIGURATION_NOT_READY',
      'This category is not ready.',
    );
  if (
    report.issues.some(
      (issue) => issue === 'UNKNOWN_ITEM' || issue === 'DUPLICATE_ITEM',
    )
  )
    throw new AppError(
      400,
      'INVALID_DRAFT_ENTRIES',
      'Entries must be unique items from this category.',
    );
  const existing = (
    await client.query(
      'SELECT id,status,revision FROM ballots WHERE event_id=$1 AND voting_id=$2 AND juror_id=$3 FOR UPDATE',
      [eventId, step.id, jurorId],
    )
  ).rows[0];
  if (existing && existing.status !== 'draft')
    throw new AppError(
      409,
      'BALLOT_NOT_EDITABLE',
      'This ballot cannot be edited.',
    );
  if ((existing?.revision ?? null) !== input.expectedRevision)
    throw new AppError(
      409,
      'DRAFT_CONFLICT',
      'A newer draft exists. Compare it before saving again.',
    );
  if (existing?.revision === 2147483647)
    throw new AppError(
      409,
      'REVISION_EXHAUSTED',
      'This draft cannot accept more revisions.',
    );
  let ballotId: string;
  if (existing) {
    ballotId = existing.id;
    await client.query(
      'UPDATE ballots SET revision=revision+1,updated_at=statement_timestamp() WHERE id=$1',
      [ballotId],
    );
    // Only replace entries of this owner's editable draft; submitted history is untouched.
    await client.query(
      'DELETE FROM ballot_entries WHERE event_id=$1 AND voting_id=$2 AND ballot_id=$3',
      [eventId, step.id, ballotId],
    );
  } else {
    ballotId = (
      await client.query(
        'INSERT INTO ballots(event_id,voting_id,juror_id,revision) VALUES ($1,$2,$3,1) RETURNING id',
        [eventId, step.id, jurorId],
      )
    ).rows[0].id;
  }
  if (input.entries.length)
    await client.query(
      `INSERT INTO ballot_entries(event_id,voting_id,ballot_id,voting_item_id,vote_value)
       SELECT $1,$2,$3,e."votingItemId",e."voteValue" FROM jsonb_to_recordset($4::jsonb)
       AS e("votingItemId" uuid,"voteValue" smallint)`,
      [eventId, step.id, ballotId, JSON.stringify(input.entries)],
    );
  return (await readBallots(client, eventId, jurorId, [step])).get(step.id)!;
}
