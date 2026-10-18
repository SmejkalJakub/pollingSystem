import { describe, expect, it } from 'vitest';
import { ballotValidationInputSchema, type BallotEntry } from '@d21/contracts';
import { toggleVote, validateBallot, type VotingContext } from './index';

const context: VotingContext = {
  status: 'active',
  selectedPlaces: 1,
  maxPlusVotes: 4,
  maxMinusVotes: 2,
  allowNegativeVotes: true,
};
const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const votes = (plus: number, minus: number): BallotEntry[] =>
  ids
    .slice(0, plus + minus)
    .map((id, i) => ({ votingItemId: id, voteValue: i < plus ? 1 : -1 }));

describe('approved D21 validation', () => {
  it.each([
    [0, 0, true],
    [1, 0, true],
    [1, 1, false],
    [2, 1, true],
    [3, 1, true],
    [3, 2, false],
    [4, 2, true],
    [5, 0, false],
    [4, 3, false],
  ])('%i plus, %i minus => %s', (plus, minus, valid) => {
    expect(validateBallot(context, ids, votes(plus, minus)).valid).toBe(valid);
  });
  it('allows two negatives with five actual positives when the explicit caps permit it', () => {
    const itemIds = [...ids, 'h', 'i', 'j'];
    const entries: BallotEntry[] = itemIds
      .slice(0, 7)
      .map((votingItemId, index) => ({
        votingItemId,
        voteValue: index < 5 ? 1 : -1,
      }));
    expect(
      validateBallot(
        { ...context, maxPlusVotes: 6, maxMinusVotes: 3 },
        itemIds,
        entries,
      ),
    ).toMatchObject({ valid: true, minusEntitlement: 2, minusRemaining: 0 });
  });
  it('uses actual positives, bounded by the stored cap, and permits unused votes', () => {
    expect(validateBallot(context, ids, votes(0, 0))).toMatchObject({
      valid: true,
      plusRemaining: 4,
      minusEntitlement: 0,
      minusRemaining: 0,
    });
    expect(validateBallot(context, ids, votes(3, 1))).toMatchObject({
      valid: true,
      plusRemaining: 1,
      minusEntitlement: 1,
      minusRemaining: 0,
    });
    expect(
      validateBallot({ ...context, maxMinusVotes: 1 }, ids, votes(4, 0)),
    ).toMatchObject({ minusEntitlement: 1, minusRemaining: 1 });
  });
  it('rejects disabled negatives, duplicate signs/identities and foreign entries', () => {
    expect(
      validateBallot(
        { ...context, allowNegativeVotes: false, maxMinusVotes: 0 },
        ids,
        votes(2, 1),
      ).issues,
    ).toContain('NEGATIVES_DISABLED');
    for (const sign of [1, -1] as const)
      expect(
        validateBallot(context, ids, [
          { votingItemId: 'a', voteValue: 1 },
          { votingItemId: 'a', voteValue: sign },
        ]).issues,
      ).toContain('DUPLICATE_ITEM');
    expect(
      validateBallot(context, ids, [{ votingItemId: 'other', voteValue: 1 }])
        .issues,
    ).toContain('UNKNOWN_ITEM');
  });
  it.each(['closed', 'archived', 'draft'])('rejects %s voting', (status) => {
    expect(validateBallot({ ...context, status }, ids, []).issues).toContain(
      'VOTING_UNAVAILABLE',
    );
  });
  it.each([
    { maxPlusVotes: null },
    { maxPlusVotes: 1 },
    { maxPlusVotes: 2.5 },
    { maxMinusVotes: -1 },
    { maxMinusVotes: 3 },
    { allowNegativeVotes: false },
    { selectedPlaces: 7 },
  ])('fails closed for invalid or incomplete rules %o', (patch) => {
    expect(validateBallot({ ...context, ...patch }, ids, []).issues).toContain(
      'CONFIGURATION_NOT_READY',
    );
  });
  it('requires sufficient actual candidates, without computing caps', () => {
    expect(validateBallot(context, ids.slice(0, 6), []).issues).toContain(
      'CONFIGURATION_NOT_READY',
    );
    expect(validateBallot(context, [], []).valid).toBe(false);
  });
  it('rejects malformed wire entries and injected claims', () => {
    const id = '4dd542a0-447c-4897-895f-9c68d4b54fc4';
    for (const input of [
      { entries: [{ votingItemId: id, voteValue: 0 }] },
      { entries: [{ votingItemId: id, voteValue: 1, jurorId: id }] },
      { entries: [], maxPlusVotes: 99 },
      { entries: [], eventId: id },
    ])
      expect(ballotValidationInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('vote transitions', () => {
  it('adds, removes, replaces both signs and never mutates input', () => {
    let entries: BallotEntry[] = [];
    for (const sign of [1, -1] as const) {
      const before = structuredClone(entries);
      const next = toggleVote(context, ids, entries, 'a', sign);
      expect(entries).toEqual(before);
      expect(
        next.entries.filter((entry) => entry.votingItemId === 'a'),
      ).toEqual([{ votingItemId: 'a', voteValue: sign }]);
      entries = next.entries;
    }
    expect(toggleVote(context, ids, entries, 'a', -1).entries).toEqual([]);
    expect(toggleVote(context, ids, votes(1, 0), 'a', 1).entries).toEqual([]);
    expect(toggleVote(context, ids, entries, 'a', 1).entries).toEqual([
      { votingItemId: 'a', voteValue: 1 },
    ]);
  });
  it('keeps edits that reduce negative eligibility until the juror corrects them', () => {
    const start = votes(2, 1);
    const removed = toggleVote(context, ids, start, 'a', 1);
    expect(removed.blocked).toBeUndefined();
    expect(validateBallot(context, ids, removed.entries).issues).toContain(
      'NEGATIVE_ELIGIBILITY',
    );
    expect(
      validateBallot(
        context,
        ids,
        toggleVote(context, ids, removed.entries, 'c', -1).entries,
      ).valid,
    ).toBe(true);
    const replaced = toggleVote(context, ids, start, 'a', -1);
    expect(replaced.blocked).toBeUndefined();
    expect(validateBallot(context, ids, replaced.entries).issues).toContain(
      'NEGATIVE_ELIGIBILITY',
    );
  });
  it('blocks cap increases and disabled negatives while allowing removal/replacement at a cap', () => {
    expect(toggleVote(context, ids, votes(4, 0), 'g', 1).blocked).toBe(
      'PLUS_LIMIT',
    );
    expect(toggleVote(context, ids, votes(4, 2), 'g', -1).blocked).toBe(
      'MINUS_LIMIT',
    );
    expect(
      toggleVote(context, ids, votes(4, 2), 'a', 1).blocked,
    ).toBeUndefined();
    expect(toggleVote(context, ids, votes(4, 2), 'a', -1).blocked).toBe(
      'MINUS_LIMIT',
    );
    expect(
      toggleVote(
        { ...context, allowNegativeVotes: false, maxMinusVotes: 0 },
        ids,
        [],
        'a',
        -1,
      ).blocked,
    ).toBe('NEGATIVES_DISABLED');
    expect(toggleVote(context, ids, [], 'other', 1).blocked).toBe(
      'UNKNOWN_ITEM',
    );
    expect(
      toggleVote({ ...context, status: 'closed' }, ids, [], 'a', 1).blocked,
    ).toBe('VOTING_UNAVAILABLE');
  });
  it('matches independent counts across every assignment of seven items', () => {
    for (let mask = 0; mask < 3 ** ids.length; mask++) {
      let n = mask;
      const entries: BallotEntry[] = [];
      for (const id of ids) {
        const digit = n % 3;
        n = Math.floor(n / 3);
        if (digit)
          entries.push({ votingItemId: id, voteValue: digit === 1 ? 1 : -1 });
      }
      const plus = entries.filter((e) => e.voteValue === 1).length;
      const minus = entries.length - plus;
      const result = validateBallot(context, ids, entries);
      expect(result.valid).toBe(
        plus <= 4 && minus <= 2 && minus <= Math.floor(plus / 2),
      );
      for (const sign of [1, -1] as const) {
        const next = toggleVote(context, ids, entries, 'a', sign);
        expect(new Set(next.entries.map((e) => e.votingItemId)).size).toBe(
          next.entries.length,
        );
        if (!next.blocked)
          expect(
            next.entries.find((e) => e.votingItemId === 'a')?.voteValue,
          ).toBe(
            entries.find((e) => e.votingItemId === 'a')?.voteValue === sign
              ? undefined
              : sign,
          );
      }
    }
  });
});
