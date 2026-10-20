import { describe, it, expect } from 'vitest';
import type { JurorTableSnapshot } from '@d21/contracts';
import {
  canRebase,
  jurorRowIssues,
  parseJurorPaste,
  tableRows,
} from './juror-table-utils';
const groupT = '00000000-0000-4000-8000-000000000001',
  groupV = '00000000-0000-4000-8000-000000000002',
  id = '00000000-0000-4000-8000-000000000003',
  eventId = '00000000-0000-4000-8000-000000000004';
const base: JurorTableSnapshot = {
  version: 'a'.repeat(64),
  locked: false,
  groups: [
    { id: groupT, eventId, code: 'T', name: 'Custom T' },
    { id: groupV, eventId, code: 'V', name: 'Custom V' },
  ],
  jurors: [
    {
      id,
      eventId,
      juryGroupId: groupT,
      displayName: 'Name',
      access: 'none',
      createdAt: '2026-10-18T00:00:00.000Z',
      updatedAt: '2026-10-18T00:00:00.000Z',
    },
  ],
};
describe('juror paste and stale-roster safety', () => {
  it('preserves duplicate names, Unicode, quoted cells and literal formulas without identity matching', () => {
    const parsed = parseJurorPaste(
      'Žofie\tTechnická\r\nŽofie\t Veřejná \r\n"=Name\nwith ""quotes"""\tT\nLegacy\tV\n',
    );
    expect(parsed.error).toBeUndefined();
    expect(parsed.rows).toEqual([
      { displayName: 'Žofie', groupCode: 'T' },
      { displayName: 'Žofie', groupCode: 'V' },
      { displayName: '=Name\nwith "quotes"', groupCode: 'T' },
      { displayName: 'Legacy', groupCode: 'V' },
    ]);
  });
  it('rejects extra columns/malformed quotes and reports missing/invalid assignments and empty interior names', () => {
    expect(parseJurorPaste('A\tT\textra').error).toBeTruthy();
    expect(parseJurorPaste('"Unclosed').error).toBeTruthy();
    const rows = parseJurorPaste('Name\n\t\nName\tX').rows.map((row) => ({
      ...row,
      id,
    }));
    expect(jurorRowIssues(rows).map((issue) => issue.field)).toEqual([
      'groupCode',
      'displayName',
      'groupCode',
      'groupCode',
    ]);
  });
  it('permits name corrections after freeze, but blocks local additions and assignments', () => {
    const locked = { ...base, locked: true };
    expect(
      canRebase(
        [{ ...tableRows(base)[0]!, displayName: 'Correction' }],
        base,
        locked,
      ),
    ).toBe(true);
    expect(
      canRebase([{ ...tableRows(base)[0]!, groupCode: 'V' }], base, locked),
    ).toBe(false);
    expect(
      canRebase(
        [...tableRows(base), { id: 'new', displayName: 'New', groupCode: 'T' }],
        base,
        locked,
      ),
    ).toBe(false);
  });
  it('never recreates externally removed saved memberships with pending edits', () => {
    expect(
      canRebase([{ ...tableRows(base)[0]!, displayName: 'Local' }], base, {
        ...base,
        jurors: [],
      }),
    ).toBe(false);
    expect(canRebase(tableRows(base), base, { ...base, jurors: [] })).toBe(
      true,
    );
  });
  it('adopts untouched current assignments after a concurrent freeze, but never overwrites them through a changed whole row', () => {
    const latest = {
      ...base,
      locked: true,
      jurors: [{ ...base.jurors[0]!, juryGroupId: groupV }],
    };
    expect(canRebase(tableRows(base), base, latest)).toBe(true);
    expect(
      canRebase(
        [{ ...tableRows(base)[0]!, displayName: 'Local' }],
        base,
        latest,
      ),
    ).toBe(false);
  });
});
