import { sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  smallint,
  unique,
  primaryKey,
  foreignKey,
  check,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { ballotStatuses, juryGroupCodes, votingStatuses } from '@d21/contracts';

export const votingStatus = pgEnum('voting_status', votingStatuses);
export const ballotStatus = pgEnum('ballot_status', ballotStatuses);
export const juryGroupCode = pgEnum('jury_group_code', juryGroupCodes);
export const votingKind = pgEnum('voting_kind', ['selection', 'final']);

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const events = pgTable('events', {
  id: id(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Display identities; administration authentication uses the shared admin_access record.
export const users = pgTable('users', {
  id: id(),
  displayName: text('display_name').notNull(),
  createdAt: createdAt(),
});

export const juryGroups = pgTable(
  'jury_groups',
  {
    id: id(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'restrict' }),
    code: juryGroupCode('code').notNull(),
    name: text('name').notNull(),
  },
  (table) => [
    unique('jury_groups_event_id_id_unique').on(table.eventId, table.id),
    unique('jury_groups_event_code_unique').on(table.eventId, table.code),
  ],
);

export const eventJurors = pgTable(
  'event_jurors',
  {
    id: id(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'restrict' }),
    juryGroupId: uuid('jury_group_id').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique('event_jurors_event_id_id_unique').on(table.eventId, table.id),
    foreignKey({
      name: 'event_jurors_same_event_group_fk',
      columns: [table.eventId, table.juryGroupId],
      foreignColumns: [juryGroups.eventId, juryGroups.id],
    }).onDelete('restrict'),
    index('event_jurors_group_idx').on(table.eventId, table.juryGroupId),
  ],
);

export const votings = pgTable(
  'votings',
  {
    id: id(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    instructions: text('instructions').notNull().default(''),
    kind: votingKind('kind').notNull(),
    status: votingStatus('status').notNull().default('draft'),
    // Drafts may be unconfigured. Activation must validate approved D21 rules later.
    selectedPlaces: integer('selected_places'),
    maxPlusVotes: integer('max_plus_votes'),
    maxMinusVotes: integer('max_minus_votes'),
    allowNegativeVotes: boolean('allow_negative_votes'),
    displayOrder: integer('display_order').notNull().default(0),
    deadline: timestamp('deadline', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique('votings_event_id_id_unique').on(table.eventId, table.id),
    check('votings_selected_places_positive', sql`${table.selectedPlaces} > 0`),
    check('votings_plus_limit_nonnegative', sql`${table.maxPlusVotes} >= 0`),
    check('votings_minus_limit_nonnegative', sql`${table.maxMinusVotes} >= 0`),
    check(
      'votings_disabled_minus_limit',
      sql`${table.allowNegativeVotes} IS DISTINCT FROM false OR ${table.maxMinusVotes} IS NULL OR ${table.maxMinusVotes} = 0`,
    ),
    index('votings_event_status_idx').on(table.eventId, table.status),
  ],
);

export const votingAllowedGroups = pgTable(
  'voting_allowed_groups',
  {
    eventId: uuid('event_id').notNull(),
    votingId: uuid('voting_id').notNull(),
    juryGroupId: uuid('jury_group_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.votingId, table.juryGroupId] }),
    foreignKey({
      name: 'voting_allowed_groups_same_event_voting_fk',
      columns: [table.eventId, table.votingId],
      foreignColumns: [votings.eventId, votings.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'voting_allowed_groups_same_event_group_fk',
      columns: [table.eventId, table.juryGroupId],
      foreignColumns: [juryGroups.eventId, juryGroups.id],
    }).onDelete('restrict'),
    index('voting_allowed_groups_group_idx').on(
      table.eventId,
      table.juryGroupId,
    ),
  ],
);

export const votingItems = pgTable(
  'voting_items',
  {
    id: id(),
    eventId: uuid('event_id').notNull(),
    votingId: uuid('voting_id').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (table) => [
    unique('voting_items_scope_unique').on(
      table.eventId,
      table.votingId,
      table.id,
    ),
    foreignKey({
      name: 'voting_items_same_event_voting_fk',
      columns: [table.eventId, table.votingId],
      foreignColumns: [votings.eventId, votings.id],
    }).onDelete('restrict'),
  ],
);

export const ballots = pgTable(
  'ballots',
  {
    id: id(),
    eventId: uuid('event_id').notNull(),
    votingId: uuid('voting_id').notNull(),
    jurorId: uuid('juror_id').notNull(),
    status: ballotStatus('status').notNull().default('draft'),
    revision: integer('revision').notNull().default(0),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique('ballots_voting_juror_unique').on(table.votingId, table.jurorId),
    unique('ballots_scope_unique').on(table.eventId, table.votingId, table.id),
    foreignKey({
      name: 'ballots_same_event_voting_fk',
      columns: [table.eventId, table.votingId],
      foreignColumns: [votings.eventId, votings.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'ballots_same_event_juror_fk',
      columns: [table.eventId, table.jurorId],
      foreignColumns: [eventJurors.eventId, eventJurors.id],
    }).onDelete('restrict'),
    check('ballots_revision_nonnegative', sql`${table.revision} >= 0`),
    check(
      'ballots_submission_timestamp',
      sql`(${table.status} != 'submitted' OR ${table.submittedAt} IS NOT NULL) AND (${table.status} != 'draft' OR ${table.submittedAt} IS NULL)`,
    ),
    index('ballots_voting_status_idx').on(table.votingId, table.status),
    index('ballots_juror_idx').on(table.eventId, table.jurorId),
  ],
);

export const ballotEntries = pgTable(
  'ballot_entries',
  {
    eventId: uuid('event_id').notNull(),
    votingId: uuid('voting_id').notNull(),
    ballotId: uuid('ballot_id').notNull(),
    votingItemId: uuid('voting_item_id').notNull(),
    voteValue: smallint('vote_value').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ballotId, table.votingItemId] }),
    foreignKey({
      name: 'ballot_entries_same_voting_ballot_fk',
      columns: [table.eventId, table.votingId, table.ballotId],
      foreignColumns: [ballots.eventId, ballots.votingId, ballots.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'ballot_entries_same_voting_item_fk',
      columns: [table.eventId, table.votingId, table.votingItemId],
      foreignColumns: [
        votingItems.eventId,
        votingItems.votingId,
        votingItems.id,
      ],
    }).onDelete('restrict'),
    check('ballot_entries_vote_value', sql`${table.voteValue} IN (-1, 1)`),
    index('ballot_entries_item_idx').on(
      table.eventId,
      table.votingId,
      table.votingItemId,
    ),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'restrict' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    actorJurorId: uuid('actor_juror_id'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    context: jsonb('context')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: 'audit_logs_same_event_juror_fk',
      columns: [table.eventId, table.actorJurorId],
      foreignColumns: [eventJurors.eventId, eventJurors.id],
    }).onDelete('restrict'),
    check(
      'audit_logs_one_actor',
      sql`${table.actorUserId} IS NULL OR ${table.actorJurorId} IS NULL`,
    ),
    index('audit_logs_event_time_idx').on(table.eventId, table.createdAt),
  ],
);

// One shared administration credential; guarantors have the same permissions.
export const adminAccess = pgTable(
  'admin_access',
  {
    key: text('key').primaryKey().default('administration'),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'restrict' }),
    passwordHash: text('password_hash').notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check('admin_access_singleton', sql`${table.key} = 'administration'`),
  ],
);

// Backend preparation only. Public link redemption and wizard entry are Phase 5.
export const jurorAccess = pgTable(
  'juror_access',
  {
    tokenHash: text('token_hash').primaryKey(),
    eventId: uuid('event_id').notNull(),
    jurorId: uuid('juror_id').notNull(),
    createdAt: createdAt(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: 'juror_access_same_event_fk',
      columns: [table.eventId, table.jurorId],
      foreignColumns: [eventJurors.eventId, eventJurors.id],
    }).onDelete('restrict'),
    check(
      'juror_access_hash_format',
      sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    index('juror_access_juror_idx').on(table.eventId, table.jurorId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    adminUserId: uuid('admin_user_id').references(() => adminAccess.userId, {
      onDelete: 'restrict',
    }),
    eventId: uuid('event_id'),
    jurorId: uuid('juror_id'),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: 'sessions_same_event_juror_fk',
      columns: [table.eventId, table.jurorId],
      foreignColumns: [eventJurors.eventId, eventJurors.id],
    }).onDelete('restrict'),
    check(
      'sessions_one_actor',
      sql`(${table.adminUserId} IS NOT NULL AND ${table.eventId} IS NULL AND ${table.jurorId} IS NULL) OR (${table.adminUserId} IS NULL AND ${table.eventId} IS NOT NULL AND ${table.jurorId} IS NOT NULL)`,
    ),
    check('sessions_expiry', sql`${table.expiresAt} > ${table.createdAt}`),
    check('sessions_hash_format', sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
    index('sessions_admin_idx').on(table.adminUserId),
    index('sessions_juror_idx').on(table.eventId, table.jurorId),
    index('sessions_expiry_idx').on(table.expiresAt),
  ],
);
