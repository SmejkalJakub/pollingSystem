import type { ReactNode } from 'react';
import type { TeamTableRow, TeamTableIssue } from '@d21/contracts';
import { rowChanged, teamFieldError } from './team-table-utils';

export function TeamRows({
  rows,
  categoryCounts,
  baseById,
  issues,
  onChange,
  onRemove,
  showIds,
  addRow,
}: {
  showIds: boolean;
  rows: TeamTableRow[];
  categoryCounts: Record<string, number>;
  baseById: ReadonlyMap<string, TeamTableRow>;
  issues: TeamTableIssue[];
  onChange: (id: string, field: 'name' | 'description', value: string) => void;
  onRemove: (id: string) => void;
  addRow: ReactNode;
}) {
  return (
    <div
      className="roster-scroll"
      tabIndex={0}
      role="region"
      aria-label="Seznam týmů"
    >
      <table className="roster-table" data-kind="teams">
        <caption className="sr-only">Tabulka týmů</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Název týmu</th>
            <th scope="col">
              Popis{' '}
              <span className="font-normal">(nepovinný, vidí porotci)</span>
            </th>
            <th scope="col">V kategoriích</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="roster-empty">
                Zatím žádné týmy. Napište název do řádku níže nebo vložte
                tabulku.
              </td>
            </tr>
          )}
          {rows.map((row, index) => {
            const saved = baseById.has(row.id);
            const rowIssues = issues.filter((issue) => issue.rowId === row.id);
            return (
              <tr
                key={row.id}
                data-new={!saved}
                data-edited={saved && rowChanged(row, baseById.get(row.id))}
                data-invalid={rowIssues.length > 0}
              >
                <th scope="row">
                  {saved ? (
                    index + 1
                  ) : (
                    <span className="roster-new-badge">NOVÝ</span>
                  )}
                  <span className="sr-only">, řádek {index + 1}</span>
                  {showIds && (
                    <span className="mt-2 block break-all text-xs">
                      ID: {row.id}
                    </span>
                  )}
                </th>
                {(['name', 'description'] as const).map((field) => {
                  const id = `team-${row.id}-${field}`;
                  const invalid = rowIssues.some(
                    (issue) => issue.field === field,
                  );
                  const fieldLabel =
                    field === 'name' ? 'Název týmu' : 'Popis týmu';
                  const props = {
                    id,
                    value: row[field],
                    'aria-label': `${fieldLabel}, řádek ${index + 1}`,
                    'aria-invalid': invalid,
                    'aria-describedby': invalid ? `${id}-error` : undefined,
                    onChange: (
                      event: React.ChangeEvent<
                        HTMLInputElement | HTMLTextAreaElement
                      >,
                    ) => onChange(row.id, field, event.target.value),
                  };
                  return (
                    <td key={field}>
                      {field === 'name' && (
                        <input
                          {...props}
                          className="roster-inline font-semibold"
                          autoComplete="off"
                        />
                      )}
                      {field === 'description' && (
                        <textarea
                          {...props}
                          rows={1}
                          placeholder="Bez popisu"
                          className="roster-inline"
                        />
                      )}
                      {invalid && (
                        <p id={`${id}-error`} className="roster-field-error">
                          {teamFieldError(field)}
                        </p>
                      )}
                    </td>
                  );
                })}
                <td className="tabular-nums">
                  <div className="roster-pending-link text-foreground">
                    <span>{categoryCounts[row.id] ?? 0}</span>
                    {!saved && (
                      <button
                        type="button"
                        className="roster-remove-new ml-auto"
                        aria-label={`Odebrat nový řádek ${index + 1}`}
                        title="Odebrat nový řádek"
                        onClick={() => onRemove(row.id)}
                      >
                        <span aria-hidden="true">✕</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {addRow}
        </tbody>
      </table>
    </div>
  );
}
