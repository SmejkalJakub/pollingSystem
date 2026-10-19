import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  votingSetupSnapshotSchema,
  votingDraftInputSchema,
  votingConfigurationSchema,
  votingItemInputSchema,
  type VotingSetupInput,
  type VotingSetupSnapshot,
  type VotingSetupValues,
} from '@d21/contracts';
import { AppError } from '../../errors';
import { adminEventLock } from '../auth/admin-transaction';
import type { AuthService } from '../auth/service';

const conflict = () =>
  new AppError(
    409,
    'VOTING_SETUP_CONFLICT',
    'Category setup changed. Review current data before saving.',
  );
const emptyConfiguration = {
  selectedPlaces: null,
  maxPlusVotes: null,
  maxMinusVotes: null,
  allowNegativeVotes: null,
};
function configuration(voting: VotingSetupSnapshot['voting']) {
  if (!voting) return emptyConfiguration;
  const { selectedPlaces, maxPlusVotes, maxMinusVotes, allowNegativeVotes } =
    voting;
  return { selectedPlaces, maxPlusVotes, maxMinusVotes, allowNegativeVotes };
}
function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function snapshot(client: PoolClient, eventId: string, votingId: string) {
  // Raw JSON text preserves sub-millisecond database timestamps and legacy snapshots.
  const raw = async (query: string, parameters: string[]) =>
    (await client.query(query, parameters)).rows.map((row) =>
      JSON.parse(row.value as string),
    );
  const votingRows = await raw(
    'SELECT row_to_json(v)::text AS value FROM votings v WHERE event_id=$1 AND id=$2',
    [eventId, votingId],
  );
  const groups = await raw(
    'SELECT row_to_json(g)::text AS value FROM jury_groups g WHERE event_id=$1 ORDER BY code,id',
    [eventId],
  );
  const teams = await raw(
    'SELECT row_to_json(t)::text AS value FROM teams t WHERE event_id=$1 ORDER BY created_at,id',
    [eventId],
  );
  const allowed = await raw(
    'SELECT row_to_json(a)::text AS value FROM voting_allowed_groups a WHERE event_id=$1 AND voting_id=$2 ORDER BY jury_group_id',
    [eventId, votingId],
  );
  const items = await raw(
    'SELECT row_to_json(i)::text AS value FROM voting_items i WHERE event_id=$1 AND voting_id=$2 ORDER BY display_order,id',
    [eventId, votingId],
  );
  const ballots =
    (
      await client.query(
        'SELECT 1 FROM ballots WHERE event_id=$1 AND voting_id=$2 LIMIT 1',
        [eventId, votingId],
      )
    ).rowCount !== 0;
  const record = votingRows[0];
  const version = createHash('sha256')
    .update(
      JSON.stringify([
        eventId,
        votingId,
        votingRows,
        groups,
        teams,
        allowed,
        items,
        ballots,
      ]),
    )
    .digest('hex');
  return votingSetupSnapshotSchema.parse({
    version,
    voting: record
      ? {
          id: record.id,
          eventId: record.event_id,
          name: record.name,
          instructions: record.instructions,
          kind: record.kind,
          status: record.status,
          selectedPlaces: record.selected_places,
          maxPlusVotes: record.max_plus_votes,
          maxMinusVotes: record.max_minus_votes,
          allowNegativeVotes: record.allow_negative_votes,
          createdAt: new Date(record.created_at).toISOString(),
          updatedAt: new Date(record.updated_at).toISOString(),
        }
      : null,
    editable: (!record || record.status === 'draft') && !ballots,
    groups: groups.map((group) => ({
      id: group.id,
      eventId: group.event_id,
      code: group.code,
      name: group.name,
    })),
    teams: teams.map((team) => ({
      id: team.id,
      eventId: team.event_id,
      name: team.name,
      description: team.description,
      createdAt: new Date(team.created_at).toISOString(),
      updatedAt: new Date(team.updated_at).toISOString(),
    })),
    juryGroupIds: allowed.map((group) => group.jury_group_id),
    items: items.map((item) => {
      const team = teams.find((candidate) => candidate.id === item.team_id);
      return {
        id: item.id,
        eventId: item.event_id,
        votingId: item.voting_id,
        teamId: item.team_id,
        name: team?.name ?? item.name,
        description: team?.description ?? item.description,
        displayOrder: item.display_order,
      };
    }),
  });
}
function desiredEquals(
  current: VotingSetupSnapshot,
  values: VotingSetupValues,
) {
  return (
    current.voting &&
    current.voting.name === values.name &&
    current.voting.instructions === values.instructions &&
    current.voting.kind === values.kind &&
    same(configuration(current.voting), values.configuration) &&
    same([...current.juryGroupIds].sort(), [...values.juryGroupIds].sort()) &&
    current.items.length === values.items.length &&
    values.items.every((item) => {
      const stored = current.items.find((entry) => entry.id === item.id);
      return (
        stored &&
        stored.teamId === item.teamId &&
        stored.displayOrder === item.displayOrder
      );
    })
  );
}
export function createVotingSetupService(
  pool: Pool,
  auth: AuthService,
  token: string | undefined,
) {
  const withLock = adminEventLock(pool, auth, token);
  return {
    read(eventId: string, votingId: string) {
      return withLock(
        eventId,
        (client) => snapshot(client, eventId, votingId),
        true,
      );
    },
    save(eventId: string, votingId: string, input: VotingSetupInput) {
      return withLock(eventId, async (client) => {
        const current = await snapshot(client, eventId, votingId);
        const values = {
          ...input.values,
          name: input.values.name.trim(),
          instructions: input.values.instructions.trim(),
        };
        const issues: { field: string }[] = [];
        const metadata = votingDraftInputSchema.safeParse({
          name: values.name,
          instructions: values.instructions,
          kind: values.kind,
        });
        if (!metadata.success)
          for (const issue of metadata.error.issues)
            issues.push({ field: String(issue.path[0]) });
        // Legacy partial tuples may be retained unchanged, but never created or cleared.
        if (!same(values.configuration, configuration(current.voting))) {
          const parsed = votingConfigurationSchema.safeParse(
            values.configuration,
          );
          if (!parsed.success)
            for (const issue of parsed.error.issues)
              issues.push({ field: `configuration.${String(issue.path[0])}` });
        }
        if (
          values.juryGroupIds.some(
            (id) => !current.groups.some((group) => group.id === id),
          )
        )
          issues.push({ field: 'juryGroupIds' });
        const assigned = new Set<string>();
        values.items.forEach((item, index) => {
          const stored = current.items.find((entry) => entry.id === item.id);
          // Unlinked legacy entries can stay as they are until explicitly linked.
          if (!(item.teamId === null && stored?.teamId === null)) {
            if (
              !item.teamId ||
              !current.teams.some((team) => team.id === item.teamId) ||
              assigned.has(item.teamId)
            )
              issues.push({ field: `items.${index}.teamId` });
            if (item.teamId) assigned.add(item.teamId);
          }
          if (
            !votingItemInputSchema.shape.displayOrder.safeParse(
              item.displayOrder,
            ).success
          )
            issues.push({ field: `items.${index}.displayOrder` });
        });
        if (issues.length) return { status: 'invalid' as const, issues };
        // Confirm an already committed desired state even if activation followed it.
        if (desiredEquals(current, values))
          return { status: 'saved' as const, snapshot: current };
        if (current.version !== input.baseVersion) throw conflict();
        if (!current.editable)
          throw new AppError(
            409,
            'VOTING_NOT_EDITABLE',
            'Category configuration is frozen.',
          );
        if (
          current.items.some(
            (item) => !values.items.some((entry) => entry.id === item.id),
          )
        )
          throw conflict();
        if (!current.voting) {
          const added = await client.query(
            'INSERT INTO votings(id,event_id,name,instructions,kind) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING id',
            [votingId, eventId, values.name, values.instructions, values.kind],
          );
          if (!added.rowCount) throw conflict();
        }
        const config = values.configuration;
        await client.query(
          'UPDATE votings SET name=$3,instructions=$4,kind=$5,selected_places=$6,max_plus_votes=$7,max_minus_votes=$8,allow_negative_votes=$9,updated_at=statement_timestamp() WHERE event_id=$1 AND id=$2',
          [
            eventId,
            votingId,
            values.name,
            values.instructions,
            values.kind,
            config.selectedPlaces,
            config.maxPlusVotes,
            config.maxMinusVotes,
            config.allowNegativeVotes,
          ],
        );
        if (
          !same(
            [...current.juryGroupIds].sort(),
            [...values.juryGroupIds].sort(),
          )
        ) {
          await client.query(
            'DELETE FROM voting_allowed_groups WHERE event_id=$1 AND voting_id=$2',
            [eventId, votingId],
          );
          await client.query(
            'INSERT INTO voting_allowed_groups(event_id,voting_id,jury_group_id) SELECT $1::uuid,$2::uuid,unnest($3::uuid[])',
            [eventId, votingId, values.juryGroupIds],
          );
        }
        // Temporarily unlink only reassignments so team swaps obey the immediate unique constraint.
        // IDs, stored descriptions and history references stay intact, in this transaction.
        const changed = current.items.filter(
          (item) =>
            values.items.find((entry) => entry.id === item.id)?.teamId !==
            item.teamId,
        );
        if (changed.length)
          await client.query(
            'UPDATE voting_items SET team_id=NULL WHERE event_id=$1 AND voting_id=$2 AND id=ANY($3::uuid[])',
            [eventId, votingId, changed.map((item) => item.id)],
          );
        for (const item of values.items) {
          const stored = current.items.find((entry) => entry.id === item.id);
          const team = current.teams.find((entry) => entry.id === item.teamId);
          if (stored) {
            if (stored.teamId !== item.teamId)
              await client.query(
                'UPDATE voting_items SET team_id=$4,name=$5,description=$6,display_order=$7 WHERE event_id=$1 AND voting_id=$2 AND id=$3',
                [
                  eventId,
                  votingId,
                  item.id,
                  item.teamId,
                  team!.name,
                  team!.description,
                  item.displayOrder,
                ],
              );
            else if (stored.displayOrder !== item.displayOrder)
              await client.query(
                'UPDATE voting_items SET display_order=$4 WHERE event_id=$1 AND voting_id=$2 AND id=$3',
                [eventId, votingId, item.id, item.displayOrder],
              );
          } else {
            const added = await client.query(
              'INSERT INTO voting_items(id,event_id,voting_id,team_id,name,description,display_order) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING RETURNING id',
              [
                item.id,
                eventId,
                votingId,
                item.teamId,
                team!.name,
                team!.description,
                item.displayOrder,
              ],
            );
            if (!added.rowCount) throw conflict();
          }
        }
        return {
          status: 'saved' as const,
          snapshot: await snapshot(client, eventId, votingId),
        };
      });
    },
  };
}
