import { juryGroupLabel } from '@d21/contracts';
import type { ReactNode } from 'react';
import type {
  JurorTableRow,
  JurorTableIssue,
  JurorTableSnapshot,
} from '@d21/contracts';
import { rowChanged, jurorFieldError } from './juror-table-utils';
import { JurorControls } from './JurorControls';

export function JurorRows({
  editingDisabled,
  onPanelChange,
  rows,
  baseById,
  issues,
  onChange,
  onRemove,
  showIds,
  locked,
  snapshot,
  disabled,
  copyDisabled,
  reload,
  onExpired,
  addRow,
}: {
  editingDisabled: boolean;
  onPanelChange: (open: boolean) => void;
  rows: JurorTableRow[];
  baseById: ReadonlyMap<string, JurorTableRow>;
  issues: JurorTableIssue[];
  onChange: (
    id: string,
    field: 'displayName' | 'groupCode',
    value: string,
  ) => void;
  onRemove: (id: string) => void;
  showIds: boolean;
  locked: boolean;
  snapshot: JurorTableSnapshot;
  disabled: boolean;
  copyDisabled: boolean;
  reload: (focusFeedback?: boolean) => void;
  onExpired: () => void;
  addRow: ReactNode;
}) {
  return (
    <div
      className="roster-scroll"
      tabIndex={0}
      role="region"
      aria-label="Seznam porotců"
    >
      <table className="roster-table" data-kind="jurors">
        <caption className="sr-only">Tabulka porotců</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Jméno porotce</th>
            <th scope="col">Porota</th>
            <th scope="col">Osobní odkaz</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="roster-empty">
                Zatím žádní porotci. Napište jméno do řádku níže nebo vložte
                tabulku.
              </td>
            </tr>
          )}
          {rows.map((row, index) => {
            const juror = snapshot.jurors.find((value) => value.id === row.id);
            const rowIssues = issues.filter((issue) => issue.rowId === row.id);
            return (
              <tr
                key={row.id}
                data-new={!juror}
                data-edited={
                  Boolean(juror) && rowChanged(row, baseById.get(row.id))
                }
                data-invalid={rowIssues.length > 0}
              >
                <th scope="row">
                  {juror ? (
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
                {(['displayName', 'groupCode'] as const).map((field) => {
                  const id = `juror-${row.id}-${field}`;
                  const invalid = rowIssues.some(
                    (issue) => issue.field === field,
                  );
                  const fixedGroup =
                    field === 'groupCode' && locked && Boolean(juror);
                  const fieldLabel =
                    field === 'displayName' ? 'Jméno porotce' : 'Část poroty';
                  const props = {
                    id,
                    value: row[field],
                    'aria-label': `${fieldLabel}, řádek ${index + 1}`,
                    'aria-invalid': invalid,
                    'aria-describedby': invalid ? `${id}-error` : undefined,
                    disabled: editingDisabled,
                    onChange: (
                      event: React.ChangeEvent<
                        HTMLInputElement | HTMLSelectElement
                      >,
                    ) => onChange(row.id, field, event.target.value),
                  };
                  return (
                    <td key={field}>
                      {field === 'displayName' && (
                        <input
                          {...props}
                          className="roster-inline"
                          autoComplete="off"
                        />
                      )}
                      {fixedGroup && (
                        <span
                          id={id}
                          tabIndex={invalid ? -1 : undefined}
                          className="roster-group-pill"
                        >
                          {juryGroupLabel(row.groupCode)}
                        </span>
                      )}
                      {field === 'groupCode' && !fixedGroup && (
                        <select {...props}>
                          <option value="">Vyberte</option>
                          <option value="T">Technická</option>
                          <option value="V">Veřejná</option>
                        </select>
                      )}
                      {invalid && (
                        <p id={`${id}-error`} className="roster-field-error">
                          {jurorFieldError(field)}
                        </p>
                      )}
                    </td>
                  );
                })}
                <td>
                  {juror && (
                    <JurorControls
                      onPanelChange={onPanelChange}
                      juror={juror}
                      locked={snapshot.locked}
                      disabled={disabled}
                      copyDisabled={copyDisabled}
                      reload={reload}
                      onExpired={onExpired}
                    />
                  )}
                  {!juror && (
                    <div className="roster-pending-link">
                      <span>Odkaz vznikne po uložení</span>
                      <button
                        type="button"
                        className="roster-remove-new ml-auto"
                        aria-label={`Odebrat nový řádek ${index + 1}`}
                        title="Odebrat nový řádek"
                        disabled={editingDisabled}
                        onClick={() => onRemove(row.id)}
                      >
                        <span aria-hidden="true">✕</span>
                      </button>
                    </div>
                  )}
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
