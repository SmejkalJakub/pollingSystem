import { juryGroupLabel } from '@d21/contracts';
import { useEffect, useRef } from 'react';
import type { VotingSetupSnapshot, VotingSetupValues } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { controlClass } from './MutationForm';
import {
  configurationKeys,
  setupFieldLabels,
  setupFieldError,
} from './voting-setup-utils';

export function VotingSetupFields({
  values,
  snapshot,
  onChange,
  issues,
  fieldId,
}: {
  values: VotingSetupValues;
  snapshot: VotingSetupSnapshot;
  onChange: (values: VotingSetupValues) => void;
  issues: string[];
  fieldId: (field: string) => string;
}) {
  const focusRow = useRef<string>(null);
  useEffect(() => {
    if (focusRow.current) {
      document.getElementById(focusRow.current)?.focus();
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
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor={fieldId('name')}
            className="mb-2 block text-sm font-medium"
          >
            Název hlasování
          </label>
          <input
            {...props('name')}
            className={controlClass}
            value={values.name}
            maxLength={200}
            onChange={(e) => onChange({ ...values, name: e.target.value })}
          />
          {error('name')}
        </div>
        <div>
          <label
            htmlFor={fieldId('kind')}
            className="mb-2 block text-sm font-medium"
          >
            Typ hlasování
          </label>
          <select
            {...props('kind')}
            className={controlClass}
            value={values.kind}
            onChange={(e) => onChange({ ...values, kind: e.target.value })}
          >
            <option value="">Vyberte typ</option>
            <option value="selection">Výběrové kolo</option>
            <option value="final">Finálová kategorie</option>
          </select>
          {error('kind')}
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor={fieldId('instructions')}
            className="mb-2 block text-sm font-medium"
          >
            Instrukce pro porotu
          </label>
          <textarea
            {...props('instructions')}
            className={controlClass}
            rows={3}
            maxLength={5000}
            value={values.instructions}
            onChange={(e) =>
              onChange({ ...values, instructions: e.target.value })
            }
          />
          {error('instructions')}
        </div>
      </div>
      <section
        className="space-y-4 border-t border-border pt-5"
        aria-labelledby={fieldId('rules-title')}
      >
        <h4 id={fieldId('rules-title')} className="font-semibold">
          Pravidla hlasování
        </h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Limity zadejte výslovně. Kladných hlasů musí být více než vybíraných
          míst; záporných nejvýše polovina kladných. Každý záporný hlas vyžaduje
          dva skutečně udělené kladné hlasy. Hlasy není nutné využít všechny.
          Před aktivací musí být počet míst i součet limitů menší než počet
          týmů.
        </p>
        <p className="text-sm text-muted-foreground">
          Nový koncept může mít všechna pravidla prázdná. Při nastavení vyplňte
          všechna čtyři pole; uložená pravidla lze opravit, nikoli vymazat.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          {configurationKeys.map((key) => {
            const field = `configuration.${key}`;
            return (
              <div key={key}>
                <label
                  htmlFor={fieldId(field)}
                  className="mb-2 block text-sm font-medium"
                >
                  {key === 'selectedPlaces'
                    ? values.kind === 'selection'
                      ? 'Počet postupujících týmů (slotů)'
                      : 'Počet vítězů'
                    : setupFieldLabels[field]}
                </label>
                {key === 'allowNegativeVotes' ? (
                  <select
                    {...props(field)}
                    className={controlClass}
                    value={
                      values.configuration[key] === null
                        ? ''
                        : values.configuration[key]
                          ? 'yes'
                          : 'no'
                    }
                    onChange={(e) =>
                      onChange({
                        ...values,
                        configuration: {
                          ...values.configuration,
                          [key]:
                            e.target.value === ''
                              ? null
                              : e.target.value === 'yes',
                        },
                      })
                    }
                  >
                    <option value="">Zatím neurčeno</option>
                    <option value="yes">Povolit</option>
                    <option value="no">Zakázat</option>
                  </select>
                ) : (
                  <input
                    {...props(field)}
                    className={controlClass}
                    type="number"
                    step="1"
                    value={values.configuration[key] ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...values,
                        configuration: {
                          ...values.configuration,
                          [key]:
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                        },
                      })
                    }
                  />
                )}
                {error(field)}
              </div>
            );
          })}
        </div>
      </section>
      <fieldset className="space-y-3 border-t border-border pt-5">
        <legend className="font-semibold">Oprávněná porota</legend>
        <p className="text-sm text-muted-foreground">
          Vyberte Technickou, Veřejnou nebo obě části. Koncept může zůstat bez
          oprávněné poroty.
        </p>
        <div
          id={fieldId('juryGroupIds')}
          tabIndex={-1}
          className="flex flex-wrap gap-3"
        >
          {snapshot.groups.map((group) => (
            <label
              key={group.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 border border-border px-3 py-2"
            >
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={values.juryGroupIds.includes(group.id)}
                onChange={(e) =>
                  onChange({
                    ...values,
                    juryGroupIds: e.target.checked
                      ? [...values.juryGroupIds, group.id]
                      : values.juryGroupIds.filter((id) => id !== group.id),
                  })
                }
              />
              <span>
                {juryGroupLabel(group.code)} — {group.name}
              </span>
            </label>
          ))}
        </div>
        {snapshot.groups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nejprve připravte Technickou a Veřejnou porotu v části Porotci. Tady
            se části poroty nevytvářejí.
          </p>
        )}
        {error('juryGroupIds')}
      </fieldset>
      <section
        className="space-y-4 border-t border-border pt-5"
        aria-labelledby={fieldId('items-title')}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 id={fieldId('items-title')} className="font-semibold">
            Týmy v hlasování ({values.items.length})
          </h4>
          <Button
            type="button"
            id={fieldId('add-entry')}
            variant="outline"
            className="min-h-11"
            disabled={snapshot.teams.length === 0}
            onClick={() => {
              focusRow.current = fieldId(`items.${values.items.length}.teamId`);
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
            Přidat položku
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Každý tým může být zařazen jednou. Uložené položky lze přeřadit nebo
          změnit jejich pořadí; nemažou se. Týmy a jejich popisy upravíte v
          části Týmy.
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
                {snapshot.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                    {snapshot.teams.some(
                      (other) =>
                        other.id !== team.id && other.name === team.name,
                    )
                      ? ` · ${team.id}`
                      : ''}
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
      </section>
    </>
  );
}
