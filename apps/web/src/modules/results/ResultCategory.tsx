import '../admin/operations.css';
import { juryGroupLabel } from '@d21/contracts';
import type { ResultsCategory, ResultsReason, ResultRow } from '@d21/contracts';
import { czechCount } from '@/lib/plural';
import { problemLabels } from '../dashboard/presentation';

const reasonLabels: Record<ResultsReason, string> = {
  NOT_CLOSED: 'Hlasování ještě není uzavřené.',
  PENDING_BALLOTS: 'Někteří oprávnění porotci dosud neodevzdali lístek.',
  DATA_PROBLEMS: 'Uložená data vyžadují kontrolu.',
  CUTOFF_TIE: 'Shoda skóre zasahuje přes hranici dostupných míst.',
};
function placesText(c: ResultsCategory) {
  if (c.selectedPlaces === null) {
    return 'počet míst neurčen';
  }
  if (c.kind === 'selection') {
    return czechCount(c.selectedPlaces, {
      one: 'postupové místo',
      few: 'postupová místa',
      other: 'postupových míst',
    });
  }
  return czechCount(c.selectedPlaces, {
    one: 'vítězné místo',
    few: 'vítězná místa',
    other: 'vítězných míst',
  });
}

function selectionLabel(row: ResultRow, c: ResultsCategory) {
  if (c.counts.submitted === 0) {
    return 'Zatím bez hlasů';
  }
  if (row.selection === 'unresolved') {
    return 'Nerozhodnutá shoda';
  }
  if (c.problems.includes('CONFIGURATION_NOT_READY')) {
    return 'Výběr není vyhodnocen';
  }
  if (row.selection === 'outside') {
    return 'Mimo výběr';
  }
  if (c.stage === 'provisional') {
    return c.kind === 'selection' ? 'Průběžně postupuje' : 'Průběžně ve výběru';
  }
  return c.kind === 'selection' ? 'Postupuje' : 'Vítěz';
}

function rowTone(row: ResultRow, c: ResultsCategory) {
  if (c.counts.submitted === 0) {
    return '';
  }
  if (row.selection === 'unresolved') {
    return 'results-cutoff bg-warning-soft';
  }
  if (row.selection === 'selected') {
    return 'bg-selected-plus-bg';
  }
  return '';
}

function selectionTone(row: ResultRow, c: ResultsCategory) {
  if (row.selection === 'unresolved' && c.counts.submitted > 0) {
    return 'text-destructive';
  }
  if (row.selection === 'selected' && c.stage === 'final') {
    return 'text-success-text';
  }
  return 'text-muted-foreground';
}

export function ResultCategory({
  category: c,
  detail = false,
}: {
  category: ResultsCategory;
  detail?: boolean;
}) {
  const winners =
    c.kind === 'final' && c.stage === 'final'
      ? c.rows.filter((row) => row.selection === 'selected')
      : [];
  const names = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of c.rows) {
    if (names.has(row.name)) {
      duplicates.add(row.name);
    }
    names.add(row.name);
  }
  return (
    <section
      className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6"
      aria-labelledby={`result-${c.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2
          id={`result-${c.id}`}
          className="min-w-0 break-words text-[22px] font-bold"
        >
          {c.name}
        </h2>
        <span
          className={`operations-pill uppercase ${c.stage === 'final' ? 'bg-success-soft text-success-text' : 'bg-warning-soft text-warning-text'}`}
        >
          {c.stage === 'final' ? 'Finální výsledek' : 'Průběžný výsledek'}
        </span>
      </div>
      <p className="mt-2 break-words text-sm text-muted-foreground">
        {c.kind === 'selection' ? 'Výběrové kolo' : 'Finále'} ·{' '}
        {c.groups.map((g) => juryGroupLabel(g.code)).join(' + ') ||
          'Bez poroty'}{' '}
        · {placesText(c)} · odevzdáno {c.counts.submitted} / {c.counts.expected}
      </p>
      {winners.length === 1 && (
        <p className="mt-4 break-words text-sm">
          Vítěz: <strong>{winners[0]!.name}</strong>
        </p>
      )}
      {c.reasons.length > 0 && (
        <ul className="result-reasons mt-4 flex flex-wrap gap-2 text-sm">
          {c.reasons.map((r) => (
            <li
              key={r}
              className={`operations-pill ${r === 'CUTOFF_TIE' ? 'bg-warning-soft text-warning-text' : 'bg-secondary text-secondary-foreground'}`}
            >
              {reasonLabels[r]}
            </li>
          ))}
        </ul>
      )}
      {c.problems.length > 0 && (
        <div className="feedback-error mt-4 text-sm">
          <p className="feedback-error-title">Co vyžaduje kontrolu</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {c.problems.map((p) => (
              <li key={p}>{problemLabels[p]}</li>
            ))}
          </ul>
          {c.problems.includes('INVALID_SUBMISSION') && (
            <p className="mt-2">
              Součty zahrnují i neplatné uložené odevzdání; výsledek vyžaduje
              kontrolu.
            </p>
          )}
          {c.problems.includes('INELIGIBLE_BALLOTS') && (
            <p className="mt-2">
              Lístky neoprávněných porotců nejsou započtené.
            </p>
          )}
        </div>
      )}
      {c.counts.submitted === 0 && (
        <p className="mt-5 text-sm text-muted-foreground">
          Zatím nejsou započtené žádné odevzdané lístky. Nulové skóre neznamená
          zvolení.
        </p>
      )}
      {c.rows.length ? (
        <table
          role="table"
          aria-label="Pořadí týmů"
          className="results-table mt-6 w-full text-sm"
        >
          <thead role="rowgroup">
            <tr
              role="row"
              className="border-b border-border-subtle bg-table-head text-left text-[13px] text-muted-foreground"
            >
              <th role="columnheader" scope="col" className="pb-3 pr-3">
                Pořadí
              </th>
              <th role="columnheader" scope="col" className="pb-3 pr-3">
                Tým
              </th>
              <th
                role="columnheader"
                scope="col"
                className="pb-3 px-2 text-right"
              >
                <span aria-hidden="true">+</span>
                <span className="sr-only">Pozitivní</span>
              </th>
              <th
                role="columnheader"
                scope="col"
                className="pb-3 px-2 text-right"
              >
                <span aria-hidden="true">−</span>
                <span className="sr-only">Negativní</span>
              </th>
              <th
                role="columnheader"
                scope="col"
                className="pb-3 pl-2 text-right"
                aria-sort="descending"
              >
                Skóre
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {c.rows.map((row) => (
              <tr
                role="row"
                key={row.id}
                className={`border-b border-border-subtle last:border-0 ${rowTone(row, c)}`}
              >
                <td
                  role="cell"
                  className="results-rank py-3 pr-3 align-top font-bold tabular-nums"
                >
                  <span className="sr-only sm:hidden">Pořadí </span>
                  {row.rank}.
                  {row.tied && c.counts.submitted > 0 && (
                    <span className="ml-1 text-[11px] font-semibold text-muted-foreground">
                      shoda
                    </span>
                  )}
                </td>
                <th
                  role="rowheader"
                  scope="row"
                  className="results-team min-w-0 py-3 pr-3 text-left align-top font-normal"
                >
                  <p className="break-words">
                    <span className="font-semibold">{row.name}</span>{' '}
                    <span
                      className={`text-xs font-semibold ${selectionTone(row, c)}`}
                    >
                      {selectionLabel(row, c)}
                    </span>
                  </p>
                  {duplicates.has(row.name) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      ID {(row.teamId ?? row.id).slice(0, 8)}
                    </p>
                  )}
                </th>
                <td
                  role="cell"
                  className="results-plus py-3 px-2 text-right align-top tabular-nums"
                >
                  <span className="block font-sans text-xs text-muted-foreground sm:sr-only">
                    Pozitivní{' '}
                  </span>
                  {row.plus}
                </td>
                <td
                  role="cell"
                  className="results-minus py-3 px-2 text-right align-top tabular-nums"
                >
                  <span className="block font-sans text-xs text-muted-foreground sm:sr-only">
                    Negativní{' '}
                  </span>
                  {row.minus}
                </td>
                <td
                  role="cell"
                  className="results-score py-3 pl-2 text-right align-top font-semibold tabular-nums"
                >
                  <span className="block font-sans text-xs text-muted-foreground sm:sr-only">
                    Skóre{' '}
                  </span>
                  {row.score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-6 text-muted-foreground">
          Kategorie zatím nemá soutěžní týmy.
        </p>
      )}
      {c.boundaryTie && c.counts.submitted > 0 && (
        <p className="mt-5 rounded-lg bg-warning-soft p-4 text-sm text-warning-text">
          <strong>Hranice výběru je nerozhodnutá.</strong> Celá shodná skupina
          zůstává nerozhodnutá. Rozhodnutí je na organizátorovi mimo aplikaci;
          zobrazené pořadí týmů se stejným skóre shodu nerozhoduje.
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {!detail && (
          <a className="wizard-link" href={`/admin/results/votings/${c.id}`}>
            Hlasy porotců →
          </a>
        )}
        {detail && (
          <a className="wizard-link" href={`#juror-votes-${c.id}`}>
            Hlasy porotců ↓
          </a>
        )}
      </div>
    </section>
  );
}
