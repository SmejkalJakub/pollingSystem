import type {
  JurorTableRow,
  JurorTableIssue,
  JurorTableSnapshot,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { controlClass } from './MutationForm';
import { rowChanged, jurorFieldError } from './juror-table-utils';
import { JurorControls } from './JurorControls';
export function JurorRows({
  editingDisabled,
  onPanelChange,
  query,
  rows,
  baseById,
  issues,
  onChange,
  onRemove,
  showIds,
  locked,
  snapshot,
  disabled,
  reload,
  onExpired,
}: {
  editingDisabled: boolean;
  onPanelChange: (open: boolean) => void;
  query: string;
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
  reload: (focusFeedback?: boolean) => void;
  onExpired: () => void;
}) {
  return rows.length === 0 ? (
    <p className="mt-5 border border-dashed border-border p-6 text-muted-foreground">
      Zatím žádní porotci. Přidejte řádek nebo vložte tabulku.
    </p>
  ) : (
    <table className="team-table juror-table mt-5 w-full table-fixed text-left text-sm">
      <caption className="sr-only">
        Upravitelná jména a přiřazení porotců k Technické a Veřejné porotě
      </caption>
      <thead>
        <tr>
          <th scope="col" className="w-28">
            Řádek / stav
          </th>
          <th scope="col">Jméno porotce</th>
          <th scope="col" className="sm:w-36">
            Část poroty
          </th>
          <th scope="col">Odkaz / členství</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const juror = snapshot.jurors.find((value) => value.id === row.id);
          return (
            <tr
              key={row.id}
              hidden={
                !row.displayName
                  .toLocaleLowerCase('cs')
                  .includes(query.toLocaleLowerCase('cs'))
              }
            >
              <th scope="row" className="align-top font-normal">
                <span className="font-medium">{index + 1}.</span>{' '}
                {!juror
                  ? 'Nový'
                  : rowChanged(row, baseById.get(row.id))
                    ? 'Změněný'
                    : 'Uložený'}
                {showIds && (
                  <span className="mt-2 block break-all text-xs text-muted-foreground">
                    ID: {row.id}
                  </span>
                )}
                {!juror && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-1 min-h-11"
                    aria-label={`Odebrat nový řádek ${index + 1}`}
                    disabled={editingDisabled}
                    onClick={() => onRemove(row.id)}
                  >
                    Odebrat
                  </Button>
                )}
              </th>
              {(['displayName', 'groupCode'] as const).map((field) => {
                const id = `juror-${row.id}-${field}`,
                  invalid = issues.some(
                    (issue) => issue.rowId === row.id && issue.field === field,
                  );
                const props = {
                  id,
                  value: row[field],
                  'aria-invalid': invalid,
                  'aria-describedby': invalid ? `${id}-error` : undefined,
                  onChange: (
                    event: React.ChangeEvent<
                      HTMLInputElement | HTMLSelectElement
                    >,
                  ) => onChange(row.id, field, event.target.value),
                };
                return (
                  <td key={field} className="align-top">
                    <label
                      htmlFor={id}
                      className="mb-2 block font-medium sm:sr-only"
                    >
                      {field === 'displayName'
                        ? 'Jméno porotce'
                        : 'Část poroty'}
                      , řádek {index + 1}
                    </label>
                    {field === 'displayName' ? (
                      <Input
                        {...props}
                        disabled={editingDisabled}
                        autoComplete="off"
                      />
                    ) : (
                      <select
                        {...props}
                        disabled={locked || editingDisabled}
                        className={controlClass}
                      >
                        <option value="">Vyberte</option>
                        <option value="T">Technická</option>
                        <option value="V">Veřejná</option>
                      </select>
                    )}
                    {invalid && (
                      <p
                        id={`${id}-error`}
                        className="mt-2 text-sm text-destructive"
                      >
                        {jurorFieldError(field)}
                      </p>
                    )}
                  </td>
                );
              })}
              <td className="align-top">
                {juror ? (
                  <JurorControls
                    onPanelChange={onPanelChange}
                    juror={juror}
                    locked={snapshot.locked}
                    disabled={disabled}
                    reload={reload}
                    onExpired={onExpired}
                  />
                ) : (
                  <p className="text-muted-foreground">
                    Odkaz se vytvoří automaticky při uložení. Pak jej můžete
                    rovnou zkopírovat.
                  </p>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
