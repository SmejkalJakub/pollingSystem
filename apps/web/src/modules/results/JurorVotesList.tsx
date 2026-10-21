import { juryGroupLabel } from '@d21/contracts';
import type { JurorVotes, ResultsCategory } from '@d21/contracts';
import { progressLabels, timestamp } from '../dashboard/presentation';

function teamNames(
  votes: JurorVotes,
  value: 1 | -1,
  items: Map<string, { name: string; displayOrder: number }>,
) {
  return votes.entries
    .filter((e) => e.voteValue === value)
    .map((e) => items.get(e.votingItemId))
    .filter((i) => i !== undefined)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((i) => i.name);
}

function VoteLine({ label, names }: { label: string; names: string[] }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-muted-foreground sm:w-24">{label}</dt>
      <dd className="min-w-0 break-words">
        {names.length ? names.join(', ') : '—'}
      </dd>
    </div>
  );
}

function statusNote(votes: JurorVotes) {
  if (votes.counted) {
    return votes.submittedAt
      ? `Započteno · odevzdáno ${timestamp(votes.submittedAt)}`
      : 'Započteno';
  }
  if (votes.savedAt) {
    return `Nezapočteno · uloženo ${timestamp(votes.savedAt)}`;
  }
  return 'Nezapočteno';
}

export function JurorVotesList({
  category: c,
  jurorVotes,
}: {
  category: ResultsCategory;
  jurorVotes: JurorVotes[];
}) {
  const items = new Map(c.rows.map((r) => [r.id, r]));
  return (
    <section
      className="mt-6 min-w-0 border border-border bg-card p-5 sm:p-6"
      aria-labelledby={`juror-votes-${c.id}`}
    >
      <h2 id={`juror-votes-${c.id}`} className="text-xl font-semibold">
        Hlasy porotců
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Jednotlivé volby aktuálně oprávněných porotců, včetně uložených
        neodevzdaných návrhů. Do výsledků se započítávají pouze odevzdané
        lístky.
      </p>
      {jurorVotes.length ? (
        <ul className="mt-5 divide-y divide-border border-t border-border">
          {jurorVotes.map((j) => (
            <li key={j.jurorId} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words font-medium">{j.displayName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {juryGroupLabel(
                      c.groups.find((g) => g.id === j.groupId)?.code,
                    )}{' '}
                    · {statusNote(j)}
                  </p>
                </div>
                <span
                  className={`border px-2 py-0.5 text-xs font-medium ${j.counted ? 'border-ring text-ring' : 'border-border text-muted-foreground'}`}
                >
                  {progressLabels[j.progress]}
                </span>
              </div>
              {j.progress === 'not_started' ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Porotce zatím nic neuložil.
                </p>
              ) : (
                <dl className="mt-3 space-y-2 text-sm">
                  <VoteLine label="Pozitivní" names={teamNames(j, 1, items)} />
                  <VoteLine label="Negativní" names={teamNames(j, -1, items)} />
                </dl>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          Kategorie nemá oprávněné porotce.
        </p>
      )}
    </section>
  );
}
