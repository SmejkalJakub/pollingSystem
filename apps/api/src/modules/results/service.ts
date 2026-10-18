import type { Pool, PoolClient } from 'pg';
import {
  resultsOverviewSchema,
  resultsDetailSchema,
  type ResultsCategory,
  type ResultsReason,
  type DashboardOverview,
} from '@d21/contracts';
import { rankResults } from '@d21/voting-domain';
import type { AuthService } from '../auth/service';
import { notFound } from '../events/locking';
import { createResultsWorkbook } from './workbook';
import { adminEventLock, adminTransaction } from '../auth/admin-transaction';
import { readDashboardSnapshot } from '../dashboard/service';

async function snapshot(
  client: PoolClient,
  eventId: string,
  dashboard?: DashboardOverview,
) {
  // Reuse eligibility, current participation and factual validity from the same
  // event-locked projection; juror identities never leave the results boundary.
  const projection =
    dashboard ?? (await readDashboardSnapshot(client, eventId));
  const configurations = (
    await client.query<{ id: string; places: number | null }>(
      'SELECT id,selected_places AS places FROM votings WHERE event_id=$1',
      [eventId],
    )
  ).rows;
  const items = (
    await client.query<{
      id: string;
      votingId: string;
      teamId: string | null;
      name: string;
      description: string;
      displayOrder: number;
      plus: number;
      minus: number;
    }>(
      `WITH totals AS (
        SELECT e.voting_item_id,
          count(*) FILTER (WHERE e.vote_value=1)::int AS plus,
          count(*) FILTER (WHERE e.vote_value=-1)::int AS minus
        FROM ballots b
        JOIN event_jurors j ON j.event_id=b.event_id AND j.id=b.juror_id
        JOIN ballot_entries e ON e.event_id=b.event_id AND e.voting_id=b.voting_id AND e.ballot_id=b.id
        WHERE b.event_id=$1 AND b.status='submitted'
          AND EXISTS (SELECT 1 FROM voting_allowed_groups a
            WHERE a.event_id=b.event_id AND a.voting_id=b.voting_id AND a.jury_group_id=j.jury_group_id)
        GROUP BY e.voting_item_id
      )
      SELECT i.id,i.voting_id AS "votingId",i.team_id AS "teamId",
        coalesce(t.name,i.name) AS name,coalesce(t.description,i.description) AS description,
        i.display_order AS "displayOrder",coalesce(n.plus,0) AS plus,coalesce(n.minus,0) AS minus
      FROM voting_items i
      LEFT JOIN teams t ON t.event_id=i.event_id AND t.id=i.team_id
      LEFT JOIN totals n ON n.voting_item_id=i.id
      WHERE i.event_id=$1`,
      [eventId],
    )
  ).rows;
  const categories = projection.categories.map((c): ResultsCategory => {
    const selectedPlaces = configurations.find((v) => v.id === c.id)!.places;
    const { rows, boundaryTie } = rankResults(
      items
        .filter((i) => i.votingId === c.id)
        .map((i) => ({
          id: i.id,
          teamId: i.teamId,
          name: i.name,
          description: i.description,
          displayOrder: i.displayOrder,
          plus: i.plus,
          minus: i.minus,
        })),
      // Unready configuration cannot establish an authoritative cutoff.
      c.problems.includes('CONFIGURATION_NOT_READY') ? null : selectedPlaces,
    );
    const reasons: ResultsReason[] = [];
    if (c.status !== 'closed' && c.status !== 'archived')
      reasons.push('NOT_CLOSED');
    if (c.counts.pending) reasons.push('PENDING_BALLOTS');
    if (c.problems.length) reasons.push('DATA_PROBLEMS');
    if (boundaryTie) reasons.push('CUTOFF_TIE');
    return {
      id: c.id,
      eventId,
      name: c.name,
      kind: c.kind,
      status: c.status,
      selectedPlaces,
      groups: c.groups,
      counts: c.counts,
      problems: c.problems,
      stage: reasons.length ? 'provisional' : 'final',
      reasons,
      boundaryTie,
      rows,
    };
  });
  return resultsOverviewSchema.parse({
    event: projection.event,
    asOf: (
      await client.query('SELECT statement_timestamp() AS time')
    ).rows[0].time.toISOString(),
    categories,
  });
}

export function createResultsService(pool: Pool, auth: AuthService) {
  async function run(token: string | undefined, eventId: string) {
    return adminEventLock(pool, auth, token)(
      eventId,
      (client) => snapshot(client, eventId),
      true,
    );
  }
  return {
    overview: run,
    async exportWorkbook(token: string | undefined, eventId: string) {
      const data = await adminEventLock(pool, auth, token)(
        eventId,
        async (client) => {
          const participation = await readDashboardSnapshot(client, eventId);
          const results = await snapshot(client, eventId, participation);
          return { results, participation };
        },
        true,
      );
      // Release the event lock before ZIP generation; all sheets share this snapshot.
      const buffer = await createResultsWorkbook(
        data.results,
        data.participation,
      );
      await adminTransaction(pool, auth, token, async () => {});
      return buffer;
    },
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
      return resultsDetailSchema.parse({
        event: data.event,
        asOf: data.asOf,
        category,
      });
    },
  };
}
export type ResultsService = ReturnType<typeof createResultsService>;
