import type { VotingSetupSnapshot, VotingSetupValues } from '@d21/contracts';
import { configurationKeys, setupFieldLabels } from './voting-setup-utils';
export function VotingSetupComparison({
  values,
  snapshot,
}: {
  values: VotingSetupValues;
  snapshot: VotingSetupSnapshot;
}) {
  const rows: [string, string][] = [
    ['Název', values.name],
    [
      'Typ',
      values.kind === 'selection'
        ? 'Výběrové kolo'
        : values.kind === 'final'
          ? 'Finálová kategorie'
          : 'Neurčeno',
    ],
    ['Instrukce', values.instructions],
    ...configurationKeys.map((key): [string, string] => [
      setupFieldLabels[`configuration.${key}`]!,
      values.configuration[key] === null
        ? 'Neurčeno'
        : typeof values.configuration[key] === 'boolean'
          ? values.configuration[key]
            ? 'Povolené'
            : 'Zakázané'
          : String(values.configuration[key]),
    ]),
    [
      'Porota',
      values.juryGroupIds
        .map((id) => {
          const group = snapshot.groups.find((entry) => entry.id === id);
          return group
            ? `${group.code} — ${group.name}`
            : `Nedostupná část ${id}`;
        })
        .join('; ') || 'Neurčena',
    ],
  ];
  return (
    <>
      <dl className="space-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {value || 'Prázdné'}
            </dd>
          </div>
        ))}
      </dl>
      <ol className="mt-4 space-y-3 text-sm">
        {values.items.map((item) => (
          <li key={item.id} className="break-words [overflow-wrap:anywhere]">
            <p>
              {snapshot.teams.find((team) => team.id === item.teamId)?.name ??
                'Nepropojená položka'}{' '}
              · pořadí {item.displayOrder}
            </p>
            <p className="text-xs text-muted-foreground">
              Položka {item.id}
              <br />
              Tým {item.teamId ?? 'neurčen'}
            </p>
          </li>
        ))}
      </ol>
    </>
  );
}
