import {
  teamInputSchema,
  type TeamTableRow,
  type TeamTableIssue,
} from '@d21/contracts';

export function teamRowIssues(rows: TeamTableRow[]): TeamTableIssue[] {
  return rows.flatMap((row) => {
    const parsed = teamInputSchema.safeParse({
      name: row.name,
      description: row.description,
    });
    return parsed.success
      ? []
      : parsed.error.issues.map((issue) => ({
          rowId: row.id,
          field:
            issue.path[0] === 'name'
              ? ('name' as const)
              : ('description' as const),
        }));
  });
}

// Tab-separated clipboard text, including quoted tabs/newlines and escaped quotes.
// Never guess headers, identities or additional columns.
export function parseTeamPaste(text: string): {
  rows: { name: string; description: string }[];
  error?: string;
} {
  const records: string[][] = [];
  let record: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  const invalid = () => ({
    rows: [],
    error:
      'Zkontrolujte uvozovky a použijte nejvýše dva sloupce: název a popis.',
  });
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
    } else if (char === '\t' || char === '\n' || char === '\r') {
      record.push(cell);
      cell = '';
      closed = false;
      if (char !== '\t') {
        records.push(record);
        record = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (char === '"' && !cell && !closed) quoted = true;
    else if (closed || char === '"') return invalid();
    else cell += char;
  }
  if (quoted) return invalid();
  record.push(cell);
  records.push(record);
  while (records.length && records.at(-1)!.every((value) => value === ''))
    records.pop();
  if (records.some((values) => values.length > 2)) return invalid();
  return {
    rows: records.map(([name = '', description = '']) => ({
      name,
      description,
    })),
  };
}

export function rowChanged(row: TeamTableRow, baseline?: TeamTableRow) {
  return (
    !baseline ||
    row.name !== baseline.name ||
    row.description !== baseline.description
  );
}

export const teamFieldError = (field: 'name' | 'description') =>
  field === 'name'
    ? 'Zadejte název o délce 1–200 znaků.'
    : 'Popis může mít nejvýše 5 000 znaků.';
