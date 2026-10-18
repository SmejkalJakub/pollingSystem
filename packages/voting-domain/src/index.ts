import {
  positiveVotesPerNegative,
  votingConfigurationSchema,
  type BallotEntry,
  type BallotIssue,
  type BallotValidation,
} from '@d21/contracts';

export { rankResults } from './results';

export type VotingContext = {
  status: string;
  selectedPlaces: number | null;
  maxPlusVotes: number | null;
  maxMinusVotes: number | null;
  allowNegativeVotes: boolean | null;
};

// IDs and configuration come from the category, never from submitted claims.
export function validateBallot(
  context: VotingContext,
  itemIds: readonly string[],
  entries: readonly BallotEntry[],
): BallotValidation {
  const issues: BallotIssue[] = [];
  const configuration = votingConfigurationSchema.safeParse({
    selectedPlaces: context.selectedPlaces,
    maxPlusVotes: context.maxPlusVotes,
    maxMinusVotes: context.maxMinusVotes,
    allowNegativeVotes: context.allowNegativeVotes,
  });
  const plusUsed = entries.filter((entry) => entry.voteValue === 1).length;
  const minusUsed = entries.length - plusUsed;
  const allowed = new Set(itemIds);
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!allowed.has(entry.votingItemId)) issues.push('UNKNOWN_ITEM');
    if (seen.has(entry.votingItemId)) issues.push('DUPLICATE_ITEM');
    seen.add(entry.votingItemId);
  }
  if (context.status !== 'active') issues.push('VOTING_UNAVAILABLE');
  const config = configuration.success ? configuration.data : undefined;
  if (
    !config ||
    config.selectedPlaces >= allowed.size ||
    config.maxPlusVotes + config.maxMinusVotes >= allowed.size
  )
    issues.push('CONFIGURATION_NOT_READY');
  const minusEntitlement = config?.allowNegativeVotes
    ? Math.min(
        config.maxMinusVotes,
        Math.floor(plusUsed / positiveVotesPerNegative),
      )
    : 0;
  if (config) {
    if (plusUsed > config.maxPlusVotes) issues.push('PLUS_LIMIT');
    if (minusUsed > config.maxMinusVotes) issues.push('MINUS_LIMIT');
    if (!config.allowNegativeVotes && minusUsed)
      issues.push('NEGATIVES_DISABLED');
    if (minusUsed > minusEntitlement) issues.push('NEGATIVE_ELIGIBILITY');
  }
  return {
    valid: issues.length === 0,
    issues: [...new Set(issues)],
    plusUsed,
    minusUsed,
    plusRemaining: config ? Math.max(0, config.maxPlusVotes - plusUsed) : 0,
    minusRemaining: Math.max(0, minusEntitlement - minusUsed),
    minusEntitlement,
  };
}

// A selected button removes its vote; the opposite sign replaces it atomically.
// Edits may reduce actual-cast eligibility: retain them and explain invalidity.
export function toggleVote(
  context: VotingContext,
  itemIds: readonly string[],
  entries: readonly BallotEntry[],
  itemId: string,
  voteValue: 1 | -1,
): { entries: BallotEntry[]; blocked?: BallotIssue } {
  const before = validateBallot(context, itemIds, entries);
  for (const issue of [
    'VOTING_UNAVAILABLE',
    'CONFIGURATION_NOT_READY',
    'UNKNOWN_ITEM',
    'DUPLICATE_ITEM',
  ] as const) {
    if (before.issues.includes(issue))
      return { entries: [...entries], blocked: issue };
  }
  if (!itemIds.includes(itemId))
    return { entries: [...entries], blocked: 'UNKNOWN_ITEM' };
  const existing = entries.find((entry) => entry.votingItemId === itemId);
  const next = entries.filter((entry) => entry.votingItemId !== itemId);
  if (existing?.voteValue !== voteValue) {
    if (voteValue === -1 && !context.allowNegativeVotes)
      return { entries: [...entries], blocked: 'NEGATIVES_DISABLED' };
    next.push({ votingItemId: itemId, voteValue });
    const after = validateBallot(context, itemIds, next);
    const cap = voteValue === 1 ? 'PLUS_LIMIT' : 'MINUS_LIMIT';
    if (after.issues.includes(cap))
      return { entries: [...entries], blocked: cap };
  }
  return { entries: next };
}
