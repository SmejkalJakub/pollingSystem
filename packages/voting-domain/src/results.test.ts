import { describe, expect, it } from 'vitest';
import { rankResults } from './results';

const totals = (scores: number[]) =>
  scores.map((score, i) => ({
    id: `item-${i}`,
    displayOrder: i,
    plus: Math.max(0, score),
    minus: Math.max(0, -score),
  }));
describe('D21 results ranking', () => {
  it('subtracts negatives, includes zero and negative scores, and leaves input untouched', () => {
    const source = Object.freeze(
      totals([0, -2, 3, 1]).map((row) => Object.freeze(row)),
    );
    const result = rankResults(source, 2);
    expect(result.rows.map((r) => [r.score, r.rank, r.selection])).toEqual([
      [3, 1, 'selected'],
      [1, 2, 'selected'],
      [0, 3, 'outside'],
      [-2, 4, 'outside'],
    ]);
    expect(source.map((r) => r.id)).toEqual([
      'item-0',
      'item-1',
      'item-2',
      'item-3',
    ]);
    expect(result.boundaryTie).toBe(false);
  });
  it('shares competition ranks and selects ties that fit wholly above the cutoff', () => {
    const result = rankResults(totals([5, 4, 4, 1, 1]), 3);
    expect(result.rows.map((r) => r.rank)).toEqual([1, 2, 2, 4, 4]);
    expect(result.rows.map((r) => r.tied)).toEqual([
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(result.rows.map((r) => r.selection)).toEqual([
      'selected',
      'selected',
      'selected',
      'outside',
      'outside',
    ]);
    expect(result.boundaryTie).toBe(false);
  });
  it('leaves the whole cutoff tie unresolved and selects only teams safely above it', () => {
    const result = rankResults(totals([5, 3, 3, 3, -1]), 2);
    expect(result.boundaryTie).toBe(true);
    expect(result.rows.map((r) => r.selection)).toEqual([
      'selected',
      'unresolved',
      'unresolved',
      'unresolved',
      'outside',
    ]);
    expect(result.rows.map((r) => r.rank)).toEqual([1, 2, 2, 2, 5]);
  });
  it('does not break a first-place or all-zero tie', () => {
    for (const scores of [
      [2, 2, 0],
      [0, 0, 0],
      [-1, -1, -2],
    ]) {
      const result = rankResults(totals(scores), 1);
      expect(result.boundaryTie).toBe(true);
      expect(
        result.rows.filter((r) => r.selection === 'selected'),
      ).toHaveLength(0);
    }
  });
  it('orders equal scores stably without changing their selection', () => {
    const source = totals([2, 2, 1]);
    source[0]!.displayOrder = 2;
    source[1]!.displayOrder = 1;
    const result = rankResults(source.reverse(), 1);
    expect(result.rows.map((r) => r.id)).toEqual([
      'item-1',
      'item-0',
      'item-2',
    ]);
    expect(
      result.rows.slice(0, 2).every((r) => r.selection === 'unresolved'),
    ).toBe(true);
  });
  it('handles empty rows and an unavailable cutoff without inferring places', () => {
    expect(rankResults([], 1)).toEqual({ rows: [], boundaryTie: false });
    expect(
      rankResults(totals([3, 2, 1]), null).rows.every(
        (r) => r.selection === 'outside',
      ),
    ).toBe(true);
  });
  it('matches independent cutoff invariants exhaustively for five-team scores', () => {
    for (let code = 0; code < 3 ** 5; code++) {
      const scores = Array.from(
        { length: 5 },
        (_, i) => (Math.floor(code / 3 ** i) % 3) - 1,
      );
      for (let places = 1; places < 5; places++) {
        const result = rankResults(totals(scores), places);
        const sorted = [...scores].sort((a, b) => b - a);
        const cutoff = sorted[places - 1]!;
        const crosses =
          sorted.filter((s) => s > cutoff).length < places &&
          sorted.filter((s) => s >= cutoff).length > places;
        expect(result.boundaryTie).toBe(crosses);
        for (const row of result.rows) {
          expect(row.rank).toBe(scores.filter((s) => s > row.score).length + 1);
          expect(row.selection).toBe(
            crosses && row.score === cutoff
              ? 'unresolved'
              : row.score >= cutoff
                ? 'selected'
                : 'outside',
          );
        }
      }
    }
  });
});
