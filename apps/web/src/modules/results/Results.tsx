import type { z } from 'zod';
import { EventHeading } from '../admin/EventNavigation';
import {
  resultsOverviewSchema,
  resultsDetailSchema,
  type ResultsCategory,
} from '@d21/contracts';
import { useResource } from '../admin/useResource';
import { DashboardRefresh } from '../dashboard/DashboardRefresh';
import { Progress } from '../dashboard/CategoryCard';
import { clockTime, timestamp } from '../dashboard/presentation';
import { VotingLifecycleActions } from '../admin/VotingLifecycleActions';
import { ResultsState } from './ResultsState';
import { ResultCategory } from './ResultCategory';
import { ExportResults } from './ExportResults';
import { JurorVotesList } from './JurorVotesList';

type ResultsProps = {
  onExpired: () => void;
};

function ResultsHeader({
  eventId,
  asOf,
  resource,
  onExpired,
}: {
  eventId: string;
  asOf: string;
  resource: Parameters<typeof DashboardRefresh>[0]['resource'];
  onExpired: () => void;
}) {
  return (
    <div className="operations-page-head">
      <h1 id="results-heading" tabIndex={-1} className="outline-none">
        Výsledky
      </h1>
      <p>
        Počítají se jen odevzdané lístky · načteno{' '}
        <time dateTime={asOf} title={timestamp(asOf)}>
          {clockTime(asOf)}
        </time>
      </p>
      <div className="ml-auto flex flex-wrap items-start gap-2">
        <DashboardRefresh resource={resource} label="Obnovit" />
        <ExportResults eventId={eventId} onExpired={onExpired} />
      </div>
    </div>
  );
}

function CategoryNavigation({
  categories,
  currentId,
}: {
  categories: ResultsCategory[];
  currentId?: string;
}) {
  return (
    <nav
      aria-label="Výsledky podle kategorií"
      className="mb-4 flex flex-wrap gap-2"
    >
      {categories.map((category) => (
        <a
          key={category.id}
          href={`/admin/results/votings/${category.id}`}
          aria-current={category.id === currentId ? 'page' : undefined}
          className="operations-filter operations-tab"
        >
          {category.name}{' '}
          <span>· {category.stage === 'final' ? 'finální' : 'průběžný'}</span>
        </a>
      ))}
    </nav>
  );
}

function RankingLayout({
  category,
  detail,
  onExpired,
  onChanged,
  disabled,
}: {
  category: ResultsCategory;
  detail?: boolean;
  onExpired: () => void;
  onChanged: () => void;
  disabled: boolean;
}) {
  const active = category.status === 'active';
  const pendingHref = active
    ? `/admin/events/${category.eventId}/dashboard?category=${category.id}`
    : `/admin/dashboard/votings/${category.id}?filter=pending`;
  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <ResultCategory category={category} detail={detail} />
      <aside
        aria-label="Účast a výpočet výsledků"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1"
      >
        <section className="min-w-0 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">
            {category.stage === 'final'
              ? 'Účast v kategorii'
              : 'Dokončit kategorii'}
          </h2>
          <Progress {...category.counts} label="Odevzdáno" />
          {category.counts.pending > 0 && category.status !== 'draft' && (
            <a className="wizard-link mt-2 text-sm" href={pendingHref}>
              Kdo ještě neodevzdal →
            </a>
          )}
          {active && (
            <div className="mt-3">
              <VotingLifecycleActions
                voting={category}
                onExpired={onExpired}
                onChanged={onChanged}
                disabled={disabled}
                closeConfirmation
                closeLabel="Uzavřít hlasování…"
              />
            </div>
          )}
          {category.stage === 'provisional' && (
            <p className="mt-3 text-sm text-muted-foreground">
              Po uzavření a odevzdání všech lístků se výsledek změní na finální.
            </p>
          )}
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Jak se počítá</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Skóre = kladné − záporné hlasy. Shodné skóre sdílí pořadí (1, 2, 2,
            4).
          </p>
        </section>
      </aside>
    </div>
  );
}

export function Results({
  eventId,
  onExpired,
}: ResultsProps & { eventId: string }) {
  const resource = useResource(
    `/results/overview?eventId=${eventId}`,
    resultsOverviewSchema,
    onExpired,
  );
  const data = resource.data;
  const category = data?.categories[0];
  return (
    <>
      <ResultsState resource={resource} />
      {data && (
        <>
          <ResultsHeader
            eventId={eventId}
            asOf={data.asOf}
            resource={resource}
            onExpired={onExpired}
          />
          {category ? (
            <>
              <CategoryNavigation categories={data.categories} />
              <RankingLayout
                category={category}
                onExpired={onExpired}
                disabled={resource.loading}
                onChanged={resource.reload}
              />
            </>
          ) : (
            <p className="mt-5 rounded-xl border border-border bg-card p-5 text-muted-foreground">
              Event zatím nemá žádné hlasovací kategorie.
            </p>
          )}
        </>
      )}
    </>
  );
}

function DetailContent({
  data,
  resource,
  onExpired,
}: ResultsProps & {
  data: z.infer<typeof resultsDetailSchema>;
  resource: Parameters<typeof DashboardRefresh>[0]['resource'];
}) {
  const overview = useResource(
    `/results/overview?eventId=${data.event.id}`,
    resultsOverviewSchema,
    onExpired,
  );
  const categories = overview.data?.categories ?? [data.category];
  function refresh() {
    resource.reload();
    overview.reload();
  }
  return (
    <>
      <EventHeading event={data.event} section="results" showTitle={false} />
      <ResultsHeader
        eventId={data.event.id}
        asOf={data.asOf}
        onExpired={onExpired}
        resource={{
          loading: resource.loading || overview.loading,
          error: resource.error ?? overview.error,
          reload: refresh,
        }}
      />
      {Boolean(overview.error) && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Seznam kategorií se nepodařilo načíst. Použijte Obnovit.
        </p>
      )}
      <CategoryNavigation
        categories={categories.map((category) =>
          category.id === data.category.id ? data.category : category,
        )}
        currentId={data.category.id}
      />
      <RankingLayout
        category={data.category}
        detail
        onExpired={onExpired}
        disabled={resource.loading}
        onChanged={refresh}
      />
      <JurorVotesList category={data.category} jurorVotes={data.jurorVotes} />
    </>
  );
}

export function ResultsDetail({
  votingId,
  onExpired,
}: ResultsProps & { votingId: string }) {
  const resource = useResource(
    `/results/votings/${votingId}`,
    resultsDetailSchema,
    onExpired,
  );
  return (
    <>
      <ResultsState resource={resource} />
      {resource.data && (
        <DetailContent
          data={resource.data}
          resource={resource}
          onExpired={onExpired}
        />
      )}
    </>
  );
}
