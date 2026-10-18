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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:inline-flex focus:min-h-11 focus:items-center focus:px-6"
      >
        Přeskočit na obsah
      </a>
      <AppHeader
        section="Administrace"
        actions={
          <nav aria-label="Administrace" className="flex items-center gap-2">
            <a
              className="wizard-link text-sm"
              href="/admin/events"
              aria-current={!eventId ? 'page' : undefined}
            >
              Eventy
            </a>
            <Button
              className="min-h-11"
              variant="ghost"
              onClick={logout}
              disabled={busy}
            >
              {busy ? 'Odhlašování…' : 'Odhlásit se'}
            </Button>
          </nav>
        }
      />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6"
      >
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
