import { useRef, useState } from 'react';
import {
  juryGroupLabel,
  votingSetupSnapshotSchema,
  type DashboardCounts,
  type VotingRecord,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { categoryPlaces, categoryReadiness } from './category-readiness';
import { setupValues } from './voting-setup-utils';
import { useResource } from './useResource';
import { ResourceState } from './ResourceState';
import { VotingActivation } from './VotingActivation';
import { VotingLifecycleActions } from './VotingLifecycleActions';

export function VotingCategoryCard({
  voting,
  counts,
  onExpired,
  onChanged,
  disabled,
}: {
  voting: VotingRecord;
  counts?: DashboardCounts;
  onExpired: () => void;
  onChanged: () => void;
  disabled: boolean;
}) {
  const [activating, setActivating] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const setup = useResource(
    `/events/${voting.eventId}/votings/${voting.id}/setup`,
    votingSetupSnapshotSchema,
    onExpired,
  );
  const snapshot = setup.data;
  const readiness = snapshot && categoryReadiness(setupValues(snapshot));
  const groups = snapshot?.groups.filter(({ id }) =>
    snapshot.juryGroupIds.includes(id),
  );
  const href = `/admin/votings/${voting.id}`;
  const selection = voting.kind === 'selection';
  const placeLabel = categoryPlaces(voting.kind, voting.selectedPlaces);
  let label = 'Koncept';
  let state = 'draft';
  let pill = 'bg-warning-soft text-warning-text';
  if (voting.status === 'active') {
    label = 'Otevřeno';
    state = 'active';
    pill = 'bg-success-soft text-success-text';
  } else if (voting.status === 'closed' || voting.status === 'archived') {
    label = voting.status === 'closed' ? 'Uzavřeno' : 'Archivováno';
    state = voting.status;
    pill = 'bg-secondary text-foreground';
  } else if (snapshot?.editable && readiness?.issues.length === 0) {
    label = 'Připraveno';
    state = 'ready';
    pill = 'bg-selected-plus-bg text-primary';
  }

  return (
    <article
      className="category-panel"
      aria-labelledby={`category-${voting.id}`}
      data-status={state}
      data-incomplete={state === 'draft'}
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-[1_1_16rem]">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`category-status ${pill}`}>{label}</span>
            <p className="text-xs text-muted-foreground">
              {selection ? 'Výběrové kolo' : 'Finále'} · {placeLabel}
            </p>
          </div>
          <h2
            id={`category-${voting.id}`}
            ref={heading}
            tabIndex={-1}
            className="my-1 text-lg font-semibold"
          >
            <a href={href} className="hover:underline">
              {voting.name}
            </a>
          </h2>
          {snapshot && (
            <p className="text-sm text-muted-foreground">
              {readiness?.teamIds.size} týmů ·{' '}
              {groups?.length
                ? `${groups.map(({ code }) => juryGroupLabel(code)).join(' + ')} porota`
                : 'Porota nevybrána'}
              {voting.maxPlusVotes !== null &&
                voting.maxMinusVotes !== null &&
                ` · max ${voting.maxPlusVotes} + / ${voting.maxMinusVotes} −`}
            </p>
          )}
          <ResourceState
            resource={setup}
            errorTitle="Nastavení kategorie se nepodařilo načíst"
          />
        </div>
        {state === 'active' && counts && (
          <div className="min-w-36 flex-[0_1_12rem] text-sm">
            <p className="mb-1 text-muted-foreground">
              Odevzdáno{' '}
              <strong className="text-foreground tabular-nums">
                {counts.submitted} / {counts.expected}
              </strong>
            </p>
            <progress
              className="category-progress"
              max={counts.expected || 1}
              value={counts.submitted}
              aria-label="Odevzdané lístky"
            />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {state === 'draft' && (
            <Button asChild variant="outline" className="min-h-11">
              <a href={href}>Dokončit nastavení</a>
            </Button>
          )}
          {state === 'ready' && (
            <>
              <Button asChild variant="outline" className="min-h-11">
                <a href={href}>Upravit</a>
              </Button>
              <Button
                className="min-h-11"
                disabled={disabled || activating || setup.loading}
                onClick={() => setActivating(true)}
              >
                Otevřít hlasování
              </Button>
            </>
          )}
          {state === 'active' && (
            <Button asChild variant="outline" className="min-h-11">
              <a href={`/admin/dashboard/votings/${voting.id}`}>Průběh</a>
            </Button>
          )}
          {(state === 'active' || state === 'closed') && (
            <VotingLifecycleActions
              voting={voting}
              onExpired={onExpired}
              onChanged={onChanged}
              disabled={disabled}
              compact
            />
          )}
          {(state === 'closed' || state === 'archived') && (
            <Button asChild variant="outline" className="min-h-11">
              <a href={`/admin/results/votings/${voting.id}`}>Výsledky</a>
            </Button>
          )}
        </div>
      </div>
      {state === 'draft' && readiness && readiness.issues.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium text-warning-text">
            Před otevřením chybí:
          </p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {readiness.issues.map(({ field, label }) => (
              <li key={field}>
                <a
                  className="inline-flex min-h-11 items-center rounded-lg bg-warning-soft px-3 text-sm font-semibold text-warning-text hover:underline"
                  href={`${href}?field=${encodeURIComponent(field)}`}
                >
                  {label} →
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {state === 'draft' && snapshot && !snapshot.editable && (
        <p className="mt-3 text-sm text-warning-text">
          Nastavení kategorie je uzamčené.
        </p>
      )}
      {state === 'ready' && activating && (
        <div className="mt-4">
          <VotingActivation
            votingId={voting.id}
            onExpired={onExpired}
            onCancel={() => setActivating(false)}
            onActivated={() => {
              setActivating(false);
              heading.current?.focus();
              onChanged();
            }}
          />
        </div>
      )}
    </article>
  );
}
