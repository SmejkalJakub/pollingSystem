import { EventHeading } from '../admin/EventNavigation';
import { dashboardDetailSchema, type DashboardCategory } from '@d21/contracts';
import { useResource } from '../admin/useResource';
import { DashboardState } from './DashboardState';
import { DashboardRefresh } from './DashboardRefresh';
import { Progress } from './CategoryCard';
import {
  lifecycleLabels,
  stateLabels,
  progressLabels,
  problemLabels,
  timestamp,
} from './presentation';

export function JurorRows({ category: c }: { category: DashboardCategory }) {
  return (
    <ul className="mt-5 divide-y divide-border">
      {c.jurors.map((j) => (
        <li
          key={j.id}
          className="flex min-w-0 flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0">
            <p className="break-words font-medium">
              {j.displayName}{' '}
              <span className="text-sm text-muted-foreground">
                · {c.groups.find((g) => g.id === j.groupId)?.code}
              </span>
            </p>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {j.id}
            </p>
          </div>
          <div className="shrink-0 text-sm sm:text-right">
            <p
              className={
                j.progress === 'invalid_draft' || j.progress === 'locked'
                  ? 'text-destructive'
                  : ''
              }
            >
              {progressLabels[j.progress]}
            </p>
            {j.submittedAt ? (
              <p className="mt-1 text-muted-foreground">
                Odevzdáno {timestamp(j.submittedAt)}
              </p>
            ) : j.savedAt ? (
              <p className="mt-1 text-muted-foreground">
                Uloženo {timestamp(j.savedAt)}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
export function CategoryDetail({
  votingId,
  onExpired,
}: {
  votingId: string;
  onExpired: () => void;
}) {
  const resource = useResource(
    `/dashboard/votings/${votingId}`,
    dashboardDetailSchema,
    onExpired,
  );
  const data = resource.data;
  return (
    <>
      <DashboardState resource={resource} />
      {data && (
        <>
          <EventHeading event={data.event} section="progress" />
          <a
            className="wizard-link mt-3 text-sm"
            href={`/admin/events/${data.event.id}/dashboard`}
          >
            ← Průběh eventu
          </a>
          <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <h2
              id="dashboard-heading"
              tabIndex={-1}
              className="outline-none min-w-0 break-words text-3xl font-semibold"
            >
              {data.category.name}
            </h2>
            <DashboardRefresh resource={resource} />
          </div>
          <p className="mt-4">
            {stateLabels[data.category.state]} ·{' '}
            {lifecycleLabels[data.category.status]}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Data k {timestamp(data.asOf)}. Obnovte přehled pro aktuální stav.
          </p>
          <div className="mt-8 border border-border bg-card p-6">
            <Progress
              {...data.category.counts}
              label="Odevzdané lístky kategorie"
            />
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {data.category.groupCounts.map((g) => (
                <Progress
                  key={g.groupId}
                  {...g.counts}
                  label={`Porota ${data.category.groups.find((group) => group.id === g.groupId)?.code}`}
                />
              ))}
            </div>
          </div>
          {data.category.problems.length > 0 && (
            <section className="mt-8" aria-labelledby="category-problems">
              <h2 id="category-problems" className="text-xl font-semibold">
                Ke kontrole
              </h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm">
                {data.category.problems.map((p) => (
                  <li key={p}>{problemLabels[p]}</li>
                ))}
              </ul>
            </section>
          )}
          <section className="mt-8" aria-labelledby="eligible-jurors">
            <h2 id="eligible-jurors" className="text-xl font-semibold">
              Oprávnění porotci ({data.category.counts.expected})
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.category.status === 'draft'
                ? 'Přehled plánovaného oprávnění; koncept ještě není otevřený.'
                : 'Odevzdané lístky jsou pro porotce uzamčené. Uložený návrh není odevzdání.'}
            </p>
            {data.category.jurors.length ? (
              <JurorRows category={data.category} />
            ) : (
              <p className="mt-5 text-muted-foreground">
                Žádní oprávnění porotci.
              </p>
            )}
          </section>
          <a
            className="wizard-link mt-6 text-sm"
            href={`/admin/votings/${votingId}`}
          >
            Správa kategorie a odemčení lístků →
          </a>
        </>
      )}
    </>
  );
}
