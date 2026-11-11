import {
  juryGroupLabel,
  type JurorVotes,
  type ResultsCategory,
} from '@d21/contracts';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  clockTime,
  progressLabels,
  timestamp,
} from '../dashboard/presentation';
import { countedTeamTotals } from './matrix-totals';

const statusOrder: Record<JurorVotes['progress'], number> = {
  submitted: 0,
  in_progress: 1,
  invalid_draft: 2,
  locked: 3,
  not_started: 4,
};

function VoteMark({
  value,
  team,
  counted,
}: {
  value?: number;
  team: string;
  counted: boolean;
}) {
  if (!value) {
    return <span className="sr-only">Bez hlasu: {team}</span>;
  }
  const label = value === 1 ? 'Kladný' : 'Záporný';
  return (
    <span
      role="img"
      aria-label={`${label}${counted ? ' hlas' : ', nezapočteno'}: ${team}`}
      className="operations-vote"
      data-vote={value}
      data-counted={counted}
    >
      {value === 1 ? '✓' : '✕'}
    </span>
  );
}

function ballotStatus(progress: JurorVotes['progress']) {
  if (progress === 'not_started') {
    return 'Bez návrhu';
  }
  return progressLabels[progress];
}

function BallotNote({ juror }: { juror: JurorVotes }) {
  if (juror.counted) {
    const suffix = juror.entries.length ? 'započteno' : 'prázdný lístek';
    if (!juror.submittedAt) {
      return <>{suffix}</>;
    }
    return (
      <>
        v{' '}
        <time dateTime={juror.submittedAt} title={timestamp(juror.submittedAt)}>
          {clockTime(juror.submittedAt)}
        </time>{' '}
        · {suffix}
      </>
    );
  }
  if (juror.progress === 'not_started') {
    return <>zatím nic neuložil</>;
  }
  if (juror.progress === 'invalid_draft') {
    return <>nezapočteno · vyžaduje opravu</>;
  }
  return <>nezapočteno</>;
}

export function JurorVotesList({
  category: c,
  jurorVotes,
}: {
  category: ResultsCategory;
  jurorVotes: JurorVotes[];
}) {
  const [filter, setFilter] = useState<'all' | 'counted' | 'T' | 'V'>('all');
  const groups = new Map(c.groups.map((group) => [group.id, group.code]));
  const nameCounts = new Map<string, number>();
  for (const juror of jurorVotes) {
    nameCounts.set(
      juror.displayName,
      (nameCounts.get(juror.displayName) ?? 0) + 1,
    );
  }
  const visible = jurorVotes
    .filter(
      (juror) =>
        filter === 'all' ||
        (filter === 'counted'
          ? juror.counted
          : groups.get(juror.groupId) === filter),
    )
    .sort(
      (a, b) =>
        Number(b.counted) - Number(a.counted) ||
        statusOrder[a.progress] - statusOrder[b.progress] ||
        (b.submittedAt ?? b.savedAt ?? '').localeCompare(
          a.submittedAt ?? a.savedAt ?? '',
        ) ||
        a.displayName.localeCompare(b.displayName, 'cs') ||
        a.jurorId.localeCompare(b.jurorId),
    );
  const totals = countedTeamTotals(
    c.rows.map((row) => row.id),
    jurorVotes,
  );
  const filters = [
    ['all', `Všichni (${jurorVotes.length})`],
    [
      'counted',
      `Jen započtení (${jurorVotes.filter((juror) => juror.counted).length})`,
    ],
    ['T', 'Technická'],
    ['V', 'Veřejná'],
  ] as const;
  const footer = [
    ['plus', 'Započteno kladných'],
    ['minus', 'Započteno záporných'],
    ['score', 'Skóre'],
  ] as const;
  return (
    <section className="mt-7 min-w-0" aria-labelledby={`juror-votes-${c.id}`}>
      <h2
        id={`juror-votes-${c.id}`}
        className="break-words text-xl font-semibold"
      >
        Hlasy porotců · {c.name}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Řádky jsou porotci, sloupce týmy v pořadí výsledků. Do výsledků se
        počítají jen odevzdané lístky.
      </p>
      <div
        role="group"
        aria-label="Filtrovat hlasy porotců"
        className="my-4 flex flex-wrap gap-2"
      >
        {filters.map(([value, label]) => (
          <Button
            key={value}
            variant="outline"
            className="operations-filter rounded-full"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <ul
        aria-label="Legenda"
        className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs"
      >
        {[
          { value: 1, counted: true, label: 'kladný hlas' },
          { value: -1, counted: true, label: 'záporný hlas' },
          { value: 1, counted: false, label: 'uložený návrh — nezapočteno' },
        ].map(({ value, counted, label }) => (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="operations-vote"
              data-vote={value}
              data-counted={counted}
            >
              {value === 1 ? '✓' : '✕'}
            </span>
            {label}
          </li>
        ))}
      </ul>
      {visible.length === 0 && (
        <p role="status" className="mb-3 text-sm text-muted-foreground">
          {jurorVotes.length
            ? 'Tomuto filtru neodpovídá žádný porotce.'
            : 'Kategorie nemá oprávněné porotce.'}
        </p>
      )}
      <div
        className="operations-scroll"
        tabIndex={0}
        role="region"
        aria-label="Matice hlasů porotců"
      >
        <table className="operations-table text-sm tabular-nums">
          <thead>
            <tr>
              <th scope="col">Porotce</th>
              {c.rows.map((team) => (
                <th
                  key={team.id}
                  scope="col"
                  className="min-w-24 max-w-40 break-words text-center"
                >
                  <span className="block text-xs text-muted-foreground">
                    {team.rank}.
                  </span>
                  {team.name}
                  {c.rows.some(
                    (other) => other.id !== team.id && other.name === team.name,
                  ) && (
                    <span className="block text-xs text-muted-foreground">
                      ID {(team.teamId ?? team.id).slice(0, 8)}
                    </span>
                  )}
                </th>
              ))}
              <th scope="col" className="whitespace-nowrap text-center">
                + / −
              </th>
              <th scope="col" className="min-w-40">
                Stav lístku
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((juror, index) => {
              const entries = new Map(
                juror.entries.map((entry) => [
                  entry.votingItemId,
                  entry.voteValue,
                ]),
              );
              const plus = juror.entries.filter(
                (entry) => entry.voteValue === 1,
              ).length;
              const minus = juror.entries.filter(
                (entry) => entry.voteValue === -1,
              ).length;
              return (
                <tr
                  key={juror.jurorId}

                  className={
                    index > 0 && visible[index - 1]?.counted && !juror.counted
                      ? 'operations-divider'
                      : undefined
                  }
                >
                  <th
                    scope="row"
                    className={
                      juror.counted
                        ? 'font-semibold'
                        : 'font-semibold text-muted-foreground'
                    }
                  >
                    {juror.displayName}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {juryGroupLabel(groups.get(juror.groupId))}
                      {(nameCounts.get(juror.displayName) ?? 0) > 1 &&
                        ` · ID ${juror.jurorId.slice(0, 8)}`}
                    </span>
                  </th>
                  {c.rows.map((team) => (
                    <td key={team.id} className="text-center">
                      <VoteMark
                        value={entries.get(team.id)}
                        team={team.name}
                        counted={juror.counted}
                      />
                    </td>
                  ))}
                  <td className="whitespace-nowrap text-center">
                    {plus} / {minus}
                  </td>
                  <td>
                    <span
                      className="operations-pill"
                      data-progress={juror.progress}
                    >
                      {ballotStatus(juror.progress)}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      <BallotNote juror={juror} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {footer.map(([field, label]) => (
              <tr key={field}>
                <th scope="row">{label}</th>
                {c.rows.map((team) => (
                  <td key={team.id} className="text-center font-semibold">
                    {totals.get(team.id)?.[field]}
                  </td>
                ))}
                <td colSpan={2} />
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Součty v patičce se shodují s tabulkou pořadí výše.
      </p>
    </section>
  );
}
