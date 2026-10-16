import { z } from 'zod';

export const votingStatuses = [
  'draft',
  'active',
  'closed',
  'archived',
] as const;
export const ballotStatuses = ['draft', 'submitted', 'cancelled'] as const;
export const juryGroupCodes = ['T', 'V'] as const;
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

// Structural validation only. D21 limits and submit completeness are not yet approved.
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
export const authenticatedSessionSchema = z.strictObject({
  authenticated: z.literal(true),
  principal: principalSchema,
  expiresAt: z.iso.datetime(),
});
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
