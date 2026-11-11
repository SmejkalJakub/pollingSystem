import '../admin/operations.css';
import { dashboardOverviewSchema, rosterSchema } from '@d21/contracts';
import { DashboardRefresh } from './DashboardRefresh';
import { ResourceState } from '../admin/ResourceState';
import { useResource } from '../admin/useResource';
import { DashboardState } from './DashboardState';
import { CategoryCard } from './CategoryCard';
import { czechCount } from '@/lib/plural';
import { ProgressMatrix } from './ProgressMatrix';
import { clockTime, problemLabels, timestamp } from './presentation';

export function Dashboard({
  eventId,
  onExpired,
  search,
}: {
  eventId: string;
  onExpired: () => void;
  search?: string;
}) {
  const resource = useResource(
    `/dashboard/overview?eventId=${eventId}`,
    dashboardOverviewSchema,
    onExpired,
  );
  const roster = useResource(
    `/events/${eventId}/roster`,
    rosterSchema,
    onExpired,
  );
  const data = resource.data;
  const categoryId = new URLSearchParams(search).get('category');
  const openCategories =
    data?.categories.filter((category) => category.status === 'active') ?? [];
  const invalidDrafts = openCategories.reduce(
    (sum, category) => sum + category.counts.invalid,
    0,
  );
  function refresh() {
    resource.reload();
    roster.reload();
  }
  return (
    <>
      <DashboardState resource={resource} />
      {data && (
        <>
          <div className="operations-page-head">
            <h1 id="dashboard-heading" tabIndex={-1} className="outline-none">
              Průběh hlasování
            </h1>
            <p>
              Načteno{' '}
              <time dateTime={data.asOf} title={timestamp(data.asOf)}>
                {clockTime(data.asOf)}
              </time>
            </p>
            <DashboardRefresh
              label="Obnovit"
              resource={{
                loading: resource.loading || roster.loading,
                error: resource.error ?? roster.error,
                reload: refresh,
              }}
            />
          </div>
          <dl className="operations-kpis">
            <div>
              <dt>Odevzdané lístky</dt>
              <dd>
                {data.totals.submitted} <small>/ {data.totals.expected}</small>
              </dd>
            </div>
            <div>
              <dt>Čekající porotci</dt>
              <dd>{data.totals.pendingJurors}</dd>
            </div>
            <div>
              <dt>Dokončené kategorie</dt>
              <dd>
                {data.totals.completedCategories}{' '}
                <small>/ {data.totals.categories}</small>
              </dd>
            </div>
            <div data-alert={data.totals.problemCategories > 0}>
              <dt>Ke kontrole</dt>
              <dd>
                {data.totals.problemCategories}
                {invalidDrafts > 0 && (
                  <small>
                    {' '}
                    {czechCount(invalidDrafts, {
                      one: 'neplatný návrh',
                      few: 'neplatné návrhy',
                      other: 'neplatných návrhů',
                    }).replace(/^\d+ /, '')}
                  </small>
                )}
              </dd>
            </div>
          </dl>
          {data.totals.problemCategories > 0 && (
            <section
              className="mt-10 border-l-2 border-primary pl-5"
              aria-labelledby="attention-heading"
            >
              <h2 id="attention-heading" className="text-xl font-semibold">
                Ke kontrole
              </h2>
              <ul className="mt-3 space-y-4">
                {data.categories
                  .filter((c) => c.status !== 'draft' && c.problems.length)
                  .map((c) => (
                    <li key={c.id}>
                      <a
                        className="wizard-link break-words font-medium"
                        href={`/admin/dashboard/votings/${c.id}`}
                      >
                        {c.name}
                      </a>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {c.problems.map((p) => (
                          <li key={p}>{problemLabels[p]}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
              </ul>
            </section>
          )}
          <ResourceState
            resource={roster}
            errorTitle="Přístupy porotců se nepodařilo načíst"
          />
          <ProgressMatrix
            key={categoryId}
            eventId={eventId}
            categories={data.categories}
            roster={roster.data}
            disabled={roster.loading || resource.loading}
            reload={roster.reload}
            onExpired={onExpired}
            categoryId={categoryId}
          />
          {openCategories.length > 0 && (
            <div className="operations-open-cards">
              {openCategories.map((c) => (
                <CategoryCard
                  key={c.id}
                  category={c}
                  onExpired={onExpired}
                  onChanged={resource.reload}
                  disabled={resource.loading}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
