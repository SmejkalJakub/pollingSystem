import { describe, expect, it } from 'vitest';
import { parseTeamPaste, rowChanged, teamRowIssues } from './team-table-utils';

const id = '00000000-0000-4000-8000-000000000001';
describe('team spreadsheet preview', () => {
  it('preserves duplicate names, Unicode, empty descriptions and literal spreadsheet operators', () => {
    expect(parseTeamPaste('Český tým\t=SUM(A1)\r\nČeský tým\t\r\n')).toEqual({
      rows: [
        { name: 'Český tým', description: '=SUM(A1)' },
        { name: 'Český tým', description: '' },
      ],
    });
  });
  it('preserves quoted multiline/tab cells and escaped quotes', () => {
    expect(parseTeamPaste('"Tým\tA"\t"První\nřádek ""citace"""')).toEqual({
      rows: [{ name: 'Tým\tA', description: 'První\nřádek "citace"' }],
    });
  });
  it.each(['A\tB\tC', '"A', 'A"B', '"A"x\tB'])(
    'rejects ambiguous paste without truncating columns: %s',
    (text) => {
      expect(parseTeamPaste(text)).toMatchObject({
        rows: [],
        error: expect.any(String),
      });
    },
  );
  it('does not guess a header and keeps interior blank rows for validation', () => {
    expect(parseTeamPaste('Název\tPopis\n\nA')).toEqual({
      rows: [
        { name: 'Název', description: 'Popis' },
        { name: '', description: '' },
        { name: 'A', description: '' },
      ],
    });
    expect(parseTeamPaste('')).toEqual({ rows: [] });
  });
  it('reports every invalid row field without mutating input', () => {
    const row = Object.freeze({
      id,
      name: '  ',
      description: 'x'.repeat(5001),
    });
    expect(teamRowIssues([row])).toEqual([
      { rowId: id, field: 'name' },
      { rowId: id, field: 'description' },
    ]);
    expect(rowChanged(row, row)).toBe(false);
    expect(rowChanged({ ...row, name: 'new' }, row)).toBe(true);
  });
});
