import {
  jurorTableFieldsSchema,
  type JurorTableRow,
  type JurorTableIssue,
  type JurorTableSnapshot,
} from '@d21/contracts';
import { parseTeamPaste } from './team-table-utils';
export function jurorRowIssues(rows: JurorTableRow[]): JurorTableIssue[] {
  return rows.flatMap(({ id, displayName, groupCode }) => {
    const parsed = jurorTableFieldsSchema.safeParse({ displayName, groupCode });
    return parsed.success
      ? []
      : parsed.error.issues.map((issue) => ({
          rowId: id,
          field:
            issue.path[0] === 'displayName'
              ? ('displayName' as const)
              : ('groupCode' as const),
        }));
  });
}
export function parseJurorPaste(text: string) {
  const result = parseTeamPaste(text);
  return {
    error: result.error
      ? 'Zkontrolujte uvozovky a použijte právě dva sloupce: jméno a Technická nebo Veřejná (také T nebo V).'
      : undefined,
    rows: result.rows.map((row) => ({
      displayName: row.name,
      groupCode:
        row.description.trim() === 'Technická'
          ? 'T'
          : row.description.trim() === 'Veřejná'
            ? 'V'
            : row.description.trim(),
    })),
  };
}
export const jurorFieldError = (field: 'displayName' | 'groupCode') =>
  field === 'displayName'
    ? 'Zadejte jméno o délce 1–200 znaků.'
    : 'Vyberte Technickou nebo Veřejnou porotu.';
export const rowChanged = (row: JurorTableRow, base?: JurorTableRow) =>
  !base ||
  row.displayName !== base.displayName ||
  row.groupCode !== base.groupCode;
export const tableRows = (snapshot: JurorTableSnapshot): JurorTableRow[] =>
  snapshot.jurors.map((juror) => ({
    id: juror.id,
    displayName: juror.displayName,
    groupCode: snapshot.groups.find((group) => group.id === juror.juryGroupId)!
      .code,
  }));
// Never recreate an externally removed saved membership or carry forbidden assignments across a freeze.
export function canRebase(
  rows: JurorTableRow[],
  base: JurorTableSnapshot,
  latest: JurorTableSnapshot,
) {
  const current = new Map(tableRows(latest).map((row) => [row.id, row]));
  const old = new Map(tableRows(base).map((row) => [row.id, row]));
  return rows.every((row) => {
    const saved = current.get(row.id);
    if (old.has(row.id) && !saved && rowChanged(row, old.get(row.id)))
      return false;
    return (
      !rowChanged(row, old.get(row.id)) ||
      !latest.locked ||
      (!!saved && row.groupCode === saved.groupCode)
    );
  });
}
