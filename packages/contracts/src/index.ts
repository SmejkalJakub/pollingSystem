import { z } from 'zod';

export const votingStatuses = [
  'draft',
  'active',
  'closed',
  'archived',
] as const;
export const ballotStatuses = ['draft', 'submitted', 'cancelled'] as const;
export const juryGroupCodes = ['T', 'V'] as const;
// Presentation names only; stored/API group codes remain stable.
export const juryGroupLabel = (code: string | undefined) =>
  code === 'T' ? 'Technická' : code === 'V' ? 'Veřejná' : (code ?? '');
export const votingStatusSchema = z.enum(votingStatuses);
export const ballotStatusSchema = z.enum(ballotStatuses);
export const jurorProgressSchema = z.enum([
  'not_started',
  'in_progress',
  'submitted',
  'invalid_draft',
  'locked',
]);
export const juryGroupCodeSchema = z.enum(juryGroupCodes);
export const voteValueSchema = z.union([z.literal(1), z.literal(-1)]);

// Structural shape; the domain engine applies approved D21 rules using server data.
export const ballotEntrySchema = z.strictObject({
  votingItemId: z.uuid(),
  voteValue: voteValueSchema,
});

export const healthResponseSchema = z.strictObject({
  status: z.literal('ok'),
  service: z.literal('d21-api'),
});
export const readinessResponseSchema = z.strictObject({
  status: z.enum(['ready', 'unavailable']),
  database: z.enum(['connected', 'unavailable']),
});
export const apiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.string(),
    message: z.string(),
  }),
});

export type VotingStatus = z.infer<typeof votingStatusSchema>;
export type BallotStatus = z.infer<typeof ballotStatusSchema>;
export type JurorProgress = z.infer<typeof jurorProgressSchema>;
export type BallotEntry = z.infer<typeof ballotEntrySchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;

export const adminLoginSchema = z.strictObject({
  password: z.string().min(1).max(256),
});
export const newAdminPasswordSchema = z.string().min(15).max(256);
export const adminPrincipalSchema = z.strictObject({
  kind: z.literal('admin'),
  id: z.uuid(),
  displayName: z.string(),
});
export const jurorPrincipalSchema = z.strictObject({
  kind: z.literal('juror'),
  id: z.uuid(),
  eventId: z.uuid(),
  juryGroupId: z.uuid(),
  displayName: z.string(),
});
export const principalSchema = z.discriminatedUnion('kind', [
  adminPrincipalSchema,
  jurorPrincipalSchema,
]);
export const authenticatedSessionSchema = z.union([
  z.strictObject({
    authenticated: z.literal(true),
    principal: adminPrincipalSchema,
    expiresAt: z.iso.datetime(),
  }),
  z.strictObject({
    authenticated: z.literal(true),
    principal: jurorPrincipalSchema,
    expiresAt: z.iso.datetime().nullable(),
  }),
]);
export const sessionResponseSchema = z.union([
  z.strictObject({ authenticated: z.literal(false) }),
  authenticatedSessionSchema,
]);
export const adminAccessResponseSchema = z.strictObject({
  principal: adminPrincipalSchema,
  permissions: z.tuple([z.literal('administer')]),
});
export type Principal = z.infer<typeof principalSchema>;
export type AuthenticatedSession = z.infer<typeof authenticatedSessionSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

const nameSchema = z.string().trim().min(1).max(200);
export const eventInputSchema = z.strictObject({
  name: nameSchema,
  description: z.string().trim().max(5000),
});
export const eventPatchSchema = eventInputSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Provide at least one field.',
  );
export const eventSchema = eventInputSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const eventListSchema = z.array(eventSchema);
export const eventParamsSchema = z.strictObject({ eventId: z.uuid() });
export type EventInput = z.infer<typeof eventInputSchema>;
export type EventPatch = z.infer<typeof eventPatchSchema>;
export type EventRecord = z.infer<typeof eventSchema>;

export const juryGroupInputSchema = z.strictObject({
  code: juryGroupCodeSchema,
  name: nameSchema,
});
export const juryGroupPatchSchema = juryGroupInputSchema.pick({ name: true });
export const juryGroupSchema = juryGroupInputSchema.extend({
  id: z.uuid(),
  eventId: z.uuid(),
});
export const jurorInputSchema = z.strictObject({
  id: z
    .uuid()
    .transform((id) => id.toLowerCase())
    .optional(),
  displayName: nameSchema,
  juryGroupId: z.uuid(),
});
export const jurorPatchSchema = jurorInputSchema
  .omit({ id: true })
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Provide at least one field.',
  );
export const jurorSchema = jurorInputSchema.extend({
  id: z.uuid(),
  eventId: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const juryGroupListSchema = z.array(juryGroupSchema);
export const jurorListSchema = z.array(jurorSchema);
export const rosterSchema = z.strictObject({
  groups: juryGroupListSchema,
  jurors: z.array(
    jurorSchema.extend({
      access: z.enum(['none', 'legacy', 'stored', 'revoked']),
    }),
  ),
  locked: z.boolean(),
});
export const groupParamsSchema = eventParamsSchema.extend({
  groupId: z.uuid(),
});
export const jurorParamsSchema = eventParamsSchema.extend({
  jurorId: z.uuid(),
});
export type JuryGroupInput = z.infer<typeof juryGroupInputSchema>;
export type JuryGroupRecord = z.infer<typeof juryGroupSchema>;
export type JurorInput = z.infer<typeof jurorInputSchema>;
export type JurorPatch = z.infer<typeof jurorPatchSchema>;
export type JurorRecord = z.infer<typeof jurorSchema>;
export type Roster = z.infer<typeof rosterSchema>;

// IDs belong to event memberships; display names never establish identity.
export const jurorTableRowSchema = z.strictObject({
  id: z.uuid().transform((id) => id.toLowerCase()),
  displayName: z.string(),
  groupCode: z.string(),
});
export const jurorTableFieldsSchema = z.strictObject({
  displayName: nameSchema,
  groupCode: juryGroupCodeSchema,
});
export const jurorTableInputSchema = z.strictObject({
  baseVersion: z.string().regex(/^[a-f0-9]{64}$/),
  rows: z
    .array(jurorTableRowSchema)
    .refine(
      (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
      'Each row ID must be unique.',
    ),
});
export const jurorTableSnapshotSchema = rosterSchema.extend({
  version: z.string().regex(/^[a-f0-9]{64}$/),
});
export const jurorTableIssueSchema = z.strictObject({
  rowId: z.uuid(),
  field: z.enum(['displayName', 'groupCode']),
});
export const jurorTableSaveSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('saved'),
    snapshot: jurorTableSnapshotSchema,
  }),
  z.strictObject({
    status: z.literal('invalid'),
    issues: z.array(jurorTableIssueSchema),
  }),
]);
export type JurorTableRow = z.infer<typeof jurorTableRowSchema>;
export type JurorTableInput = z.infer<typeof jurorTableInputSchema>;
export type JurorTableSnapshot = z.infer<typeof jurorTableSnapshotSchema>;
export type JurorTableIssue = z.infer<typeof jurorTableIssueSchema>;

// The server resolves these identities from the session, never from browser claims.
export const wizardIdentitySchema = z.strictObject({
  principal: jurorPrincipalSchema,
  event: eventSchema,
  group: juryGroupSchema,
  expiresAt: z.iso.datetime().nullable(),
});
export type WizardIdentity = z.infer<typeof wizardIdentitySchema>;

// Limits are explicitly entered by administrators; no automatic D21 rounding.
export const positiveVotesPerNegative = 2;
const configurationCount = z.number().int().min(1).max(2147483647);
export const votingConfigurationSchema = z
  .strictObject({
    selectedPlaces: configurationCount,
    maxPlusVotes: configurationCount,
    maxMinusVotes: z.number().int().min(0).max(2147483647),
    allowNegativeVotes: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.maxPlusVotes <= value.selectedPlaces)
      ctx.addIssue({
        code: 'custom',
        path: ['maxPlusVotes'],
        message: 'Positive votes must exceed the number of selected places.',
      });
    if (
      value.maxMinusVotes >
      Math.floor(value.maxPlusVotes / positiveVotesPerNegative)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['maxMinusVotes'],
        message: 'Each negative requires two positive votes.',
      });
    if (!value.allowNegativeVotes && value.maxMinusVotes !== 0)
      ctx.addIssue({
        code: 'custom',
        path: ['maxMinusVotes'],
        message: 'Disabled negative votes require a zero limit.',
      });
  });
export type VotingConfiguration = z.infer<typeof votingConfigurationSchema>;
export const votingDraftInputSchema = z.strictObject({
  name: nameSchema,
  instructions: z.string().trim().max(5000),
  kind: z.enum(['selection', 'final']),
});
export const votingDraftPatchSchema = votingDraftInputSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Provide at least one field.',
  );
export const votingRecordSchema = votingDraftInputSchema.extend({
  id: z.uuid(),
  eventId: z.uuid(),
  status: votingStatusSchema,
  selectedPlaces: configurationCount.nullable(),
  maxPlusVotes: z.number().int().min(0).max(2147483647).nullable(),
  maxMinusVotes: z.number().int().min(0).max(2147483647).nullable(),
  allowNegativeVotes: z.boolean().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const votingListSchema = z.array(votingRecordSchema);
export const votingParamsSchema = z.strictObject({ votingId: z.uuid() });
export type VotingDraftInput = z.infer<typeof votingDraftInputSchema>;
export type VotingDraftPatch = z.infer<typeof votingDraftPatchSchema>;
export type VotingRecord = z.infer<typeof votingRecordSchema>;
export const votingGroupsInputSchema = z.strictObject({
  // Draft setup can be incomplete. Activation will require approved readiness checks.
  juryGroupIds: z
    .array(z.uuid())
    .max(2)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      'Choose each group only once.',
    ),
});
export type VotingGroupsInput = z.infer<typeof votingGroupsInputSchema>;

export const teamInputSchema = eventInputSchema;
export const teamPatchSchema = eventPatchSchema;
export const teamRecordSchema = teamInputSchema.extend({
  id: z.uuid(),
  eventId: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const teamListSchema = z.array(teamRecordSchema);
// Client-generated row IDs make an uncertain save retry address the same teams.
export const teamTableRowSchema = z.strictObject({
  id: z.uuid().transform((id) => id.toLowerCase()),
  name: z.string(),
  description: z.string(),
});
export const teamTableInputSchema = z.strictObject({
  baseVersion: z.string().regex(/^[a-f0-9]{64}$/),
  rows: z
    .array(teamTableRowSchema)
    .refine(
      (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
      'Each row ID must be unique.',
    ),
});
export const teamTableSnapshotSchema = z.strictObject({
  version: z.string().regex(/^[a-f0-9]{64}$/),
  teams: teamListSchema,
});
export const teamTableIssueSchema = z.strictObject({
  rowId: z.uuid(),
  field: z.enum(['name', 'description']),
});
export const teamTableSaveSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('saved'),
    snapshot: teamTableSnapshotSchema,
  }),
  z.strictObject({
    status: z.literal('invalid'),
    issues: z.array(teamTableIssueSchema),
  }),
]);
export type TeamTableRow = z.infer<typeof teamTableRowSchema>;
export type TeamTableInput = z.infer<typeof teamTableInputSchema>;
export type TeamTableSnapshot = z.infer<typeof teamTableSnapshotSchema>;
export type TeamTableIssue = z.infer<typeof teamTableIssueSchema>;
export const teamParamsSchema = eventParamsSchema.extend({ teamId: z.uuid() });
const displayOrderSchema = z.number().int().min(0).max(2147483647);
export const votingItemInputSchema = z.strictObject({
  teamId: z.uuid(),
  displayOrder: displayOrderSchema,
});
export const votingItemPatchSchema = votingItemInputSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Provide at least one field.',
  );
export const votingItemRecordSchema = z.strictObject({
  id: z.uuid(),
  eventId: z.uuid(),
  votingId: z.uuid(),
  teamId: z.uuid().nullable(),
  name: nameSchema,
  description: z.string().trim().max(5000),
  displayOrder: displayOrderSchema,
});
export const votingItemListSchema = z.array(votingItemRecordSchema);
export const votingItemParamsSchema = votingParamsSchema.extend({
  itemId: z.uuid(),
});
export type TeamInput = z.infer<typeof teamInputSchema>;
export type TeamPatch = z.infer<typeof teamPatchSchema>;
export type TeamRecord = z.infer<typeof teamRecordSchema>;
export type VotingItemInput = z.infer<typeof votingItemInputSchema>;
export type VotingItemPatch = z.infer<typeof votingItemPatchSchema>;
export const votingActionSchema = z.strictObject({});

// A category save carries explicit values; domain/field errors are reported together.
const setupUuid = z.uuid().transform((id) => id.toLowerCase());
export const votingSetupValuesSchema = z.strictObject({
  name: z.string(),
  instructions: z.string(),
  kind: z.string(),
  configuration: z.strictObject({
    selectedPlaces: z.number().nullable(),
    maxPlusVotes: z.number().nullable(),
    maxMinusVotes: z.number().nullable(),
    allowNegativeVotes: z.boolean().nullable(),
  }),
  juryGroupIds: z
    .array(setupUuid)
    .max(2)
    .refine((ids) => new Set(ids).size === ids.length),
  items: z
    .array(
      z.strictObject({
        id: setupUuid,
        teamId: setupUuid.nullable(),
        displayOrder: z.number().nullable(),
      }),
    )
    .refine(
      (items) => new Set(items.map((item) => item.id)).size === items.length,
    ),
});
export const votingSetupParamsSchema = eventParamsSchema.extend({
  votingId: setupUuid,
});
export const votingSetupInputSchema = z.strictObject({
  baseVersion: z.string().regex(/^[a-f0-9]{64}$/),
  values: votingSetupValuesSchema,
});
export const votingSetupSnapshotSchema = z.strictObject({
  version: z.string().regex(/^[a-f0-9]{64}$/),
  voting: votingRecordSchema.nullable(),
  editable: z.boolean(),
  groups: juryGroupListSchema,
  teams: teamListSchema,
  juryGroupIds: z.array(z.uuid()),
  items: votingItemListSchema,
});
export const votingSetupSaveSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('saved'),
    snapshot: votingSetupSnapshotSchema,
  }),
  z.strictObject({
    status: z.literal('invalid'),
    issues: z.array(z.strictObject({ field: z.string() })),
  }),
]);
export type VotingSetupValues = z.infer<typeof votingSetupValuesSchema>;
export type VotingSetupInput = z.infer<typeof votingSetupInputSchema>;
export type VotingSetupSnapshot = z.infer<typeof votingSetupSnapshotSchema>;

export const jurorStartSchema = z.strictObject({
  eventId: z.uuid(),
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const jurorAccessStatusSchema = z.strictObject({ issued: z.boolean() });
export const jurorLinkSchema = z.strictObject({ url: z.url() });
export const wizardStepSchema = z.strictObject({
  id: z.uuid(),
  name: nameSchema,
  instructions: z.string().max(5000),
  kind: z.enum(['selection', 'final']),
  status: z.enum(['active', 'closed', 'archived']),
  selectedPlaces: z.number().int().nullable(),
  maxPlusVotes: z.number().int().nullable(),
  maxMinusVotes: z.number().int().nullable(),
  allowNegativeVotes: z.boolean().nullable(),
  progress: jurorProgressSchema.default('not_started'),
});
export const wizardStepsSchema = z.array(wizardStepSchema);
export const wizardCurrentSchema = wizardIdentitySchema.extend({
  steps: wizardStepsSchema,
});
export const wizardStepParamsSchema = z.strictObject({ stepId: z.uuid() });
export const jurorStartResponseSchema = z.strictObject({
  session: authenticatedSessionSchema,
  wizard: wizardCurrentSchema,
});
export type WizardCurrent = z.infer<typeof wizardCurrentSchema>;
export type WizardStep = z.infer<typeof wizardStepSchema>;

// Validation only: no draft, submission or ballot ownership fields.
export const ballotValidationInputSchema = z.strictObject({
  entries: z.array(ballotEntrySchema),
});
export const ballotIssueSchema = z.enum([
  'CONFIGURATION_NOT_READY',
  'VOTING_UNAVAILABLE',
  'UNKNOWN_ITEM',
  'DUPLICATE_ITEM',
  'PLUS_LIMIT',
  'MINUS_LIMIT',
  'NEGATIVES_DISABLED',
  'NEGATIVE_ELIGIBILITY',
]);
export const ballotValidationSchema = z.strictObject({
  valid: z.boolean(),
  issues: z.array(ballotIssueSchema),
  plusUsed: z.number().int().nonnegative(),
  minusUsed: z.number().int().nonnegative(),
  plusRemaining: z.number().int().nonnegative(),
  minusRemaining: z.number().int().nonnegative(),
  minusEntitlement: z.number().int().nonnegative(),
});
export type BallotIssue = z.infer<typeof ballotIssueSchema>;
export type BallotValidation = z.infer<typeof ballotValidationSchema>;

// A null revision asserts that no ballot exists. Never accept owner/status claims.
export const ballotDraftInputSchema = z.strictObject({
  expectedRevision: z.number().int().min(0).max(2147483647).nullable(),
  entries: z.array(ballotEntrySchema),
});
export const ballotDraftSchema = z.strictObject({
  status: ballotStatusSchema,
  revision: z.number().int().nonnegative(),
  savedAt: z.iso.datetime(),
  submittedAt: z.iso.datetime().nullable(),
  entries: z.array(ballotEntrySchema),
  validation: ballotValidationSchema,
  progress: jurorProgressSchema,
});
export const ballotDraftResponseSchema = ballotDraftSchema.nullable();
export const wizardStepDetailSchema = z.strictObject({
  current: wizardCurrentSchema,
  step: wizardStepSchema,
  items: votingItemListSchema,
  ballot: ballotDraftResponseSchema,
});
export type BallotDraftInput = z.infer<typeof ballotDraftInputSchema>;
export type BallotDraft = z.infer<typeof ballotDraftSchema>;
export type WizardStepDetail = z.infer<typeof wizardStepDetailSchema>;

export const wizardReviewCategorySchema = z.strictObject({
  step: wizardStepSchema,
  items: votingItemListSchema,
  ballot: ballotDraftResponseSchema,
});
export const wizardReviewSchema = z.strictObject({
  current: wizardCurrentSchema,
  categories: z.array(wizardReviewCategorySchema),
});
// Only explicitly selected, previously saved versions may be submitted from review.
export const wizardFinalSubmitInputSchema = z.strictObject({
  categories: z
    .array(
      z.strictObject({
        stepId: z.uuid(),
        expectedRevision: z.number().int().min(0).max(2147483647),
        entries: z.array(ballotEntrySchema),
      }),
    )
    .min(1)
    .refine(
      (categories) =>
        new Set(categories.map((category) => category.stepId)).size ===
        categories.length,
      'Select each category only once.',
    ),
});
export const wizardFinalResultSchema = z.discriminatedUnion('outcome', [
  z.strictObject({
    stepId: z.uuid(),
    outcome: z.literal('submitted'),
    ballot: ballotDraftSchema,
  }),
  z.strictObject({
    stepId: z.uuid(),
    outcome: z.literal('rejected'),
    code: z.string(),
    status: z.number().int(),
  }),
]);
export const wizardFinalSubmitSchema = z.strictObject({
  results: z.array(wizardFinalResultSchema),
});
export type WizardReview = z.infer<typeof wizardReviewSchema>;
export type WizardReviewCategory = z.infer<typeof wizardReviewCategorySchema>;
export type WizardFinalSubmitInput = z.infer<
  typeof wizardFinalSubmitInputSchema
>;
export type WizardFinalSubmit = z.infer<typeof wizardFinalSubmitSchema>;

// Submit atomically validates/stores the current selection using the same revision boundary.
export const ballotSubmitInputSchema = ballotDraftInputSchema;
export const ballotUnlockInputSchema = z.strictObject({
  expectedRevision: z.number().int().min(0).max(2147483647),
});
export const adminBallotParamsSchema = z.strictObject({
  votingId: z.uuid(),
  ballotId: z.uuid(),
});
export const adminBallotSchema = z.strictObject({
  id: z.uuid(),
  jurorId: z.uuid(),
  displayName: z.string(),
  status: ballotStatusSchema,
  revision: z.number().int().nonnegative(),
  submittedAt: z.iso.datetime().nullable(),
});
export const adminBallotsSchema = z.array(adminBallotSchema);
export type AdminBallot = z.infer<typeof adminBallotSchema>;

// Operational metadata only: choices and historical submission snapshots stay private.
export const dashboardQuerySchema = z.strictObject({ eventId: z.uuid() });
export const dashboardProblemSchema = z.enum([
  'CONFIGURATION_NOT_READY',
  'UNLINKED_ITEMS',
  'NO_ELIGIBLE_JURORS',
  'INVALID_DRAFT',
  'LOCKED_BALLOT',
  'UNAVAILABLE_PENDING',
  'INELIGIBLE_BALLOTS',
  'INVALID_SUBMISSION',
]);
export const dashboardJurorSchema = z.strictObject({
  id: z.uuid(),
  displayName: z.string(),
  groupId: z.uuid(),
  progress: jurorProgressSchema,
  savedAt: z.iso.datetime().nullable(),
  submittedAt: z.iso.datetime().nullable(),
});
export const dashboardCountsSchema = z.strictObject({
  expected: z.number().int().nonnegative(),
  submitted: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  invalid: z.number().int().nonnegative(),
  locked: z.number().int().nonnegative(),
});
export const dashboardCategorySchema = z.strictObject({
  id: z.uuid(),
  eventId: z.uuid(),
  name: z.string(),
  kind: z.enum(['selection', 'final']),
  status: votingStatusSchema,
  state: z.enum(['ready', 'in_progress', 'done', 'problem']),
  groups: juryGroupListSchema,
  counts: dashboardCountsSchema,
  groupCounts: z.array(
    z.strictObject({ groupId: z.uuid(), counts: dashboardCountsSchema }),
  ),
  problems: z.array(dashboardProblemSchema),
  jurors: z.array(dashboardJurorSchema),
});
export const dashboardOverviewSchema = z.strictObject({
  event: eventSchema,
  asOf: z.iso.datetime(),
  categories: z.array(dashboardCategorySchema),
  totals: dashboardCountsSchema.extend({
    categories: z.number().int().nonnegative(),
    completedCategories: z.number().int().nonnegative(),
    pendingJurors: z.number().int().nonnegative(),
    problemCategories: z.number().int().nonnegative(),
  }),
});
export const dashboardDetailSchema = z.strictObject({
  event: eventSchema,
  asOf: z.iso.datetime(),
  category: dashboardCategorySchema,
});
export type DashboardCategory = z.infer<typeof dashboardCategorySchema>;
export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;
export type DashboardCounts = z.infer<typeof dashboardCountsSchema>;
export type DashboardProblem = z.infer<typeof dashboardProblemSchema>;

export const resultsQuerySchema = z.strictObject({ eventId: z.uuid() });
export const resultRowSchema = z.strictObject({
  id: z.uuid(),
  teamId: z.uuid().nullable(),
  name: z.string(),
  description: z.string(),
  displayOrder: z.number().int().nonnegative(),
  plus: z.number().int().nonnegative(),
  minus: z.number().int().nonnegative(),
  score: z.number().int(),
  rank: z.number().int().positive(),
  tied: z.boolean(),
  selection: z.enum(['selected', 'unresolved', 'outside']),
});
export const resultsReasonSchema = z.enum([
  'NOT_CLOSED',
  'PENDING_BALLOTS',
  'DATA_PROBLEMS',
  'CUTOFF_TIE',
]);
export const resultsCategorySchema = z.strictObject({
  id: z.uuid(),
  eventId: z.uuid(),
  name: z.string(),
  kind: z.enum(['selection', 'final']),
  status: votingStatusSchema,
  selectedPlaces: z.number().int().positive().nullable(),
  groups: juryGroupListSchema,
  counts: dashboardCountsSchema,
  problems: z.array(dashboardProblemSchema),
  stage: z.enum(['provisional', 'final']),
  reasons: z.array(resultsReasonSchema),
  boundaryTie: z.boolean(),
  rows: z.array(resultRowSchema),
});
export const resultsOverviewSchema = z.strictObject({
  event: eventSchema,
  asOf: z.iso.datetime(),
  categories: z.array(resultsCategorySchema),
});
export const resultsDetailSchema = z.strictObject({
  event: eventSchema,
  asOf: z.iso.datetime(),
  category: resultsCategorySchema,
});
export type ResultsCategory = z.infer<typeof resultsCategorySchema>;
export type ResultsOverview = z.infer<typeof resultsOverviewSchema>;
export type ResultRow = z.infer<typeof resultRowSchema>;
export type ResultsReason = z.infer<typeof resultsReasonSchema>;
