import { createContext } from 'react';

export type EventSection = 'preparation' | 'progress' | 'results';
export type PreparationView = 'jurors' | 'teams' | 'categories' | 'settings';
export type EventDestination = PreparationView | 'progress' | 'results';

export type AdminEventLocation = {
  path: string;
  event: { id: string; name: string };
  destination: EventDestination;
};

export const AdminEventContext = createContext<
  (location: AdminEventLocation) => void
>(() => {});

export function preparationView(search?: string): PreparationView {
  const view = new URLSearchParams(search).get('setup');
  if (view === 'teams' || view === 'categories' || view === 'settings') {
    return view;
  }
  return 'jurors';
}

export function eventDestination(
  eventId: string,
  destination: EventDestination,
) {
  const base = `/admin/events/${eventId}`;
  if (destination === 'progress') {
    return `${base}/dashboard`;
  }
  if (destination === 'results') {
    return `${base}/results`;
  }
  return `${base}?setup=${destination}`;
}
