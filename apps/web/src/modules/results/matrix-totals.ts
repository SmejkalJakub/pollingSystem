import type { JurorVotes } from '@d21/contracts';

export function countedTeamTotals(
  teamIds: readonly string[],
  jurorVotes: readonly JurorVotes[],
) {
  const totals = new Map(
    teamIds.map((id) => [id, { plus: 0, minus: 0, score: 0 }]),
  );
  for (const ballot of jurorVotes) {
    if (!ballot.counted) {
      continue;
    }
    for (const { votingItemId, voteValue } of ballot.entries) {
      const team = totals.get(votingItemId);
      if (!team) {
        continue;
      }
      if (voteValue === 1) {
        team.plus++;
      }
      if (voteValue === -1) {
        team.minus++;
      }
      team.score += voteValue;
    }
  }
  return totals;
}
