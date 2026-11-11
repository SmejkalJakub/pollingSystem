import { ResultsDetail } from '../results/Results';
import { CategoryDetail } from '../dashboard/CategoryDetail';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { EventList } from './EventList';
import { EventDetail } from './EventDetail';
import { VotingDetail } from './VotingDetail';
import { useAdminNavigation } from './navigation';
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
  const location = useAdminNavigation();
  const [pathname, search] = location.split('?');
  const path = pathname!.replace(/\/+$/, '');
  const eventId = path.split('/')[3];
  const dashboardCategoryId =
    /^\/admin\/dashboard\/votings\/([0-9a-f-]{36})$/i.exec(path)?.[1];
  const resultsCategoryId =
    /^\/admin\/results\/votings\/([0-9a-f-]{36})$/i.exec(path)?.[1];
  const section = path.endsWith('/results')
    ? 'results'
    : path.endsWith('/dashboard')
      ? 'progress'
      : 'preparation';
  const isVoting = path.startsWith('/admin/votings/');
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
        className="admin-workspace mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8"
      >
        {error}
        {resultsCategoryId ? (
          <ResultsDetail
            key={resultsCategoryId}
            votingId={resultsCategoryId}
            onExpired={onExpired}
          />
        ) : dashboardCategoryId ? (
          <CategoryDetail
            key={dashboardCategoryId}
            votingId={dashboardCategoryId}
            onExpired={onExpired}
          />
        ) : isVoting && eventId ? (
          <VotingDetail
            key={eventId}
            votingId={eventId}
            onExpired={onExpired}
          />
        ) : eventId ? (
          <EventDetail
            key={eventId}
            eventId={eventId}
            section={section}
            search={search}
            onExpired={onExpired}
          />
        ) : (
          <EventList onExpired={onExpired} />
        )}
      </main>
    </>
  );
}
