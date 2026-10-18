import type { TeamTableRow, TeamTableIssue } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { controlClass } from './MutationForm';
import { rowChanged, teamFieldError } from './team-table-utils';

export function TeamRows({
  rows,
  baseById,
  issues,
  onChange,
  onRemove,
  showIds,
}: {
  showIds: boolean;
  rows: TeamTableRow[];
  baseById: ReadonlyMap<string, TeamTableRow>;
  issues: TeamTableIssue[];
  onChange: (id: string, field: 'name' | 'description', value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      {rows.length === 0 ? (
        <p className="mt-5 border border-dashed border-border p-6 text-muted-foreground">
          Zatím žádné týmy. Přidejte řádek nebo vložte tabulku.
        </p>
      ) : (
        <table className="team-table mt-5 w-full table-fixed text-left text-sm">
          <caption className="sr-only">
            Upravitelné názvy a popisy soutěžních týmů
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-32">
                Řádek / stav
              </th>
              <th scope="col">Název týmu</th>
              <th scope="col">Popis (nepovinný)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <th scope="row" className="align-top font-normal">
                  <span className="font-medium">{index + 1}.</span>{' '}
                  <span>
                    {!baseById.has(row.id)
                      ? 'Nový'
                      : rowChanged(row, baseById.get(row.id))
                        ? 'Změněný'
                        : 'Uložený'}
                  </span>
                  {showIds && (
                    <span className="mt-2 block break-all text-xs text-muted-foreground">
                      ID: {row.id}
                    </span>
                  )}
                  {!baseById.has(row.id) && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11 mt-1"
                      aria-label={`Odebrat nový řádek ${index + 1}`}
                      onClick={() => onRemove(row.id)}
                    >
                      Odebrat
                    </Button>
                  )}
                </th>
                {(['name', 'description'] as const).map((field) => {
                  const id = `team-${row.id}-${field}`,
                    invalid = issues.some(
                      (issue) =>
                        issue.rowId === row.id && issue.field === field,
                    );
                  const props = {
                    id,
                    value: row[field],
                    'aria-invalid': invalid,
                    'aria-describedby': invalid ? `${id}-error` : undefined,
                    onChange: (
                      event: React.ChangeEvent<
                        HTMLInputElement | HTMLTextAreaElement
                      >,
                    ) => onChange(row.id, field, event.target.value),
                  };
                  return (
                    <td key={field} className="align-top">
                      <label
                        htmlFor={id}
                        className="mb-2 block font-medium sm:sr-only"
                      >
                        {field === 'name' ? 'Název týmu' : 'Popis týmu'}, řádek{' '}
                        {index + 1}
                      </label>
                      {field === 'name' ? (
                        <Input {...props} autoComplete="off" />
                      ) : (
                        <textarea
                          {...props}
                          rows={2}
                          className={controlClass}
                        />
                      )}
                      {invalid && (
                        <p
                          id={`${id}-error`}
                          className="mt-2 text-sm text-destructive"
                        >
                          {teamFieldError(field)}
                        </p>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
