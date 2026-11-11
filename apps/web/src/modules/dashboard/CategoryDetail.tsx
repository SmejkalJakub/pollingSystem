import { juryGroupLabel } from '@d21/contracts';
import { useEffect, useRef, useState } from 'react';
import { adminBallotsSchema, type AdminBallot } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { UnlockBallotForm } from '../admin/BallotUnlock';
import { ResourceState } from '../admin/ResourceState';
import { VotingLifecycleActions } from '../admin/VotingLifecycleActions';
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

export function JurorRows({
  category: c,
  ballots,
  onExpired,
  onChanged,
  disabled,
}: {
  category: DashboardCategory;
  ballots: AdminBallot[];
  onExpired: () => void;
  onChanged: () => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<AdminBallot>();
  const [notice, setNotice] = useState('');
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice) feedback.current?.focus();
  }, [notice]);
  const byJuror = new Map(ballots.map((ballot) => [ballot.jurorId, ballot]));
  return (
    <>
      {notice && (
        <p ref={feedback} tabIndex={-1} role="status" className="mt-4 text-sm">
          {notice}
        </p>
      )}
      <ul className="mt-5 divide-y divide-border">
        {c.jurors.map((j) => (
          <li
            key={j.id}
            className="flex min-w-0 flex-wrap justify-between gap-3 py-4"
          >
            <div className="min-w-0">
              <p className="break-words font-medium">
                {j.displayName}{' '}
                <span className="text-sm text-muted-foreground">
                  ·{' '}
                  {juryGroupLabel(
                    c.groups.find((g) => g.id === j.groupId)?.code,
                  )}
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
              {byJuror.get(j.id)?.status === 'submitted' && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 min-h-11"
                  disabled={disabled || Boolean(selected)}
                  aria-label={`Odemknout lístek: ${j.displayName}, ${j.id}`}
                  onClick={() => {
                    setNotice('');
                    setSelected(byJuror.get(j.id));
                  }}
                >
                  Odemknout porotci
                </Button>
              )}
            </div>
            {selected?.jurorId === j.id && (
              <div className="w-full">
                <UnlockBallotForm
                  votingId={c.id}
                  ballot={selected}
                  onExpired={onExpired}
                  cancel={() => setSelected(undefined)}
                  done={() => {
                    setSelected(undefined);
                    setNotice(
                      'Lístek byl odemčen porotci. Historie odevzdání je zachovaná.',
                    );
                    onChanged();
                  }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
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
  const ballots = useResource(
    `/votings/${votingId}/ballots`,
    adminBallotsSchema,
    onExpired,
  );
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
            <DashboardRefresh
              resource={{
                loading: resource.loading || ballots.loading,
                error: resource.error ?? ballots.error,
                reload() {
                  resource.reload();
                  ballots.reload();
                },
              }}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-start gap-3">
            <VotingLifecycleActions
              voting={data.category}
              onExpired={onExpired}
              onChanged={() => {
                resource.reload();
                ballots.reload();
              }}
              disabled={resource.loading}
            />
            <a
              className="wizard-link text-sm"
              href={`/admin/results/votings/${votingId}`}
            >
              Výsledky kategorie
            </a>
            <a
              className="wizard-link text-sm"
              href={`/admin/votings/${votingId}`}
            >
              Nastavení kategorie
            </a>
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
                  label={`Porota ${juryGroupLabel(data.category.groups.find((group) => group.id === g.groupId)?.code)}`}
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
            <ResourceState resource={ballots} />
            {data.category.jurors.length ? (
              <JurorRows
                category={data.category}
                ballots={ballots.data ?? []}
                onExpired={onExpired}
                disabled={ballots.loading || resource.loading}
                onChanged={() => {
                  resource.reload();
                  ballots.reload();
                }}
              />
            ) : (
              <p className="mt-5 text-muted-foreground">
                Žádní oprávnění porotci.
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}
