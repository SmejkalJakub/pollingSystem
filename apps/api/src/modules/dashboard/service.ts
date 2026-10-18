import { adminEventLock } from '../auth/admin-transaction';
import type { Pool, PoolClient } from 'pg';
import {
  dashboardOverviewSchema,
  dashboardDetailSchema,
  eventSchema,
  juryGroupListSchema,
  type DashboardCategory,
  type DashboardCounts,
  type DashboardProblem,
  type BallotEntry,
} from '@d21/contracts';
import { validateBallot, type VotingContext } from '@d21/voting-domain';
import type { AuthService } from '../auth/service';
import { notFound } from '../events/locking';

type CategoryRow = VotingContext & {
  id: string;
  eventId: string;
  name: string;
  kind: 'selection' | 'final';
  status: 'draft' | 'active' | 'closed' | 'archived';
};
type BallotRow = {
  voting_id: string;
  juror_id: string;
  status: string;
  updated_at: Date;
  submitted_at: Date | null;
  entries: BallotEntry[];
};
const emptyCounts = (): DashboardCounts => ({
  expected: 0,
  submitted: 0,
  pending: 0,
  invalid: 0,
  locked: 0,
});
function counts(jurors: DashboardCategory['jurors']): DashboardCounts {
  const submitted = jurors.filter((j) => j.progress === 'submitted').length;
  return {
    expected: jurors.length,
    submitted,
    pending: jurors.length - submitted,
    invalid: jurors.filter((j) => j.progress === 'invalid_draft').length,
    locked: jurors.filter((j) => j.progress === 'locked').length,
  };
}

// The shared event lock gives one snapshot across all app-owned writes. Queries
// are batched by event; never fetch per-juror ballots or aggregate audit history.
// Caller must hold the parent-event lock and authorize the administrative read.
export async function readDashboardSnapshot(
  client: PoolClient,
  eventId: string,
) {
  const event = (
    await client.query('SELECT * FROM events WHERE id=$1', [eventId])
  ).rows[0];
  if (!event) throw notFound();
  const groups = juryGroupListSchema.parse(
    (
      await client.query(
        'SELECT id,event_id AS "eventId",code,name FROM jury_groups WHERE event_id=$1 ORDER BY code,id',
        [eventId],
      )
    ).rows,
  );
  const jurors = (
    await client.query<{
      id: string;
      display_name: string;
      jury_group_id: string;
    }>(
      'SELECT id,display_name,jury_group_id FROM event_jurors WHERE event_id=$1 ORDER BY display_name,id',
      [eventId],
    )
  ).rows;
  const votings = (
    await client.query<CategoryRow>(
      `SELECT id,event_id AS "eventId",name,kind,status,selected_places AS "selectedPlaces",
     max_plus_votes AS "maxPlusVotes",max_minus_votes AS "maxMinusVotes",allow_negative_votes AS "allowNegativeVotes"
     FROM votings WHERE event_id=$1 ORDER BY CASE WHEN kind='selection' THEN 0 ELSE 1 END,created_at,id`,
      [eventId],
    )
  ).rows;
  const allowed = (
    await client.query<{ voting_id: string; jury_group_id: string }>(
      'SELECT voting_id,jury_group_id FROM voting_allowed_groups WHERE event_id=$1',
      [eventId],
    )
  ).rows;
  const items = (
    await client.query<{
      id: string;
      voting_id: string;
      team_id: string | null;
    }>('SELECT id,voting_id,team_id FROM voting_items WHERE event_id=$1', [
      eventId,
    ])
  ).rows;
  const ballots = (
    await client.query<BallotRow>(
      `SELECT b.voting_id,b.juror_id,b.status,b.updated_at,b.submitted_at,
     coalesce(json_agg(json_build_object('votingItemId',e.voting_item_id,'voteValue',e.vote_value))
       FILTER (WHERE e.voting_item_id IS NOT NULL),'[]') AS entries
     FROM ballots b LEFT JOIN ballot_entries e ON e.event_id=b.event_id AND e.voting_id=b.voting_id AND e.ballot_id=b.id
     WHERE b.event_id=$1 GROUP BY b.id`,
      [eventId],
    )
  ).rows;
  const categories = votings.map((v) => {
    const categoryGroups = groups.filter((g) =>
      allowed.some((a) => a.voting_id === v.id && a.jury_group_id === g.id),
    );
    const eligible = jurors.filter((j) =>
      categoryGroups.some((g) => g.id === j.jury_group_id),
    );
    const categoryItems = items.filter((i) => i.voting_id === v.id);
    const itemIds = categoryItems.map((i) => i.id);
    const currentBallots = ballots.filter((b) => b.voting_id === v.id);
    const byJuror = new Map(currentBallots.map((b) => [b.juror_id, b]));
    // Availability is separate from saved-choice validity, as in the wizard.
    const rules = { ...v, status: 'active' };
    const rows: DashboardCategory['jurors'] = eligible.map((j) => {
      const ballot = byJuror.get(j.id);
      const progress = !ballot
        ? 'not_started'
        : ballot.status === 'submitted'
          ? 'submitted'
          : ballot.status !== 'draft'
            ? 'locked'
            : validateBallot(rules, itemIds, ballot.entries).valid
              ? 'in_progress'
              : 'invalid_draft';
      return {
        id: j.id,
        displayName: j.display_name,
        groupId: j.jury_group_id,
        progress,
        savedAt: ballot?.updated_at.toISOString() ?? null,
        submittedAt: ballot?.submitted_at?.toISOString() ?? null,
      };
    });
    const totals = counts(rows);
    const problems: DashboardProblem[] = [];
    if (!validateBallot(rules, itemIds, []).valid)
      problems.push('CONFIGURATION_NOT_READY');
    if (categoryItems.some((i) => !i.team_id)) problems.push('UNLINKED_ITEMS');
    if (!rows.length) problems.push('NO_ELIGIBLE_JURORS');
    if (totals.invalid) problems.push('INVALID_DRAFT');
    if (totals.locked) problems.push('LOCKED_BALLOT');
    if ((v.status === 'closed' || v.status === 'archived') && totals.pending)
      problems.push('UNAVAILABLE_PENDING');
    if (currentBallots.some((b) => !eligible.some((j) => j.id === b.juror_id)))
      problems.push('INELIGIBLE_BALLOTS');
    if (
      currentBallots.some(
        (b) =>
          b.status === 'submitted' &&
          eligible.some((j) => j.id === b.juror_id) &&
          !validateBallot(rules, itemIds, b.entries).valid,
      )
    )
      problems.push('INVALID_SUBMISSION');
    // Drafts are setup, never operational completion or pending assignments.
    const state = problems.length
      ? 'problem'
      : v.status === 'draft'
        ? 'ready'
        : totals.expected > 0 && totals.pending === 0
          ? 'done'
          : 'in_progress';
    return {
      id: v.id,
      eventId,
      name: v.name,
      kind: v.kind,
      status: v.status,
      state,
      groups: categoryGroups,
      counts: totals,
      problems,
      jurors: rows,
      groupCounts: categoryGroups.map((g) => ({
        groupId: g.id,
        counts: counts(rows.filter((j) => j.groupId === g.id)),
      })),
    } satisfies DashboardCategory;
  });
  const operational = categories.filter((c) => c.status !== 'draft');
  const totals = operational.reduce((sum, c) => {
    for (const key of Object.keys(sum) as (keyof DashboardCounts)[])
      sum[key] += c.counts[key];
    return sum;
  }, emptyCounts());
  return dashboardOverviewSchema.parse({
    event: eventSchema.parse({
      id: event.id,
      name: event.name,
      description: event.description,
      createdAt: event.created_at.toISOString(),
      updatedAt: event.updated_at.toISOString(),
    }),
    asOf: (
      await client.query('SELECT statement_timestamp() AS time')
    ).rows[0].time.toISOString(),
    categories,
    totals: {
      ...totals,
      categories: operational.length,
      completedCategories: operational.filter((c) => c.state === 'done').length,
      problemCategories: operational.filter((c) => c.problems.length).length,
      pendingJurors: new Set(
        operational.flatMap((c) =>
          c.jurors.filter((j) => j.progress !== 'submitted').map((j) => j.id),
        ),
      ).size,
    },
  });
}
export function createDashboardService(pool: Pool, auth: AuthService) {
  async function run(token: string | undefined, eventId: string) {
    return adminEventLock(pool, auth, token)(
      eventId,
      (client) => readDashboardSnapshot(client, eventId),
      true,
    );
  }
  return {
    overview: run,
    async category(token: string | undefined, votingId: string) {
      const row = (
        await pool.query<{ event_id: string }>(
          'SELECT event_id FROM votings WHERE id=$1',
          [votingId],
        )
      ).rows[0];
      if (!row) throw notFound();
      const data = await run(token, row.event_id);
      const category = data.categories.find((c) => c.id === votingId);
      if (!category) throw notFound();
      return dashboardDetailSchema.parse({
        event: data.event,
        asOf: data.asOf,
        category,
      });
    },
  };
}
export type DashboardService = ReturnType<typeof createDashboardService>;
