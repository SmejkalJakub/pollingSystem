import { Results, ResultsDetail } from '../results/Results';
import { Dashboard } from '../dashboard/Dashboard';
import { CategoryDetail } from '../dashboard/CategoryDetail';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { EventList } from './EventList';
import { EventDetail } from './EventDetail';
import { VotingDetail } from './VotingDetail';
export function AdminWorkspace({
  onExpired,
  logout,
  busy,
  error,
}: {
  onExpired: () => void;
  logout: () => void;
  busy: boolean;
  error: React.ReactNode;
}) {
  const eventId = window.location.pathname.split('/')[3];
  const path = window.location.pathname.replace(/\/+$/, '');
  const dashboardCategoryId =
    /^\/admin\/dashboard\/votings\/([0-9a-f-]{36})$/i.exec(path)?.[1];
  const resultsCategoryId =
    /^\/admin\/results\/votings\/([0-9a-f-]{36})$/i.exec(path)?.[1];
  const isResults = path.endsWith('/results') || !!resultsCategoryId;
  const isDashboard = path.endsWith('/dashboard');
  const isVoting = window.location.pathname.startsWith('/admin/votings/');
  return (
    <>
      <AppHeader section="Administrace" />
      <div className="border-b border-border">
        <nav
          aria-label="Administrace"
          className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6"
        >
          <a
            href="/admin/events"
            aria-current={
              !isResults && !isDashboard && !dashboardCategoryId
                ? 'page'
                : undefined
            }
            className={`inline-flex min-h-14 items-center border-b-2 ${!isResults && !isDashboard && !dashboardCategoryId ? 'border-primary' : 'border-transparent'} text-sm font-medium outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring`}
          >
            Eventy
          </a>
          {(isDashboard || dashboardCategoryId) && (
            <span className="inline-flex min-h-14 items-center border-b-2 border-primary text-sm font-medium">
              Průběh
            </span>
          )}
          {isResults && (
            <span className="inline-flex min-h-14 items-center border-b-2 border-primary text-sm font-medium">
              Výsledky
            </span>
          )}
          <Button
            className="min-h-11"
            variant="ghost"
            onClick={logout}
            disabled={busy}
          >
            {busy ? 'Odhlašování…' : 'Odhlásit se'}
          </Button>
        </nav>
      </div>
      <main id="main" className="mx-auto max-w-5xl px-6 py-8 sm:py-12">
        {error}
        {resultsCategoryId ? (
          <ResultsDetail
            key={resultsCategoryId}
            votingId={resultsCategoryId}
            onExpired={onExpired}
          />
        ) : isResults && eventId ? (
          <Results key={eventId} eventId={eventId} onExpired={onExpired} />
        ) : dashboardCategoryId ? (
          <CategoryDetail
            key={dashboardCategoryId}
            votingId={dashboardCategoryId}
            onExpired={onExpired}
          />
        ) : isDashboard && eventId ? (
          <Dashboard key={eventId} eventId={eventId} onExpired={onExpired} />
        ) : isVoting && eventId ? (
          <VotingDetail
            key={eventId}
            votingId={eventId}
            onExpired={onExpired}
          />
        ) : eventId ? (
          <EventDetail key={eventId} eventId={eventId} onExpired={onExpired} />
        ) : (
          <EventList onExpired={onExpired} />
        )}
      </main>
    </>
  );
}
