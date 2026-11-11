import {
  votingConfigurationSchema,
  type VotingSetupSnapshot,
  type VotingSetupValues,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';
import { teamsByName } from './team-table-utils';
import {
  addAllEventTeams,
  configurationKeys,
  setupFieldError,
  setupFieldLabels,
} from './voting-setup-utils';

export function VotingReadiness({
  values,
  snapshot,
  eventId,
  fieldId,
  needsSave,
  onChange,
  disabled,
}: {
  values: VotingSetupValues;
  snapshot: VotingSetupSnapshot;
  eventId: string;
  fieldId: (field: string) => string;
  needsSave: boolean;
  onChange: (values: VotingSetupValues) => void;
  disabled: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const limits = votingConfigurationSchema.safeParse(values.configuration);
  const firstEmptyRule = configurationKeys.find(
    (key) => values.configuration[key] === null,
  );
  const teamIds = new Set(values.items.flatMap((item) => item.teamId ?? []));
  const firstUnassigned = values.items.findIndex((item) => !item.teamId);
  const unassigned = values.items.filter((item) => !item.teamId).length;
  const duplicates = values.items.length - unassigned - teamIds.size;
  // The validated positive limit already exceeds the number of selected places.
  const requiredTeams = limits.success
    ? 1 + limits.data.maxPlusVotes + limits.data.maxMinusVotes
    : 1;
  const missingTeams = requiredTeams - teamIds.size;
  const teamsAvailable = snapshot.teams.some((team) => !teamIds.has(team.id));
  const teamsUrl = `/admin/events/${eventId}?setup=teams`;
  const jurorsUrl = `/admin/events/${eventId}?setup=jurors`;
  const linkClass = 'wizard-link font-semibold';

  function jump(field: string, label: string) {
    return (
      <a
        className={linkClass}
        href={`#${fieldId(field)}`}
        onClick={(event) => {
          event.preventDefault();
          const target = document.getElementById(fieldId(field));
          target?.scrollIntoView({ block: 'start' });
          target?.focus({ preventScroll: true });
        }}
      >
        {label}
      </a>
    );
  }

  const incomplete =
    !limits.success ||
    missingTeams > 0 ||
    unassigned > 0 ||
    duplicates > 0 ||
    values.juryGroupIds.length === 0;
  return (
    <section
      className="rounded-lg border border-border bg-secondary px-4 py-3 text-sm"
      aria-labelledby={fieldId('readiness')}
    >
      <h4
        ref={heading}
        id={fieldId('readiness')}
        tabIndex={-1}
        className="font-bold"
        aria-live="polite"
      >
        {incomplete
          ? 'Před aktivací zbývá'
          : needsSave
            ? 'Před aktivací uložte kategorii'
            : 'Kategorie je připravená k aktivaci'}
      </h4>
      {incomplete && (
        <ul className="mt-2 divide-y divide-border">
          {firstEmptyRule && (
            <li className="py-2">
              <p>
                Zadejte počet vítězů nebo postupujících, oba limity hlasů a zda
                povolit záporné hlasy.
              </p>
              {jump(
                `configuration.${firstEmptyRule}`,
                'Doplnit pravidla hlasování',
              )}
            </li>
          )}
          {!firstEmptyRule &&
            !limits.success &&
            [
              ...new Set(
                limits.error.issues.map((issue) => String(issue.path[0])),
              ),
            ].map((key) => {
              const field = `configuration.${key}`;
              return (
                <li key={field} className="py-2">
                  <p>{setupFieldError(field)}</p>
                  {jump(field, setupFieldLabels[field]!)}
                </li>
              );
            })}
          {unassigned > 0 && (
            <li className="py-2">
              <p>
                Řádky bez vybraného týmu ({unassigned}) se do počtu
                nezapočítávají. Vyberte tým v každém prázdném řádku.
              </p>
              {jump(
                `items.${firstUnassigned}.teamId`,
                'Přejít na první prázdný řádek',
              )}
            </li>
          )}
          {duplicates > 0 && (
            <li className="py-2">
              <p>
                Každý tým se počítá jen jednou. U opakovaného týmu vyberte jiný
                tým nebo odeberte neuložený řádek.
              </p>
              {jump('items-title', 'Zkontrolovat týmy v hlasování')}
            </li>
          )}
          {missingTeams > 0 && (
            <li className="py-2">
              {limits.success ? (
                <>
                  <p className="font-semibold">
                    Zařazené týmy {teamIds.size} / {requiredTeams} · Chybí{' '}
                    {missingTeams}
                  </p>
                  <p>
                    Při limitu {limits.data.maxPlusVotes} kladných a{' '}
                    {limits.data.maxMinusVotes} záporných hlasů potřebujete
                    alespoň {requiredTeams} týmů.
                    {teamIds.size >= 3 &&
                      ` Se současnými týmy nastavte limit nejvýše na ${teamIds.size - 1} hlasů celkem.`}
                    {teamIds.size >= 3 &&
                      limits.data.selectedPlaces > teamIds.size - 2 &&
                      ` Snižte také počet vítězů nebo postupujících nejvýše na ${teamIds.size - 2}.`}
                  </p>
                </>
              ) : (
                <p>
                  V kategorii zatím není vybraný žádný tým. Po zadání limitů se
                  tu zobrazí potřebný počet týmů.
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                {teamsAvailable && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => {
                        onChange(
                          addAllEventTeams(values, teamsByName(snapshot.teams)),
                        );
                        heading.current?.focus({ preventScroll: true });
                      }}
                    >
                      Zařadit zbývající týmy
                    </Button>
                    {jump('add-entry', 'Vybrat týmy jednotlivě')}
                  </>
                )}
                {snapshot.teams.length < requiredTeams && (
                  <a className={linkClass} href={teamsUrl}>
                    Doplnit týmy v eventu
                  </a>
                )}
                {limits.success &&
                  teamIds.size >= 3 &&
                  jump('configuration.maxPlusVotes', 'Upravit limity hlasů')}
              </div>
            </li>
          )}
          {values.juryGroupIds.length === 0 && (
            <li className="py-2">
              <p>Vyberte, která porota má v kategorii hlasovat.</p>
              {snapshot.groups.length ? (
                jump('juryGroupIds', 'Vybrat porotu')
              ) : (
                <a className={linkClass} href={jurorsUrl}>
                  Přejít do části Porotci
                </a>
              )}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
