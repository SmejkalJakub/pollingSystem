import { resultsOverviewSchema, resultsDetailSchema } from '@d21/contracts';
import { useResource } from '../admin/useResource';
import { DashboardRefresh } from '../dashboard/DashboardRefresh';
import { timestamp } from '../dashboard/presentation';
import { ResultsState } from './ResultsState';
import { ResultCategory } from './ResultCategory';
import { ExportResults } from './ExportResults';

function ResultsContent({
  data,
  resource,
}: {
  data:
    | {
        event: { id: string; name: string };
        asOf: string;
      }
    | undefined;
  resource: {
    data?: unknown;
    loading: boolean;
    error?: unknown;
    reload: () => void;
  };
}) {
  return (
    <>
      <a
        className="wizard-link text-sm"
        href={data ? `/admin/events/${data.event.id}` : '/admin/events'}
      >
        ← {data ? 'Správa eventu' : 'Všechny eventy'}
      </a>
      <ResultsState resource={resource} />
      {data && (
        <>
          <p className="eyebrow mt-6 break-words">
            {data.event.name} / Výsledky
          </p>
          <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <h1
              id="results-heading"
              tabIndex={-1}
              className="min-w-0 break-words text-3xl font-semibold outline-none"
            >
              Výsledky hlasování
            </h1>
            <DashboardRefresh resource={resource} />
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Pouze aktuálně odevzdané lístky oprávněných porotců. Uložené návrhy
            ani historie se nezapočítávají. Finální výsledek vyžaduje uzavření,
            všechna odevzdání a žádný datový problém či shodu přes hranici
            výběru.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Data k {timestamp(data.asOf)}. Pro aktuální stav obnovte přehled.
          </p>
        </>
      )}
    </>
  );
}

export function Results({
  eventId,
  onExpired,
}: {
  eventId: string;
  onExpired: () => void;
}) {
  const resource = useResource(
    `/results/overview?eventId=${eventId}`,
    resultsOverviewSchema,
    onExpired,
  );
  return (
    <>
      <ResultsContent data={resource.data} resource={resource} />
      {resource.data && (
        <ExportResults eventId={eventId} onExpired={onExpired} />
      )}
      {resource.data &&
        (resource.data.categories.length ? (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
            {resource.data.categories.map((c) => (
              <ResultCategory key={c.id} category={c} />
            ))}
          </div>
        ) : (
          <p className="mt-8 border border-border bg-card p-6 text-muted-foreground">
            Event zatím nemá žádné hlasovací kategorie.
          </p>
        ))}
    </>
  );
}

export function ResultsDetail({
  votingId,
  onExpired,
}: {
  votingId: string;
  onExpired: () => void;
}) {
  const resource = useResource(
    `/results/votings/${votingId}`,
    resultsDetailSchema,
    onExpired,
  );
  const data = resource.data;
  return (
    <>
      <ResultsContent data={data} resource={resource} />
      {data && (
        <>
          <a
            className="wizard-link mt-4 text-sm"
            href={`/admin/events/${data.event.id}/results`}
          >
            ← Všechny výsledky eventu
          </a>
          <div className="mt-8">
            <ResultCategory category={data.category} detail />
          </div>
        </>
      )}
    </>
  );
}
