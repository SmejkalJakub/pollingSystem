import { describe, it, expect } from 'vitest';
import type { VotingSetupSnapshot } from '@d21/contracts';
import { rebaseSetup, setupValues } from './voting-setup-utils';
const blank = (): VotingSetupSnapshot => ({
  version: '0'.repeat(64),
  voting: null,
  editable: true,
  groups: [],
  teams: [],
  juryGroupIds: [],
  items: [],
});
const item = (id: string, displayOrder = 0) => ({
  id,
  eventId: 'event',
  votingId: 'voting',
  teamId: `team-${id}`,
  name: 'Same name',
  description: '',
  displayOrder,
});
describe('explicit category comparison', () => {
  it('keeps changed local fields while adopting untouched remote fields and added entries', () => {
    const base = blank(),
      local = { ...setupValues(base), name: 'Local' };
    const current = { ...blank(), items: [item('remote')] };
    expect(rebaseSetup(base, local, current)).toEqual({
      ...setupValues(current),
      name: 'Local',
    });
  });
  it('keeps whole changed entry rows by identity despite equal display names', () => {
    const base = { ...blank(), items: [item('a'), item('b')] },
      local = setupValues(base);
    local.items[0]!.displayOrder = 8;
    const current = {
      ...blank(),
      items: [item('a', 2), item('b', 3), item('c', 4)],
    };
    expect(
      rebaseSetup(base, local, current)?.items.map((row) => [
        row.id,
        row.displayOrder,
      ]),
    ).toEqual([
      ['a', 8],
      ['b', 3],
      ['c', 4],
    ]);
  });
  it('preserves local new IDs after an uncertain creation and retains later local changes', () => {
    const base = blank(),
      local = setupValues(base);
    local.items = [{ id: 'a', teamId: 'team-a', displayOrder: 7 }];
    expect(
      rebaseSetup(base, local, { ...blank(), items: [item('a')] })?.items,
    ).toEqual(local.items);
  });
  it('refuses edits after a freeze or externally removed edited entry', () => {
    const base = { ...blank(), items: [item('a')] },
      local = setupValues(base);
    local.items[0]!.displayOrder = 8;
    expect(
      rebaseSetup(base, local, { ...blank(), editable: false }),
    ).toBeNull();
    expect(rebaseSetup(base, local, blank())).toBeNull();
  });
});
