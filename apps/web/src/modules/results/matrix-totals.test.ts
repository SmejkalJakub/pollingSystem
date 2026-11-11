import { expect, test } from 'vitest';
import type { JurorVotes } from '@d21/contracts';
import { countedTeamTotals } from './matrix-totals';

test('the matrix footer reconciles with ranking in every jury filter', () => {
  const ranking = [
    { id: 'b', plus: 2, minus: 0, score: 2 },
    { id: 'a', plus: 1, minus: 1, score: 0 },
    { id: 'c', plus: 0, minus: 0, score: 0 },
  ];
  function ballot(
    id: string,
    groupId: string,
    progress: JurorVotes['progress'],
    votes: [string, 1 | -1][],
  ): JurorVotes {
    return {
      jurorId: id,
      displayName: id,
      groupId,
      progress,
      counted: progress === 'submitted',
      savedAt: null,
      submittedAt: null,
      entries: votes.map(([votingItemId, voteValue]) => ({
        votingItemId,
        voteValue,
      })),
    };
  }
  const ballots = [
    ballot('T1', 'T', 'submitted', [
      ['a', 1],
      ['b', 1],
    ]),
    ballot('V1', 'V', 'submitted', [
      ['a', -1],
      ['b', 1],
    ]),
    ballot('V2', 'V', 'submitted', []),
    ballot('T2', 'T', 'in_progress', [['c', 1]]),
    ballot('V3', 'V', 'invalid_draft', [['b', -1]]),
    ballot('T3', 'T', 'locked', [['a', 1]]),
    ballot('V4', 'V', 'not_started', []),
  ];
  const ids = ranking.map((row) => row.id);
  expect(countedTeamTotals(ids, ballots)).toEqual(
    new Map(ranking.map(({ id, ...totals }) => [id, totals])),
  );
  // Filtering displayed jurors can omit a counted contribution. The footer
  // must always receive the complete detail response.
  expect(
    countedTeamTotals(
      ids,
      ballots.filter((juror) => juror.groupId === 'T'),
    ),
  ).not.toEqual(countedTeamTotals(ids, ballots));
});
