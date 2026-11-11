import './category.css';
import { EventHeading } from './EventNavigation';
import { BallotUnlock } from './BallotUnlock';
import { VotingLifecycleActions } from './VotingLifecycleActions';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { eventSchema, votingRecordSchema } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { useResource } from './useResource';
import { ResourceState } from './ResourceState';
import { VotingActivation } from './VotingActivation';
import { votingStatusLabels } from './votingFields';
import { VotingGroups } from './VotingGroups';
import { VotingItems } from './VotingItems';
import { VotingConfiguration } from './VotingConfiguration';

const VotingSetup = lazy(() =>
  import('./VotingSetup').then((module) => ({ default: module.VotingSetup })),
);

export function VotingDetail({
  votingId,
  search,
  onExpired,
}: {
  votingId: string;
  search?: string;
  onExpired: () => void;
}) {
  const resource = useResource(
    `/votings/${votingId}`,
    votingRecordSchema,
    onExpired,
  );
  const [activating, setActivating] = useState(false);
  const [notice, setNotice] = useState('');
  const activationNotice = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice) {
      activationNotice.current?.focus();
    }
  }, [notice]);
  const [showSetup, setShowSetup] = useState(false);
  return (
    <>
      <ResourceState
        resource={resource}
        errorTitle="Kategorii se nepodařilo načíst"
      />
      {resource.data && (
        <>
          <VotingEventHeading
            eventId={resource.data.eventId}
            onExpired={onExpired}
          />
          <a
            href={`/admin/events/${resource.data.eventId}?setup=categories`}
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            ← Kategorie
          </a>
          <div className="mt-1 flex flex-col gap-5 sm:flex-row sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
              <h1 className="category-editor-title">{resource.data.name}</h1>
              <span
                className={
                  resource.data.status === 'draft'
                    ? 'category-status bg-warning-soft text-warning-text'
                    : 'category-status bg-secondary'
                }
              >
                {resource.data.status === 'active'
                  ? 'Otevřeno'
                  : votingStatusLabels[resource.data.status]}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {resource.data.status !== 'draft' && (
                <Button asChild className="min-h-11" variant="outline">
                  <a href={`/admin/results/votings/${votingId}`}>
                    Výsledky kategorie
                  </a>
                </Button>
              )}
              <VotingLifecycleActions
                voting={resource.data}
                onExpired={onExpired}
                onChanged={resource.reload}
                disabled={resource.loading}
              />
              {resource.data.status !== 'draft' && (
                <Button
                  className="min-h-11"
                  variant="ghost"
                  onClick={resource.reload}
                >
                  Obnovit přehled
                </Button>
              )}
            </div>
          </div>
          {notice && (
            <p
              ref={activationNotice}
              role="status"
              tabIndex={-1}
              className="mt-5 text-sm"
            >
              {notice}
            </p>
          )}
          {activating && resource.data.status === 'draft' && (
            <div className="mt-6">
              <VotingActivation
                votingId={votingId}
                onExpired={onExpired}
                onCancel={() => setActivating(false)}
                onActivated={() => {
                  setActivating(false);
                  setNotice('Hlasování bylo aktivováno.');
                  resource.reload();
                }}
              />
            </div>
          )}
          {resource.data.status !== 'draft' && (
            <section
              className="mt-8 border-t border-border pt-6"
              aria-labelledby="instructions-heading"
            >
              <h2 id="instructions-heading" className="text-lg font-semibold">
                Instrukce pro porotu
              </h2>
              <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">
                {resource.data.instructions ||
                  'Instrukce zatím nejsou vyplněné.'}
              </p>
            </section>
          )}
          {resource.data.status === 'draft' ? (
            <Suspense fallback={<p role="status">Načítání přípravy…</p>}>
              <VotingSetup
                eventId={resource.data.eventId}
                votingId={votingId}
                onExpired={onExpired}
                onSaved={resource.reload}
                requestedField={new URLSearchParams(search).get('field')}
                onActivate={() => {
                  setActivating(true);
                  setNotice('');
                }}
                paused={activating || resource.loading}
              />
            </Suspense>
          ) : (
            <>
              <details
                className="mt-6 rounded-xl border border-border bg-card p-5"
                onToggle={(event) => {
                  if (event.currentTarget.open) {
                    setShowSetup(true);
                  }
                }}
              >
                <summary className="min-h-11 cursor-pointer py-3 font-semibold">
                  Nastavení kategorie · uzamčeno
                </summary>
                {showSetup && (
                  <>
                    <VotingGroups
                      voting={resource.data}
                      onExpired={onExpired}
                    />
                    <VotingConfiguration
                      voting={resource.data}
                      onSaved={resource.reload}
                      onExpired={onExpired}
                    />
                    <VotingItems voting={resource.data} onExpired={onExpired} />
                  </>
                )}
              </details>
            </>
          )}
          {resource.data.status !== 'draft' && (
            <BallotUnlock votingId={votingId} onExpired={onExpired} />
          )}
        </>
      )}
    </>
  );
}

function VotingEventHeading({
  eventId,
  onExpired,
}: {
  eventId: string;
  onExpired: () => void;
}) {
  const resource = useResource(`/events/${eventId}`, eventSchema, onExpired);
  return (
    <>
      <ResourceState
        resource={resource}
        errorTitle="Event se nepodařilo načíst"
      />
      {resource.data && (
        <EventHeading
          event={resource.data}
          section="preparation"
          showTitle={false}
        />
      )}
    </>
  );
}
