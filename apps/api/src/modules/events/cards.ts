import { votingConfigurationSchema, type VotingStatus } from '@d21/contracts';
import type { PoolClient } from 'pg';

type CategoryCounts = {
  status: VotingStatus;
  configuration: unknown;
  items: number;
  unlinked: number;
  groups: number;
  ballots: number;
  expected: number;
  submitted: number;
};

type EventRow = Record<string, unknown> & {
  jurors: number;
  teams: number;
  categories: CategoryCounts[];
};

function ready(category: CategoryCounts) {
  if (category.status !== 'draft') {
    return true;
  }
  const rules = votingConfigurationSchema.safeParse(category.configuration);
  return (
    rules.success &&
    category.ballots === 0 &&
    category.groups > 0 &&
    category.unlinked === 0 &&
    rules.data.selectedPlaces < category.items &&
    rules.data.maxPlusVotes + rules.data.maxMinusVotes < category.items
  );
}

export async function readEventCards(client: PoolClient) {
  // One statement gives the list, readiness and participation a shared snapshot.
  // Participation uses current eligible assignments and current ballot statuses.
  const { rows } = await client.query<EventRow>(`
    WITH category_counts AS (
      SELECT v.event_id, v.status,
        json_build_object(
          'selectedPlaces', v.selected_places,
          'maxPlusVotes', v.max_plus_votes,
          'maxMinusVotes', v.max_minus_votes,
          'allowNegativeVotes', v.allow_negative_votes
        ) AS configuration,
        items.total AS items, items.unlinked, allowed.total AS groups,
        history.total AS ballots, participation.expected, participation.submitted
      FROM votings v
      CROSS JOIN LATERAL (
        SELECT count(*) AS total, count(*) FILTER (WHERE team_id IS NULL) AS unlinked
        FROM voting_items WHERE event_id = v.event_id AND voting_id = v.id
      ) items
      CROSS JOIN LATERAL (
        SELECT count(*) AS total FROM voting_allowed_groups
        WHERE event_id = v.event_id AND voting_id = v.id
      ) allowed
      CROSS JOIN LATERAL (
        SELECT count(*) AS total FROM ballots WHERE voting_id = v.id AND v.status = 'draft'
      ) history
      CROSS JOIN LATERAL (
        SELECT count(*) AS expected, count(*) FILTER (WHERE b.status = 'submitted') AS submitted
        FROM voting_allowed_groups g
        JOIN event_jurors j ON j.event_id = g.event_id AND j.jury_group_id = g.jury_group_id
        LEFT JOIN ballots b ON b.voting_id = v.id AND b.juror_id = j.id
        WHERE g.event_id = v.event_id AND g.voting_id = v.id AND v.status <> 'draft'
      ) participation
    ), category_lists AS (
      SELECT event_id, json_agg(category_counts) AS categories
      FROM category_counts GROUP BY event_id
    )
    SELECT e.id, e.name, e.description, e.created_at AS "createdAt", e.updated_at AS "updatedAt",
      (SELECT count(*)::int FROM event_jurors WHERE event_id = e.id) AS jurors,
      (SELECT count(*)::int FROM teams WHERE event_id = e.id) AS teams,
      coalesce(c.categories, '[]') AS categories
    FROM events e LEFT JOIN category_lists c ON c.event_id = e.id
    ORDER BY e.created_at DESC, e.id
  `);
  return rows.map((row) => {
    const { categories, jurors, teams } = row;
    const openCategories = categories.filter(
      ({ status }) => status === 'active',
    ).length;
    const closed =
      categories.length > 0 &&
      categories.every(
        ({ status }) => status === 'closed' || status === 'archived',
      );
    let status = 'preparation';
    if (openCategories > 0) {
      status = 'voting';
    } else if (closed) {
      status = 'closed';
    }
    return {
      ...row,
      summary: {
        status,
        jurors,
        teams,
        categories: categories.length,
        openCategories,
        readyCategories: categories.filter(ready).length,
        submitted: categories.reduce(
          (sum, category) => sum + category.submitted,
          0,
        ),
        expected: categories.reduce(
          (sum, category) => sum + category.expected,
          0,
        ),
      },
    };
  });
}
