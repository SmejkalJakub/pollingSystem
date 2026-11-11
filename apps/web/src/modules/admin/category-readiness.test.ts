import { describe, expect, it } from 'vitest';
import type { VotingSetupValues } from '@d21/contracts';
import { categoryReadiness } from './category-readiness';

const values: VotingSetupValues = {
  name: 'Cena publika',
  instructions: '',
  kind: 'final',
  configuration: {
    selectedPlaces: 1,
    maxPlusVotes: 2,
    maxMinusVotes: 1,
    allowNegativeVotes: true,
  },
  juryGroupIds: ['public'],
  items: ['a', 'b', 'c', 'd'].map((teamId, displayOrder) => ({
    id: `entry-${teamId}`,
    teamId,
    displayOrder,
  })),
};

describe('category readiness', () => {
  it('requires more unique teams than the combined vote limits', () => {
    expect(categoryReadiness(values).issues).toEqual([]);
    const readiness = categoryReadiness({
      ...values,
      items: values.items.slice(0, 3),
    });
    expect(readiness.requiredTeams).toBe(4);
    expect(readiness.missingTeams).toBe(1);
    expect(readiness.issues.map(({ field }) => field)).toEqual(['items-title']);
  });

  it('links incomplete rules, missing jury permissions and legacy unlinked entries to their fields', () => {
    const readiness = categoryReadiness({
      ...values,
      configuration: { ...values.configuration, maxPlusVotes: null },
      juryGroupIds: [],
      items: [...values.items, { id: 'legacy', teamId: null, displayOrder: 4 }],
    });
    expect(readiness.teamIds.size).toBe(4);
    expect(readiness.issues.map(({ field }) => field)).toEqual([
      'configuration.maxPlusVotes',
      'juryGroupIds',
      'items.4.teamId',
    ]);
  });
});
