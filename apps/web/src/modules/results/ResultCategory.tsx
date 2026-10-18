import type { ResultsCategory, ResultsReason, ResultRow } from '@d21/contracts';
import { lifecycleLabels, problemLabels } from '../dashboard/presentation';

const reasonLabels: Record<ResultsReason, string> = {
  NOT_CLOSED: 'Hlasování ještě není uzavřené.',
  PENDING_BALLOTS: 'Někteří oprávnění porotci dosud neodevzdali lístek.',
  DATA_PROBLEMS: 'Uložená data vyžadují kontrolu.',
  CUTOFF_TIE: 'Shoda skóre zasahuje přes hranici dostupných míst.',
};
function selectionLabel(row: ResultRow, c: ResultsCategory) {
  if (row.selection === 'unresolved') return 'Nerozhodnutá shoda';
  if (c.problems.includes('CONFIGURATION_NOT_READY'))
    return 'Výběr není vyhodnocen';
  if (row.selection === 'outside') return 'Mimo výběr';
  if (c.stage === 'provisional')
    return c.kind === 'selection' ? 'Průběžně postupuje' : 'Průběžně ve výběru';
  return c.kind === 'selection' ? 'Postupuje' : 'Vítěz';
}

export function ResultCategory({
  category: c,
  detail = false,
}: {
  category: ResultsCategory;
  detail?: boolean;
}) {
  return (
    <section
      className="min-w-0 border border-border bg-card p-5 sm:p-6"
      aria-labelledby={`result-${c.id}`}
    >
      <p className="eyebrow">
        {c.kind === 'selection' ? 'Výběrové kolo' : 'Finálová kategorie'} ·{' '}
        {c.groups.map((g) => g.code).join(' + ') || 'Bez poroty'}
      </p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h2
          id={`result-${c.id}`}
          className="min-w-0 break-words text-xl font-semibold"
        >
          {c.name}
        </h2>
        <span
          className={`border px-3 py-1 text-sm font-medium ${c.stage === 'final' ? 'border-ring text-ring' : 'border-border'}`}
        >
          {c.stage === 'final' ? 'Finální výsledek' : 'Průběžný výsledek'}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {lifecycleLabels[c.status]} · Odevzdáno {c.counts.submitted}/
        {c.counts.expected} ·{' '}
        {c.kind === 'selection' ? 'Postupových míst' : 'Vítězných míst'}:{' '}
        {c.selectedPlaces ?? 'nenastaveno'}
      </p>
      {c.stage === 'provisional' && (
        <ul className="mt-4 list-inside list-disc space-y-1 text-sm">
          {c.reasons.map((r) => (
            <li key={r}>{reasonLabels[r]}</li>
          ))}
        </ul>
      )}
      {c.problems.length > 0 && (
        <div className="mt-4 border-l-2 border-destructive pl-4 text-sm">
          <p className="font-medium">Ke kontrole</p>
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
      {c.boundaryTie && (
        <p className="mt-5 border border-destructive p-4 text-sm">
          <strong>Hranice výběru je nerozhodnutá.</strong> Celá shodná skupina
          zůstává nerozhodnutá. Rozhodnutí je na organizátorovi mimo aplikaci;
          zobrazené pořadí týmů se stejným skóre shodu nerozhoduje.
        </p>
      )}
      {c.counts.submitted === 0 && (
        <p className="mt-5 text-sm text-muted-foreground">
          Zatím nejsou započtené žádné odevzdané lístky. Nulové skóre neznamená
          zvolení.
        </p>
      )}
      {c.rows.length ? (
        <table role="table" className="results-table mt-6 w-full text-sm">
          <caption className="mb-3 text-left text-xs text-muted-foreground">
            Skóre = pozitivní − negativní hlasy. Shodné skóre sdílí pořadí (1,
            2, 2, 4).
          </caption>
          <thead role="rowgroup">
            <tr
              role="row"
              className="border-b border-border text-left text-xs text-muted-foreground"
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
                Pozitivní
              </th>
              <th
                role="columnheader"
                scope="col"
                className="pb-3 px-2 text-right"
              >
                Negativní
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
                className="border-b border-border last:border-0"
              >
                <td
                  role="cell"
                  className="results-rank py-4 pr-3 align-top font-mono tabular-nums"
                >
                  <span className="sr-only sm:hidden">Pořadí </span>
                  {row.rank}.
                  {row.tied && (
                    <span className="mt-1 block font-sans text-xs text-muted-foreground">
                      shoda
                    </span>
                  )}
                </td>
                <th
                  role="rowheader"
                  scope="row"
                  className="results-team min-w-0 py-4 pr-3 text-left align-top font-normal"
                >
                  <p className="break-words font-medium">{row.name}</p>
                  <p
                    className={`mt-1 text-xs ${row.selection === 'unresolved' ? 'text-destructive' : row.selection === 'selected' && c.stage === 'final' ? 'text-ring' : 'text-muted-foreground'}`}
                  >
                    {selectionLabel(row, c)}
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                    {row.teamId ?? row.id}
                  </p>
                  {detail && row.description && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {row.description}
                    </p>
                  )}
                </th>
                <td
                  role="cell"
                  className="results-plus py-4 px-2 text-right align-top font-mono tabular-nums"
                >
                  <span className="block font-sans text-xs text-muted-foreground sm:sr-only">
                    Pozitivní{' '}
                  </span>
                  {row.plus}
                </td>
                <td
                  role="cell"
                  className="results-minus py-4 px-2 text-right align-top font-mono tabular-nums"
                >
                  <span className="block font-sans text-xs text-muted-foreground sm:sr-only">
                    Negativní{' '}
                  </span>
                  {row.minus}
                </td>
                <td
                  role="cell"
                  className="results-score py-4 pl-2 text-right align-top font-mono font-semibold tabular-nums"
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
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {!detail && (
          <a className="wizard-link" href={`/admin/results/votings/${c.id}`}>
            Detail výsledků →
          </a>
        )}
        <a className="wizard-link" href={`/admin/dashboard/votings/${c.id}`}>
          Průběh kategorie
        </a>
        {detail && (
          <a className="wizard-link" href={`/admin/votings/${c.id}`}>
            Správa kategorie
          </a>
        )}
      </div>
    </section>
  );
}
