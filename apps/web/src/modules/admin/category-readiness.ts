import {
  votingConfigurationSchema,
  type Roster,
  type VotingSetupValues,
} from '@d21/contracts';
import { configurationKeys } from './voting-setup-utils';

export function categoryReadiness(values: VotingSetupValues) {
  const limits = votingConfigurationSchema.safeParse(values.configuration);
  const firstEmptyRule = configurationKeys.find(
    (key) => values.configuration[key] === null,
  );
  const teamIds = new Set(values.items.flatMap((item) => item.teamId ?? []));
  const firstUnassigned = values.items.findIndex((item) => !item.teamId);
  const unassigned = values.items.filter((item) => !item.teamId).length;
  const duplicates = values.items.length - unassigned - teamIds.size;
  const requiredTeams = limits.success
    ? 1 + limits.data.maxPlusVotes + limits.data.maxMinusVotes
    : 1;
  const missingTeams = requiredTeams - teamIds.size;
  const issues: { field: string; label: string }[] = [];
  if (!values.name.trim()) {
    issues.push({ field: 'name', label: 'Doplnit název' });
  }
  if (!values.kind) {
    issues.push({ field: 'kind', label: 'Vybrat typ' });
  }
  if (!limits.success) {
    const fields = firstEmptyRule
      ? [firstEmptyRule]
      : [...new Set(limits.error.issues.map((issue) => String(issue.path[0])))];
    issues.push(
      ...fields.map((key) => ({
        field: `configuration.${key}`,
        label: 'Doplnit pravidla hlasování',
      })),
    );
  }
  if (values.juryGroupIds.length === 0) {
    issues.push({ field: 'juryGroupIds', label: 'Vybrat porotu' });
  }
  if (firstUnassigned >= 0) {
    issues.push({
      field: `items.${firstUnassigned}.teamId`,
      label: 'Vybrat tým v prázdném řádku',
    });
  }
  if (missingTeams > 0 || duplicates > 0) {
    issues.push({
      field: 'items-title',
      label: 'Zkontrolovat týmy v hlasování',
    });
  }
  return {
    issues,
    limits,
    firstEmptyRule,
    teamIds,
    firstUnassigned,
    unassigned,
    duplicates,
    requiredTeams,
    missingTeams,
  };
}

export function focusCategoryField(id: string) {
  let field = document.getElementById(id);
  if (
    field instanceof HTMLInputElement &&
    field.disabled &&
    id.endsWith('configuration.maxMinusVotes')
  ) {
    field = document.getElementById(
      id.replace(/maxMinusVotes$/, 'allowNegativeVotes'),
    );
  }
  const details = field?.closest('details');
  if (details) {
    details.open = true;
  }
  const target =
    field?.querySelector<HTMLInputElement>('input:checked:enabled') ??
    field?.querySelector<HTMLInputElement>('input:enabled') ??
    field;
  target?.scrollIntoView({ block: 'center' });
  target?.focus({ preventScroll: true });
}

export function juryCounts(roster?: Roster) {
  if (!roster) {
    return undefined;
  }
  const counts = new Map<string, number>();
  for (const juror of roster.jurors) {
    counts.set(juror.juryGroupId, (counts.get(juror.juryGroupId) ?? 0) + 1);
  }
  return counts;
}

export function categoryPlaces(kind: string, places: number | null) {
  if (kind === 'selection') {
    if (places === null) {
      return 'počet postupujících neurčen';
    }
    return `${places} ${places >= 1 && places <= 4 ? 'postupující' : 'postupujících'}`;
  }
  if (places === null) {
    return 'počet vítězů neurčen';
  }
  if (places === 1) {
    return '1 vítěz';
  }
  return `${places} ${places >= 2 && places <= 4 ? 'vítězové' : 'vítězů'}`;
}
