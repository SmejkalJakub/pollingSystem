import { lazy, Suspense, useRef, useState } from 'react';
import {
  dashboardOverviewSchema,
  jurorTableSnapshotSchema,
  votingListSchema,
  type AdminEventCard,
} from '@d21/contracts';
import { czechCount } from '@/lib/plural';
import './roster.css';
import { Button } from '@/components/ui/button';
import { useResource } from './useResource';
import { ResourceState } from './ResourceState';
import { openSavedAdminPage } from './navigation';
import { ExportJurorLinks } from './ExportJurorLinks';
import { ReadinessMark } from './EventNavigation';
import { VotingCategoryCard } from './VotingCategoryCard';
import { juryCounts } from './category-readiness';
import './category.css';

const VotingSetup = lazy(() =>
  import('./VotingSetup').then((module) => ({ default: module.VotingSetup })),
);

const jurorForms = { one: 'porotce', few: 'porotci', other: 'porotců' };
const teamForms = { one: 'tým', few: 'týmy', other: 'týmů' };

function unfinishedText(card: AdminEventCard) {
  const unfinished = card.categories - card.readyCategories;
  if (card.categories === 0) {
    return 'Zatím žádná kategorie';
  }
  if (unfinished === 0) {
    return 'Všechny kategorie mají dokončené nastavení';
  }
  return `${czechCount(unfinished, {
    one: 'kategorie nemá',
    few: 'kategorie nemají',
    other: 'kategorií nemá',
  })} dokončené nastavení`;
}

export function VotingList({
  eventId,
  onExpired,
  card,
  reloadCard,
}: {
  eventId: string;
  onExpired: () => void;
  card?: AdminEventCard;
  reloadCard: () => void;
}) {
  const resource = useResource(
    `/events/${eventId}/votings`,
    votingListSchema,
    onExpired,
  );
  const roster = useResource(
    `/events/${eventId}/jurors/table`,
    jurorTableSnapshotSchema,
    onExpired,
  );
  const [creating, setCreating] = useState<string | null>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const eventPath = `/admin/events/${eventId}`;
  const categories = resource.data ?? [];
  const hasActive =
    !creating && categories.some(({ status }) => status === 'active');
  const dashboard = useResource(
    `/dashboard/overview?eventId=${eventId}`,
    dashboardOverviewSchema,
    onExpired,
    hasActive,
  );
  const counts = new Map(
    dashboard.data?.categories.map(({ id, counts }) => [id, counts]),
  );
  const groupCounts = juryCounts(roster.data);
  const countFor = (code: 'T' | 'V') =>
    roster.data?.groups.reduce(
      (sum, group) =>
        sum + (group.code === code ? (groupCounts?.get(group.id) ?? 0) : 0),
      0,
    );
  const withoutLink = roster.data?.jurors.filter(
    ({ access }) => access !== 'stored' && access !== 'legacy',
  ).length;

  function reloadCategories() {
    resource.reload();
    dashboard.reload();
    reloadCard();
  }

  return (
    <>
      <section className="roster-page-head" aria-labelledby="votings-heading">
        {creating ? (
          <h2 id="votings-heading" className="sr-only">
            Kategorie
          </h2>
        ) : (
          <>
            <h1 id="votings-heading">Kategorie</h1>
            <p>Každá kategorie se otevírá samostatně.</p>
            <div className="roster-page-actions">
              <Button
                ref={createButton}
                className="min-h-11"
                onClick={() => setCreating(crypto.randomUUID())}
              >
                <span aria-hidden="true">+</span> Nová kategorie
              </Button>
            </div>
          </>
        )}
      </section>
      {creating ? (
        <Suspense fallback={<p role="status">Načítání přípravy…</p>}>
          <VotingSetup
            eventId={eventId}
            votingId={creating}
            onExpired={onExpired}
            onCancel={() => {
              setCreating(null);
              requestAnimationFrame(() => createButton.current?.focus());
            }}
            onSaved={() => openSavedAdminPage(`/admin/votings/${creating}`)}
          />
        </Suspense>
      ) : (
        <>
          <ResourceState
            resource={resource}
            errorTitle="Kategorie se nepodařilo načíst"
          />
          <div className="category-layout mt-5">
            <div className="min-w-0">
              {resource.data && !categories.length && (
                <div className="category-panel">
                  <h2 className="text-lg font-semibold">
                    Zatím žádné hlasování
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Připravte koncept výběrového kola nebo finálové kategorie.
                  </p>
                </div>
              )}
              {hasActive && (
                <ResourceState
                  resource={dashboard}
                  errorTitle="Účast se nepodařilo načíst"
                />
              )}
              {categories.length > 0 && (
                <ul className="space-y-3" aria-label="Kategorie hlasování">
                  {categories.map((voting) => (
                    <li key={voting.id}>
                      <VotingCategoryCard
                        voting={voting}
                        counts={counts.get(voting.id)}
                        onExpired={onExpired}
                        onChanged={reloadCategories}
                        disabled={resource.loading}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <aside className="min-w-0 space-y-4">
              <section
                className="category-panel text-sm"
                aria-label="Připravenost eventu"
              >
                <h2 className="font-semibold">Připravenost eventu</h2>
                <ResourceState
                  resource={roster}
                  errorTitle="Porotu se nepodařilo načíst"
                />
                <ul className="mt-3 space-y-2">
                  {roster.data && (
                    <>
                      <li className="category-check">
                        <ReadinessMark ready={roster.data.jurors.length > 0} />
                        <a
                          className="wizard-link"
                          href={`${eventPath}?setup=jurors`}
                        >
                          {czechCount(roster.data.jurors.length, jurorForms)} ·{' '}
                          {countFor('T')} Technická, {countFor('V')} Veřejná
                        </a>
                      </li>
                      <li className="category-check">
                        <ReadinessMark
                          ready={Boolean(
                            roster.data.jurors.length && withoutLink === 0,
                          )}
                        />
                        <span>
                          {withoutLink === 0 && roster.data.jurors.length > 0
                            ? 'Osobní odkazy vytvořeny pro všechny'
                            : `${czechCount(withoutLink ?? 0, jurorForms)} bez odkazu`}
                        </span>
                      </li>
                    </>
                  )}
                  {card && (
                    <>
                      <li className="category-check">
                        <ReadinessMark ready={card.teams > 0} />
                        <a
                          className="wizard-link"
                          href={`${eventPath}?setup=teams`}
                        >
                          {czechCount(card.teams, teamForms)}
                        </a>
                      </li>
                      <li className="category-check">
                        <ReadinessMark
                          ready={
                            card.categories > 0 &&
                            card.readyCategories === card.categories
                          }
                        />
                        <span>{unfinishedText(card)}</span>
                      </li>
                    </>
                  )}
                </ul>
              </section>
              <section
                className="category-panel text-sm"
                aria-label="Rozeslat odkazy"
              >
                <h2 className="font-semibold">Rozeslat odkazy</h2>
                <p className="mb-3 mt-1 text-muted-foreground">
                  Odkazy se kopírují i jednotlivě v seznamu porotců.
                </p>
                <ExportJurorLinks
                  eventId={eventId}
                  onExpired={onExpired}
                  label="Stáhnout odkazy porotců (XLSX)"
                  disabled={!roster.data?.jurors.length}
                />
              </section>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
