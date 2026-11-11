import {
  type VotingSetupSnapshot,
  type VotingSetupValues,
} from '@d21/contracts';
import type { ReactNode } from 'react';
import { categoryReadiness, focusCategoryField } from './category-readiness';
import { ReadinessMark } from './EventNavigation';

const ruleLabels: Record<string, string> = {
  selectedPlaces: 'Doplnit počet vítězů nebo postupujících',
  maxPlusVotes: 'Doplnit počet kladných hlasů',
  maxMinusVotes: 'Doplnit počet záporných hlasů',
  allowNegativeVotes: 'Zvolit, zda povolit záporné hlasy',
};

const teamForms = (count: number) => {
  if (count === 1) {
    return 'tým';
  }
  if (count >= 2 && count <= 4) {
    return 'týmy';
  }
  return 'týmů';
};

/** "Před otevřením" checklist (AdminCategory artboard): ✓ items, "!" links that focus the field. */
export function VotingReadiness({
  values,
  snapshot,
  eventId,
  fieldId,
  needsSave,
}: {
  values: VotingSetupValues;
  snapshot: VotingSetupSnapshot;
  eventId: string;
  fieldId: (field: string) => string;
  needsSave: boolean;
}) {
  const {
    issues,
    limits,
    firstEmptyRule,
    teamIds,
    firstUnassigned,
    unassigned,
    duplicates,
    requiredTeams,
    missingTeams,
  } = categoryReadiness(values);

  function jump(field: string, label: string) {
    return (
      <a
        href={`#${fieldId(field)}`}
        className="wizard-link font-semibold"
        onClick={(event) => {
          event.preventDefault();
          focusCategoryField(fieldId(field));
        }}
      >
        {label}
      </a>
    );
  }
  const items: { key: string; ready: boolean; content: ReactNode }[] = [];
  const nameIssue = issues.find(({ field }) => field === 'name');
  const kindIssue = issues.find(({ field }) => field === 'kind');
  if (nameIssue) {
    items.push({
      key: 'name',
      ready: false,
      content: jump('name', nameIssue.label),
    });
  }
  if (kindIssue) {
    items.push({
      key: 'kind',
      ready: false,
      content: jump('kind', kindIssue.label),
    });
  }
  if (!nameIssue && !kindIssue) {
    items.push({ key: 'basics', ready: true, content: 'Název a typ' });
  }
  if (limits.success) {
    items.push({ key: 'rules', ready: true, content: 'Pravidla hlasů' });
  } else if (firstEmptyRule) {
    items.push({
      key: 'rules',
      ready: false,
      content: jump(
        `configuration.${firstEmptyRule}`,
        ruleLabels[firstEmptyRule] ?? 'Doplnit pravidla hlasování',
      ),
    });
  } else {
    const field = `configuration.${String(limits.error.issues[0]?.path[0])}`;
    items.push({
      key: 'rules',
      ready: false,
      content: jump(field, 'Opravit pravidla hlasů'),
    });
  }
  if (values.juryGroupIds.length > 0) {
    items.push({ key: 'jury', ready: true, content: 'Porota' });
  } else if (snapshot.groups.length) {
    items.push({
      key: 'jury',
      ready: false,
      content: jump('juryGroupIds', 'Vybrat porotu'),
    });
  } else {
    items.push({
      key: 'jury',
      ready: false,
      content: (
        <a
          className="wizard-link font-semibold"
          href={`/admin/events/${eventId}?setup=jurors`}
        >
          Přidat porotce
        </a>
      ),
    });
  }
  if (unassigned > 0) {
    items.push({
      key: 'unassigned',
      ready: false,
      content: jump(
        `items.${firstUnassigned}.teamId`,
        `Vybrat tým v prázdném řádku (${unassigned})`,
      ),
    });
  }
  if (duplicates > 0) {
    items.push({
      key: 'duplicates',
      ready: false,
      content: jump('items-title', 'Zkontrolovat opakované týmy'),
    });
  }
  if (missingTeams > 0) {
    const shortage = `Zařazené týmy ${teamIds.size} / ${requiredTeams} · Chybí ${missingTeams}`;
    let hint = '';
    if (limits.success) {
      hint = `Při limitu ${limits.data.maxPlusVotes} kladných a ${limits.data.maxMinusVotes} záporných hlasů potřebujete alespoň ${requiredTeams} týmů.`;
      if (teamIds.size >= 3) {
        hint += ` Se současnými týmy nastavte limit nejvýše na ${teamIds.size - 1} hlasů celkem.`;
        if (limits.data.selectedPlaces > teamIds.size - 2) {
          hint += ` Snižte také počet vítězů nebo postupujících nejvýše na ${teamIds.size - 2}.`;
        }
      }
    }
    items.push({
      key: 'teams',
      ready: false,
      content: (
        <>
          {jump('items-title', shortage)}
          {hint && (
            <span className="mt-1 block text-muted-foreground">{hint}</span>
          )}
          <span className="mt-1 flex flex-wrap gap-x-4">
            {snapshot.teams.length < requiredTeams && (
              <a
                className="wizard-link font-semibold"
                href={`/admin/events/${eventId}?setup=teams`}
              >
                Doplnit týmy v eventu
              </a>
            )}
            {limits.success &&
              teamIds.size >= 3 &&
              jump('configuration.maxPlusVotes', 'Upravit limity hlasů')}
          </span>
        </>
      ),
    });
  } else if (!unassigned && !duplicates) {
    items.push({
      key: 'teams',
      ready: true,
      content: `${teamIds.size} ${teamForms(teamIds.size)}`,
    });
  }
  let status = '';
  if (!issues.length) {
    status = needsSave
      ? 'Před aktivací uložte kategorii'
      : 'Kategorie je připravená k aktivaci';
  }
  return (
    <section
      className="category-panel text-sm"
      aria-labelledby={fieldId('readiness')}
    >
      <h2 id={fieldId('readiness')} className="font-bold">
        Před otevřením
      </h2>
      <ol className="mt-2">
        {items.map(({ key, ready, content }) => (
          <li key={key} className="category-check">
            <ReadinessMark ready={ready} />
            <span>{content}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-muted-foreground" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
