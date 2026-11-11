import { ResultsDetail } from '../results/Results';
import { CategoryDetail } from '../dashboard/CategoryDetail';
import { useEffect, useRef, useState } from 'react';
import { adminEventListSchema } from '@d21/contracts';
import { AdminHeader } from './AdminHeader';
import {
  AdminEventContext,
  preparationView,
  type AdminEventLocation,
  type EventDestination,
  type EventSection,
} from './event-context';
import { adminDataChanged } from './api';
import { useResource } from './useResource';
import './admin-shell.css';
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
  const isVoting = path.startsWith('/admin/votings/');
  const isDetail = Boolean(
    resultsCategoryId || dashboardCategoryId || isVoting,
  );
  let section: EventSection = 'preparation';
  if (path.endsWith('/results')) {
    section = 'results';
  } else if (path.endsWith('/dashboard')) {
    section = 'progress';
  }

  const events = useResource('/events', adminEventListSchema, onExpired);
  const reloadEvents = events.reload;
  useEffect(() => {
    window.addEventListener(adminDataChanged, reloadEvents);
    return () => window.removeEventListener(adminDataChanged, reloadEvents);
  }, [reloadEvents]);

  const previousPath = useRef(path);
  useEffect(() => {
    if (path === '/admin/events' && path !== previousPath.current) {
      reloadEvents();
    }
    previousPath.current = path;
  }, [path, reloadEvents]);

  const [context, setContext] = useState<AdminEventLocation>();
  const currentContext = context?.path === path ? context : undefined;
  const currentEvent = isDetail
    ? currentContext?.event
    : (events.data?.find(({ id }) => id === eventId) ?? currentContext?.event);
  let destination: EventDestination =
    section === 'preparation' ? preparationView(search) : section;
  if (isDetail && currentContext) {
    destination = currentContext.destination;
  }
  let content;
  if (resultsCategoryId) {
    content = (
      <ResultsDetail
        key={resultsCategoryId}
        votingId={resultsCategoryId}
        onExpired={onExpired}
      />
    );
  } else if (dashboardCategoryId) {
    content = (
      <CategoryDetail
        key={dashboardCategoryId}
        votingId={dashboardCategoryId}
        search={search}
        onExpired={onExpired}
      />
    );
  } else if (isVoting && eventId) {
    content = (
      <VotingDetail
        key={eventId}
        votingId={eventId}
        search={search}
        onExpired={onExpired}
      />
    );
  } else if (eventId) {
    content = (
      <EventDetail
        key={eventId}
        eventId={eventId}
        section={section}
        search={search}
        card={events.data?.find(({ id }) => id === eventId)}
        reloadCard={reloadEvents}
        onExpired={onExpired}
      />
    );
  } else {
    content = <EventList resource={events} onExpired={onExpired} />;
  }

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:inline-flex focus:min-h-11 focus:items-center focus:px-6"
      >
        Přeskočit na obsah
      </a>
      <AdminHeader
        event={currentEvent}
        showEventListLink={Boolean(eventId)}
        events={events.data}
        destination={destination}
        logout={logout}
        busy={busy}
      />
      <AdminEventContext.Provider value={setContext}>
        <main
          id="main"
          tabIndex={-1}
          className="admin-workspace mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8"
        >
          {error}
          {content}
        </main>
      </AdminEventContext.Provider>
    </>
  );
}
