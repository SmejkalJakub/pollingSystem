import { EventHeading } from '../admin/EventNavigation';
import { resultsOverviewSchema, resultsDetailSchema } from '@d21/contracts';
import { useResource } from '../admin/useResource';
import { DashboardRefresh } from '../dashboard/DashboardRefresh';
import { timestamp } from '../dashboard/presentation';
import { ResultsState } from './ResultsState';
import { ResultCategory } from './ResultCategory';
import { ExportResults } from './ExportResults';
import { JurorVotesList } from './JurorVotesList';
import type { ReactNode } from 'react';

function ResultsContent({
  data,
  resource,
  exportAction,
  showEvent = false,
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
  exportAction?: ReactNode;
  showEvent?: boolean;
}) {
  return (
    <>
      <ResultsState resource={resource} />
      {data && (
        <>
          {showEvent && <EventHeading event={data.event} section="results" />}
          <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <h2
                id="results-heading"
                tabIndex={-1}
                className="section-title outline-none"
              >
                Výsledky hlasování
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Data k {timestamp(data.asOf)}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <DashboardRefresh resource={resource} />
              {exportAction}
            </div>
          </div>
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
      <ResultsContent
        data={resource.data}
        resource={resource}
        exportAction={<ExportResults eventId={eventId} onExpired={onExpired} />}
      />
      {resource.data &&
        (resource.data.categories.length ? (
          <div
            className={`mt-5 grid items-start gap-6 ${resource.data.categories.length > 1 ? 'lg:grid-cols-2' : ''}`}
          >
            {resource.data.categories.map((c) => (
              <ResultCategory key={c.id} category={c} />
            ))}
          </div>
        ) : (
          <p className="mt-8 border border-border bg-card p-6 text-muted-foreground">
            Event zatím nemá žádné hlasovací kategorie.
          </p>
        ))}
      {resource.data && (
        <details className="mt-5 border-t border-border text-sm">
          <summary className="min-h-11 cursor-pointer py-3 font-medium">
            Jak se počítají výsledky a co obsahuje export
          </summary>
          <p className="max-w-2xl pb-3 text-muted-foreground">
            Počítají se jen aktuálně odevzdané lístky oprávněných porotců.
            Finální výsledek vyžaduje uzavření, všechna odevzdání a žádný datový
            problém ani shodu přes hranici výběru. Excel obsahuje čerstvý
            přehled kategorií, skóre týmů, účast a jednotlivé hlasy porotců.
          </p>
        </details>
      )}
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
      <ResultsContent data={data} resource={resource} showEvent />
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
          <JurorVotesList
            category={data.category}
            jurorVotes={data.jurorVotes}
          />
        </>
      )}
    </>
  );
}
