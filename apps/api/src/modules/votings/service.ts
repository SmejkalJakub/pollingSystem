import type { AuthService } from '../auth/service';
import { adminEventLock } from '../auth/admin-transaction';
import type { Pool, PoolClient } from 'pg';
import {
  votingListSchema,
  votingRecordSchema,
  juryGroupListSchema,
  votingItemListSchema,
  votingItemRecordSchema,
  votingConfigurationSchema,
  type VotingConfiguration,
  type VotingDraftInput,
  type VotingDraftPatch,
  type VotingGroupsInput,
  type VotingItemInput,
  type VotingItemPatch,
} from '@d21/contracts';
import { AppError } from '../../errors';
import { notFound } from '../events/locking';
import { createTeamService } from '../teams/service';
import { requireReadyRoster } from './readiness';
import { auditAdminAction } from '../events/audit';

const columns = `id, event_id AS "eventId", name, instructions, kind, status,
  selected_places AS "selectedPlaces", max_plus_votes AS "maxPlusVotes",
  max_minus_votes AS "maxMinusVotes", allow_negative_votes AS "allowNegativeVotes",
  created_at AS "createdAt", updated_at AS "updatedAt"`;
function serialize(row: Record<string, unknown>) {
  return votingRecordSchema.parse({
    ...row,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  });
}

export function createVotingService(pool: Pool, auth: AuthService) {
  return (token: string | undefined) => {
    const withLock = adminEventLock(pool, auth, token);
    async function eventForVoting(votingId: string) {
      const found = await pool.query(
        'SELECT event_id FROM votings WHERE id = $1',
        [votingId],
      );
      if (!found.rows[0]) throw notFound();
      return found.rows[0].event_id as string;
    }
    async function withVotingLock<T>(
      votingId: string,
      action: (
        client: PoolClient,
        eventId: string,
        status: string,
      ) => Promise<T>,
    ) {
      const eventId = await eventForVoting(votingId);
      // Parent first, just as future activation and all roster operations require.
      return withLock(eventId, async (client, _locked, adminId) => {
        const current = await client.query(
          'SELECT status FROM votings WHERE id = $1 AND event_id = $2 FOR UPDATE',
          [votingId, eventId],
        );
        if (!current.rows[0]) throw notFound();
        const before = current.rows[0].status as string;
        const result = await action(client, eventId, before);
        const after = (
          await client.query('SELECT status FROM votings WHERE id=$1', [
            votingId,
          ])
        ).rows[0].status as string;
        if (after !== before) {
          const actionName =
            after === 'closed'
              ? 'voting.closed'
              : before === 'draft'
                ? 'voting.activated'
                : 'voting.reopened';
          await auditAdminAction(
            client,
            eventId,
            adminId,
            actionName,
            'voting',
            votingId,
            { from: before, to: after },
          );
        }
        return result;
      });
    }
    async function editDraft<T>(
      votingId: string,
      action: (client: PoolClient, eventId: string) => Promise<T>,
    ) {
      return withVotingLock(votingId, async (client, eventId, status) => {
        const ballots = await client.query(
          'SELECT 1 FROM ballots WHERE voting_id = $1 LIMIT 1',
          [votingId],
        );
        if (status !== 'draft' || ballots.rowCount !== 0)
          throw new AppError(
            409,
            'VOTING_NOT_EDITABLE',
            'Only drafts without ballot history can be edited.',
          );
        return action(client, eventId);
      });
    }
    async function readGroups(client: PoolClient, votingId: string) {
      const result = await client.query(
        `SELECT g.id, g.event_id AS "eventId", g.code, g.name FROM voting_allowed_groups a
       JOIN jury_groups g ON g.event_id = a.event_id AND g.id = a.jury_group_id
       WHERE a.voting_id = $1 ORDER BY g.code`,
        [votingId],
      );
      return juryGroupListSchema.parse(result.rows);
    }
    async function readItems(client: PoolClient, votingId: string) {
      const result = await client.query(
        `SELECT i.id,i.event_id AS "eventId",i.voting_id AS "votingId",i.team_id AS "teamId",
       coalesce(t.name,i.name) AS name,coalesce(t.description,i.description) AS description,i.display_order AS "displayOrder"
       FROM voting_items i LEFT JOIN teams t ON t.id=i.team_id AND t.event_id=i.event_id
       WHERE i.voting_id=$1 ORDER BY i.display_order,i.id`,
        [votingId],
      );
      return votingItemListSchema.parse(result.rows);
    }
    async function requireTeam(
      client: PoolClient,
      eventId: string,
      votingId: string,
      teamId: string,
      itemId?: string,
    ) {
      const found = await client.query(
        'SELECT name,description FROM teams WHERE event_id=$1 AND id=$2',
        [eventId, teamId],
      );
      if (!found.rows[0])
        throw new AppError(
          400,
          'INVALID_TEAM',
          'Choose a team from this event.',
        );
      const duplicate = await client.query(
        'SELECT 1 FROM voting_items WHERE voting_id=$1 AND team_id=$2 AND ($3::uuid IS NULL OR id<>$3)',
        [votingId, teamId, itemId ?? null],
      );
      if (duplicate.rowCount)
        throw new AppError(
          409,
          'ITEM_EXISTS',
          'This team is already included in this voting.',
        );
      return found.rows[0] as { name: string; description: string };
    }
    return {
      teams: createTeamService(pool, auth, token),
      async configure(votingId: string, input: VotingConfiguration) {
        return editDraft(votingId, async (client) => {
          const result = await client.query(
            `UPDATE votings SET selected_places=$2,max_plus_votes=$3,max_minus_votes=$4,
           allow_negative_votes=$5,updated_at=now() WHERE id=$1 RETURNING ${columns}`,
            [
              votingId,
              input.selectedPlaces,
              input.maxPlusVotes,
              input.maxMinusVotes,
              input.allowNegativeVotes,
            ],
          );
          return serialize(result.rows[0]);
        });
      },
      async activate(votingId: string) {
        return withVotingLock(votingId, async (client, eventId, status) => {
          if (status !== 'draft' && status !== 'active')
            throw new AppError(
              409,
              'INVALID_VOTING_STATUS',
              'Use reopening for previously closed voting.',
            );
          const result = await client.query(
            `SELECT ${columns} FROM votings WHERE id=$1`,
            [votingId],
          );
          const record = serialize(result.rows[0]);
          // A successful activation retry must never rewrite configuration/history.
          if (status === 'active') return record;
          const ballots = await client.query(
            'SELECT 1 FROM ballots WHERE voting_id=$1 LIMIT 1',
            [votingId],
          );
          if (ballots.rowCount)
            throw new AppError(
              409,
              'VOTING_NOT_EDITABLE',
              'Draft voting has ballot history.',
            );
          const configuration = votingConfigurationSchema.safeParse({
            selectedPlaces: record.selectedPlaces,
            maxPlusVotes: record.maxPlusVotes,
            maxMinusVotes: record.maxMinusVotes,
            allowNegativeVotes: record.allowNegativeVotes,
          });
          if (!configuration.success)
            throw new AppError(
              409,
              'CONFIGURATION_NOT_READY',
              'Complete valid voting limits before activation.',
            );
          const items = await readItems(client, votingId);
          if (
            items.some((item) => !item.teamId) ||
            configuration.data.selectedPlaces >= items.length ||
            configuration.data.maxPlusVotes +
              configuration.data.maxMinusVotes >=
              items.length
          )
            throw new AppError(
              409,
              'ITEMS_NOT_READY',
              'Link all entries to teams and ensure places and total vote limits are below the candidate count.',
            );
          if (!(await readGroups(client, votingId)).length)
            throw new AppError(
              409,
              'GROUPS_NOT_READY',
              'Choose at least one eligible jury group.',
            );
          await requireReadyRoster(client, eventId);
          const activated = await client.query(
            `UPDATE votings SET status='active',updated_at=now() WHERE id=$1 RETURNING ${columns}`,
            [votingId],
          );
          return serialize(activated.rows[0]);
        });
      },
      async reopen(votingId: string) {
        return withVotingLock(votingId, async (client, _eventId, status) => {
          // Reopening resumes history without readiness checks; drafts must still
          // pass first activation rather than using this action to bypass it.
          if (status === 'draft')
            throw new AppError(
              409,
              'INVALID_VOTING_STATUS',
              'Draft voting must pass first activation before it can be reopened.',
            );
          if (status !== 'active')
            await client.query(
              "UPDATE votings SET status='active',updated_at=now() WHERE id=$1",
              [votingId],
            );
          const result = await client.query(
            `SELECT ${columns} FROM votings WHERE id=$1`,
            [votingId],
          );
          return serialize(result.rows[0]);
        });
      },
      async close(votingId: string) {
        return withVotingLock(votingId, async (client, _eventId, status) => {
          if (status !== 'active' && status !== 'closed')
            throw new AppError(
              409,
              'INVALID_VOTING_STATUS',
              'Only active voting can be closed.',
            );
          if (status === 'active')
            await client.query(
              "UPDATE votings SET status='closed',updated_at=now() WHERE id=$1",
              [votingId],
            );
          const result = await client.query(
            `SELECT ${columns} FROM votings WHERE id=$1`,
            [votingId],
          );
          return serialize(result.rows[0]);
        });
      },
      async list(eventId: string) {
        return withLock(
          eventId,
          async (client) => {
            const result = await client.query(
              `SELECT ${columns} FROM votings WHERE event_id = $1 ORDER BY display_order, created_at, id`,
              [eventId],
            );
            return votingListSchema.parse(result.rows.map(serialize));
          },
          true,
        );
      },
      async create(eventId: string, input: VotingDraftInput) {
        return withLock(eventId, async (client) => {
          const result = await client.query(
            `INSERT INTO votings (event_id, name, instructions, kind)
           VALUES ($1, $2, $3, $4) RETURNING ${columns}`,
            [eventId, input.name, input.instructions, input.kind],
          );
          return serialize(result.rows[0]);
        });
      },
      async get(votingId: string) {
        const eventId = await eventForVoting(votingId);
        return withLock(
          eventId,
          async (client) => {
            const result = await client.query(
              `SELECT ${columns} FROM votings WHERE id = $1`,
              [votingId],
            );
            if (!result.rows[0]) throw notFound();
            return serialize(result.rows[0]);
          },
          true,
        );
      },
      async update(votingId: string, input: VotingDraftPatch) {
        return editDraft(votingId, async (client) => {
          const result = await client.query(
            `UPDATE votings SET name = coalesce($2, name), instructions = coalesce($3, instructions),
           kind = coalesce($4, kind), updated_at = now() WHERE id = $1 RETURNING ${columns}`,
            [votingId, input.name, input.instructions, input.kind],
          );
          return serialize(result.rows[0]);
        });
      },
      async groups(votingId: string) {
        const eventId = await eventForVoting(votingId);
        return withLock(
          eventId,
          (client) => readGroups(client, votingId),
          true,
        );
      },
      async setGroups(votingId: string, input: VotingGroupsInput) {
        return editDraft(votingId, async (client, eventId) => {
          const valid = await client.query(
            'SELECT id FROM jury_groups WHERE event_id = $1 AND id = ANY($2::uuid[])',
            [eventId, input.juryGroupIds],
          );
          if (valid.rowCount !== input.juryGroupIds.length)
            throw new AppError(
              400,
              'INVALID_GROUP',
              'Choose groups belonging to this event.',
            );
          await client.query(
            'DELETE FROM voting_allowed_groups WHERE voting_id = $1 AND event_id = $2',
            [votingId, eventId],
          );
          await client.query(
            'INSERT INTO voting_allowed_groups (event_id, voting_id, jury_group_id) SELECT $1::uuid, $2::uuid, unnest($3::uuid[])',
            [eventId, votingId, input.juryGroupIds],
          );
          await client.query(
            'UPDATE votings SET updated_at = now() WHERE id = $1',
            [votingId],
          );
          return readGroups(client, votingId);
        });
      },
      async items(votingId: string) {
        const eventId = await eventForVoting(votingId);
        return withLock(eventId, (client) => readItems(client, votingId), true);
      },
      async addItem(votingId: string, input: VotingItemInput) {
        return editDraft(votingId, async (client, eventId) => {
          const team = await requireTeam(
            client,
            eventId,
            votingId,
            input.teamId,
          );
          const inserted = await client.query(
            'INSERT INTO voting_items (event_id,voting_id,team_id,name,description,display_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
            [
              eventId,
              votingId,
              input.teamId,
              team.name,
              team.description,
              input.displayOrder,
            ],
          );
          await client.query(
            'UPDATE votings SET updated_at=now() WHERE id=$1',
            [votingId],
          );
          return votingItemRecordSchema.parse(
            (await readItems(client, votingId)).find(
              (item) => item.id === inserted.rows[0].id,
            ),
          );
        });
      },
      async updateItem(
        votingId: string,
        itemId: string,
        input: VotingItemPatch,
      ) {
        return editDraft(votingId, async (client, eventId) => {
          const old = await client.query(
            'SELECT team_id,display_order FROM voting_items WHERE event_id=$1 AND voting_id=$2 AND id=$3',
            [eventId, votingId, itemId],
          );
          if (!old.rows[0]) throw notFound();
          const teamId = input.teamId ?? old.rows[0].team_id;
          if (!teamId)
            throw new AppError(
              400,
              'INVALID_TEAM',
              'Link the legacy entry to an event team.',
            );
          const team = await requireTeam(
            client,
            eventId,
            votingId,
            teamId,
            itemId,
          );
          await client.query(
            'UPDATE voting_items SET team_id=$4,name=$5,description=$6,display_order=$7 WHERE event_id=$1 AND voting_id=$2 AND id=$3',
            [
              eventId,
              votingId,
              itemId,
              teamId,
              team.name,
              team.description,
              input.displayOrder ?? old.rows[0].display_order,
            ],
          );
          await client.query(
            'UPDATE votings SET updated_at=now() WHERE id=$1',
            [votingId],
          );
          return votingItemRecordSchema.parse(
            (await readItems(client, votingId)).find(
              (item) => item.id === itemId,
            ),
          );
        });
      },
    };
  };
}
export type VotingService = ReturnType<typeof createVotingService>;
