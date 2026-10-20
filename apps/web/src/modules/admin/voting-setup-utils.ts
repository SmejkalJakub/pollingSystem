import type { VotingSetupSnapshot, VotingSetupValues } from '@d21/contracts';

export const configurationKeys = [
  'selectedPlaces',
  'maxPlusVotes',
  'maxMinusVotes',
  'allowNegativeVotes',
] as const;
export function setupValues(snapshot: VotingSetupSnapshot): VotingSetupValues {
  const voting = snapshot.voting;
  return {
    name: voting?.name ?? '',
    instructions: voting?.instructions ?? '',
    kind: voting?.kind ?? '',
    configuration: {
      selectedPlaces: voting?.selectedPlaces ?? null,
      maxPlusVotes: voting?.maxPlusVotes ?? null,
      maxMinusVotes: voting?.maxMinusVotes ?? null,
      allowNegativeVotes: voting?.allowNegativeVotes ?? null,
    },
    juryGroupIds: [...snapshot.juryGroupIds],
    items: snapshot.items.map(({ id, teamId, displayOrder }) => ({
      id,
      teamId,
      displayOrder,
    })),
  };
}
export function sameSetup(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}
// Run only after an explicit comparison action. Changed entry rows stay whole.
export function rebaseSetup(
  base: VotingSetupSnapshot,
  local: VotingSetupValues,
  current: VotingSetupSnapshot,
): VotingSetupValues | null {
  if (!current.editable) return null;
  const old = setupValues(base),
    remote = setupValues(current);
  if (
    old.items.some(
      (item) =>
        !remote.items.some((entry) => entry.id === item.id) &&
        !sameSetup(
          item,
          local.items.find((entry) => entry.id === item.id),
        ),
    )
  )
    return null;
  const items = remote.items.map((item) => {
    const previous = old.items.find((entry) => entry.id === item.id),
      edited = local.items.find((entry) => entry.id === item.id);
    return edited && (!previous || !sameSetup(previous, edited))
      ? edited
      : item;
  });
  for (const item of local.items)
    if (
      !old.items.some((entry) => entry.id === item.id) &&
      !items.some((entry) => entry.id === item.id)
    )
      items.push(item);
  return {
    name: local.name !== old.name ? local.name : remote.name,
    instructions:
      local.instructions !== old.instructions
        ? local.instructions
        : remote.instructions,
    kind: local.kind !== old.kind ? local.kind : remote.kind,
    configuration: !sameSetup(local.configuration, old.configuration)
      ? local.configuration
      : remote.configuration,
    juryGroupIds: !sameSetup(
      [...local.juryGroupIds].sort(),
      [...old.juryGroupIds].sort(),
    )
      ? local.juryGroupIds
      : remote.juryGroupIds,
    items,
  };
}
export const setupFieldLabels: Record<string, string> = {
  name: 'Název hlasování',
  instructions: 'Instrukce pro porotu',
  kind: 'Typ hlasování',
  'configuration.selectedPlaces': 'Počet postupujících týmů / vítězů',
  'configuration.maxPlusVotes': 'Maximum kladných hlasů',
  'configuration.maxMinusVotes': 'Maximum záporných hlasů',
  'configuration.allowNegativeVotes': 'Záporné hlasy',
  juryGroupIds: 'Oprávněná porota',
};

export function setupFieldError(field: string) {
  if (field.endsWith('.teamId'))
    return 'Vyberte tým tohoto eventu, který v kategorii není zařazený dvakrát.';
  if (field.endsWith('.displayOrder'))
    return 'Zadejte celý nezáporný počet, nejvýše 2147483647.';
  return (
    (
      {
        name: 'Zadejte název o délce 1–200 znaků.',
        instructions: 'Instrukce mohou mít nejvýše 5000 znaků.',
        kind: 'Vyberte výběrové kolo nebo finálovou kategorii.',
        'configuration.selectedPlaces':
          'Zadejte kladný celý počet postupujících týmů nebo vítězů.',
        'configuration.maxPlusVotes':
          'Zadejte celý počet kladných hlasů větší než počet vybíraných míst.',
        'configuration.maxMinusVotes':
          'Zadejte celé nezáporné maximum, nejvýše polovinu kladného limitu. Při zákazu záporných hlasů zadejte 0.',
        'configuration.allowNegativeVotes':
          'Výslovně zvolte povolení nebo zákaz záporných hlasů.',
        juryGroupIds: 'Vyberte pouze části poroty tohoto eventu.',
      } as Record<string, string>
    )[field] ?? 'Zkontrolujte tuto hodnotu.'
  );
}

// Add only missing team identities; preserve saved and unsaved entry IDs/orders.
export function addAllEventTeams(
  values: VotingSetupValues,
  teams: VotingSetupSnapshot['teams'],
): VotingSetupValues {
  const included = new Set(values.items.map((item) => item.teamId));
  const missing = teams.filter((team) => !included.has(team.id));
  if (!missing.length) return values;
  const items = values.items.map((item) => ({ ...item }));
  let nextOrder = items.reduce(
    (next, item) => Math.max(next, (item.displayOrder ?? -1) + 1),
    0,
  );
  for (const team of missing) {
    const blank = items.find((item) => item.teamId === null);
    if (blank) blank.teamId = team.id;
    else
      items.push({
        id: crypto.randomUUID(),
        teamId: team.id,
        displayOrder: Math.min(nextOrder++, 2147483647),
      });
  }
  return { ...values, items };
}
