import { juryGroupLabel } from '@d21/contracts';
import { useEffect, useRef } from 'react';
import { teamsByName } from './team-table-utils';
import type { VotingSetupSnapshot, VotingSetupValues } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { categoryReadiness, focusCategoryField } from './category-readiness';
import { controlClass } from './MutationForm';
import {
  addAllEventTeams,
  configurationKeys,
  setupFieldError,
  setupValues,
} from './voting-setup-utils';

export function VotingSetupFields({
  values,
  snapshot,
  onChange,
  issues,
  fieldId,
  groupCounts,
}: {
  values: VotingSetupValues;
  snapshot: VotingSetupSnapshot;
  onChange: (values: VotingSetupValues) => void;
  issues: string[];
  fieldId: (field: string) => string;
  groupCounts?: Map<string, number>;
}) {
  const focusRow = useRef<string>(null);
  const teams = teamsByName(snapshot.teams);
  useEffect(() => {
    if (focusRow.current) {
      focusCategoryField(focusRow.current);
      focusRow.current = null;
    }
  }, [values.items]);
  function props(field: string) {
    return {
      id: fieldId(field),
      'aria-invalid': issues.includes(field),
      'aria-describedby': issues.includes(field)
        ? `${fieldId(field)}-error`
        : undefined,
    };
  }
  function error(field: string) {
    return issues.includes(field) ? (
      <p
        id={`${fieldId(field)}-error`}
        className="mt-2 text-sm text-destructive"
      >
        {setupFieldError(field)}
      </p>
    ) : null;
  }
  const readiness = categoryReadiness(values);
  const initialConfiguration = setupValues(snapshot).configuration;
  const savedIds = new Set(snapshot.items.map(({ id }) => id));
  const ordered = [...values.items].sort(
    (a, b) =>
      (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.id.localeCompare(b.id),
  );
  const teamNames = new Map(teams.map(({ id, name }) => [id, name]));
  const nameCounts = new Map<string, number>();
  for (const { name } of teams) {
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  function teamName(teamId: string | null) {
    if (!teamId) {
      return 'Tým není vybrán';
    }
    const name = teamNames.get(teamId) ?? 'Tým není dostupný';
    if ((nameCounts.get(name) ?? 0) > 1) {
      return `${name} · ${teamId}`;
    }
    return name;
  }
  function move(index: number, offset: number) {
    const next = [...ordered];
    const other = index + offset;
    [next[index], next[other]] = [next[other]!, next[index]!];
    const orders = new Map(next.map((item, order) => [item.id, order]));
    onChange({
      ...values,
      items: values.items.map((item) => ({
        ...item,
        displayOrder: orders.get(item.id)!,
      })),
    });
    focusRow.current = fieldId(`move-${next[other]!.id}-${offset}`);
    if (other + offset < 0 || other + offset >= next.length) {
      focusRow.current = fieldId(`move-${next[other]!.id}-${-offset}`);
    }
  }
  function numberField(
    key: 'selectedPlaces' | 'maxPlusVotes' | 'maxMinusVotes',
    label: string,
  ) {
    const field = `configuration.${key}`;
    return (
      <div>
        <label
          htmlFor={fieldId(field)}
          className="mb-2 block text-sm font-semibold"
        >
          {label}
        </label>
        <input
          {...props(field)}
          className={controlClass}
          type="number"
          step="1"
          disabled={
            key === 'maxMinusVotes' &&
            values.configuration.allowNegativeVotes === false
          }
          value={values.configuration[key] ?? ''}
          onChange={(event) =>
            onChange({
              ...values,
              configuration: {
                ...values.configuration,
                [key]:
                  event.target.value === '' ? null : Number(event.target.value),
              },
            })
          }
        />
        {error(field)}
      </div>
    );
  }
  function segments(
    field: string,
    legend: string,
    selected: string,
    options: [string, string][],
    select: (value: string) => void,
  ) {
    return (
      <fieldset {...props(field)} tabIndex={-1}>
        <legend className="mb-2 text-sm font-semibold">{legend}</legend>
        <div className="flex gap-2">
          {options.map(([value, label]) => (
            <label
              key={value}
              className="category-choice category-segment relative cursor-pointer"
            >
              <input
                className="absolute inset-0 size-full cursor-pointer opacity-0"
                type="radio"
                name={fieldId(field)}
                checked={selected === value}
                onChange={() => select(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {error(field)}
      </fieldset>
    );
  }
  function title(
    number: number,
    label: string,
    missing: boolean,
    field: string,
  ) {
    return (
      <h2 id={fieldId(field)} tabIndex={-1} className="font-semibold">
        <span className="text-muted-foreground" aria-hidden="true">
          {number}{' '}
        </span>
        {label}
        {missing && <span className="text-sm text-warning-text"> · chybí</span>}
      </h2>
    );
  }
  const basicMissing =
    !values.name.trim() ||
    !values.kind ||
    values.configuration.selectedPlaces === null;
  const rulesMissing = !readiness.limits.success;
  const juryMissing = !values.juryGroupIds.length;
  const teamsMissing =
    readiness.missingTeams > 0 ||
    readiness.unassigned > 0 ||
    readiness.duplicates > 0;
  const negatives = values.configuration.allowNegativeVotes;
  return (
    <>
      <section
        className="category-panel space-y-4"
        data-incomplete={basicMissing}
        aria-labelledby={fieldId('basic-title')}
      >
        {title(1, 'Základ', basicMissing, 'basic-title')}
        <div>
          <label
            htmlFor={fieldId('name')}
            className="mb-2 block text-sm font-semibold"
          >
            Název
          </label>
          <input
            {...props('name')}
            className={controlClass}
            value={values.name}
            maxLength={200}
            onChange={(event) =>
              onChange({ ...values, name: event.target.value })
            }
          />
          {error('name')}
        </div>
        <div>
          <label
            htmlFor={fieldId('instructions')}
            className="mb-2 block text-sm font-semibold"
          >
            Instrukce pro porotce (nepovinné)
          </label>
          <textarea
            {...props('instructions')}
            className={controlClass}
            rows={3}
            maxLength={5000}
            value={values.instructions}
            onChange={(event) =>
              onChange({ ...values, instructions: event.target.value })
            }
          />
          {error('instructions')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {segments(
            'kind',
            'Typ',
            values.kind,
            [
              ['selection', 'Výběrové kolo'],
              ['final', 'Finále'],
            ],
            (kind) => onChange({ ...values, kind }),
          )}
          {numberField(
            'selectedPlaces',
            values.kind === 'selection'
              ? 'Počet postupujících týmů'
              : 'Počet vítězů',
          )}
        </div>
      </section>
      <section
        className="category-panel space-y-4"
        data-incomplete={rulesMissing}
        aria-labelledby={fieldId('rules-title')}
      >
        {title(2, 'Pravidla hlasů', rulesMissing, 'rules-title')}
        <div className="grid items-start gap-4 sm:grid-cols-3">
          {numberField('maxPlusVotes', 'Kladných hlasů na porotce')}
          {segments(
            'configuration.allowNegativeVotes',
            'Záporné hlasy',
            negatives === null ? '' : String(negatives),
            [
              ['true', 'Povolit'],
              ['false', 'Zakázat'],
            ],
            (value) =>
              onChange({
                ...values,
                configuration: {
                  ...values.configuration,
                  allowNegativeVotes: value === 'true',
                  maxMinusVotes:
                    value === 'false' ? 0 : values.configuration.maxMinusVotes,
                },
              }),
          )}
          {numberField('maxMinusVotes', 'Záporných hlasů')}
        </div>
        {configurationKeys.every((key) => initialConfiguration[key] === null) &&
          configurationKeys.some(
            (key) => values.configuration[key] !== null,
          ) && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() =>
                onChange({ ...values, configuration: initialConfiguration })
              }
            >
              Ponechat pravidla nevyplněná
            </Button>
          )}
        <p className="text-sm text-muted-foreground">
          Při povolení platí: každý záporný hlas vyžaduje dva rozdané kladné.
        </p>
      </section>
      <section
        className="category-panel space-y-4"
        data-incomplete={juryMissing}
        aria-labelledby={fieldId('jury-title')}
      >
        {title(3, 'Kdo hlasuje', juryMissing, 'jury-title')}
        <div
          {...props('juryGroupIds')}
          tabIndex={-1}
          className="grid gap-2 sm:grid-cols-2"
        >
          {snapshot.groups.map((group) => (
            <label key={group.id} className="category-choice cursor-pointer">
              <input
                type="checkbox"
                className="size-5 shrink-0 accent-primary"
                checked={values.juryGroupIds.includes(group.id)}
                onChange={(event) =>
                  onChange({
                    ...values,
                    juryGroupIds: event.target.checked
                      ? [...values.juryGroupIds, group.id]
                      : values.juryGroupIds.filter((id) => id !== group.id),
                  })
                }
              />
              <span>
                <strong title={group.name}>
                  {juryGroupLabel(group.code)} porota
                </strong>
                {groupCounts && (
                  <span className="block text-sm text-muted-foreground">
                    {groupCounts.get(group.id) ?? 0} porotců
                  </span>
                )}
              </span>
            </label>
          ))}
          {!snapshot.groups.length && (
            <p className="text-sm text-muted-foreground">
              Připravte porotu v části Porotci.
            </p>
          )}
        </div>
        {error('juryGroupIds')}
      </section>
      <section
        className="category-panel space-y-4"
        data-incomplete={teamsMissing}
        aria-labelledby={fieldId('items-title')}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title(
            4,
            `Týmy v kategorii · ${readiness.teamIds.size} z ${teams.length}`,
            teamsMissing,
            'items-title',
          )}
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={teams.length === readiness.teamIds.size}
            onClick={() => {
              focusRow.current = fieldId('items-title');
              onChange(addAllEventTeams(values, teams));
            }}
          >
            Přidat všechny týmy eventu
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Zaškrtnutím tým přidáte na konec pořadí. Pořadí v kategorii (a u
          porotců) změníte šipkami v seznamu níže. Uložené týmy z kategorie
          nelze odebrat — jejich zaškrtnutí je pevné.
        </p>
        {teams.length === 0 && (
          <p className="text-sm text-muted-foreground">
            V eventu zatím nejsou týmy.
          </p>
        )}
        <ul className="grid gap-2 sm:grid-cols-2">
          {teams.map((team) => {
            const entry = values.items.find((item) => item.teamId === team.id);
            const saved = values.items.some(
              (item) => item.teamId === team.id && savedIds.has(item.id),
            );
            return (
              <li key={team.id} className="min-w-0">
                <label className="category-choice">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-primary"
                    checked={Boolean(entry)}
                    disabled={saved}
                    onChange={(event) => {
                      if (event.target.checked) {
                        onChange(addAllEventTeams(values, [team]));
                      } else {
                        onChange({
                          ...values,
                          items: values.items.filter(
                            (item) => item.teamId !== team.id,
                          ),
                        });
                      }
                    }}
                  />
                  <span>{teamName(team.id)}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {ordered.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold">Pořadí na lístku</h3>
            <ol className="mt-2 divide-y divide-border">
              {ordered.map((item, index) => {
                const name = teamName(item.teamId);
                return (
                  <li key={item.id} className="flex items-center gap-2 py-1">
                    <span className="min-w-0 flex-1 text-sm">
                      {index + 1}. {name}
                    </span>
                    {[-1, 1].map((offset) => (
                      <Button
                        key={offset}
                        id={fieldId(`move-${item.id}-${offset}`)}
                        type="button"
                        variant="outline"
                        className="size-11"
                        aria-label={`Posunout ${name} ${offset < 0 ? 'výš' : 'níž'}`}
                        disabled={
                          index + offset < 0 || index + offset >= ordered.length
                        }
                        onClick={() => move(index, offset)}
                      >
                        {offset < 0 ? '↑' : '↓'}
                      </Button>
                    ))}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        <details className="border-t border-border pt-2">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
            Upravit přiřazení a přesné pořadí
          </summary>
          <div className="space-y-4">
            <Button
              type="button"
              id={fieldId('add-entry')}
              variant="outline"
              className="min-h-11"
              disabled={snapshot.teams.length === 0}
              onClick={() => {
                focusRow.current = fieldId(
                  `items.${values.items.length}.teamId`,
                );
                onChange({
                  ...values,
                  items: [
                    ...values.items,
                    {
                      id: crypto.randomUUID(),
                      teamId: null,
                      displayOrder: values.items.length,
                    },
                  ],
                });
              }}
            >
              Přidat tým
            </Button>
            <p className="text-sm text-muted-foreground">
              Každý tým může být zařazen jednou. Uložené položky lze přeřadit
              nebo změnit jejich pořadí; nemažou se. Týmy a jejich popisy
              upravíte v části Týmy. Přidání všech týmů doplní pouze chybějící
              týmy; změny se uloží tlačítkem Uložit kategorii.
            </p>
            {snapshot.teams.length === 0 && (
              <p className="text-sm text-muted-foreground">
                V eventu zatím nejsou týmy.
              </p>
            )}
            {values.items.map((item, index) => (
              <div
                className="grid min-w-0 gap-4 border-b border-border pb-4 sm:grid-cols-[minmax(0,1fr)_9rem_auto]"
                key={item.id}
              >
                <div className="min-w-0">
                  <label
                    htmlFor={fieldId(`items.${index}.teamId`)}
                    className="mb-2 block text-sm font-medium"
                  >
                    Tým, položka {index + 1}
                  </label>
                  <select
                    {...props(`items.${index}.teamId`)}
                    className={controlClass}
                    value={item.teamId ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...values,
                        items: values.items.map((row) =>
                          row.id === item.id
                            ? { ...row, teamId: e.target.value || null }
                            : row,
                        ),
                      })
                    }
                  >
                    <option value="">Vyberte tým</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {teamName(team.id)}
                      </option>
                    ))}
                  </select>
                  {error(`items.${index}.teamId`)}
                </div>
                <div>
                  <label
                    htmlFor={fieldId(`items.${index}.displayOrder`)}
                    className="mb-2 block text-sm font-medium"
                  >
                    Pořadí, položka {index + 1}
                  </label>
                  <input
                    {...props(`items.${index}.displayOrder`)}
                    className={controlClass}
                    type="number"
                    step="1"
                    value={item.displayOrder ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...values,
                        items: values.items.map((row) =>
                          row.id === item.id
                            ? {
                                ...row,
                                displayOrder:
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                              }
                            : row,
                        ),
                      })
                    }
                  />
                  {error(`items.${index}.displayOrder`)}
                </div>
                {!snapshot.items.some((row) => row.id === item.id) && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 self-end"
                    onClick={() => {
                      focusRow.current = fieldId(
                        values.items.length > 1
                          ? `items.${Math.min(index, values.items.length - 2)}.teamId`
                          : 'add-entry',
                      );
                      onChange({
                        ...values,
                        items: values.items.filter((row) => row.id !== item.id),
                      });
                    }}
                  >
                    Odebrat novou položku {index + 1}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </details>
      </section>
    </>
  );
}
