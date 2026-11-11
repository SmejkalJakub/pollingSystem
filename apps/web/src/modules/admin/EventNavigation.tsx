import { useContext, useLayoutEffect } from 'react';
import type { AdminEventCard } from '@d21/contracts';
import {
  AdminEventContext,
  eventDestination,
  type EventSection,
  type EventDestination,
  type PreparationView,
} from './event-context';

export function ReadinessMark({ ready }: { ready: boolean }) {
  return (
    <span
      className={`admin-readiness ${ready ? 'is-ready' : ''}`}
      role="img"
      aria-label={ready ? 'Připraveno' : 'Vyžaduje pozornost'}
    >
      {ready ? (
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="m3 8 3 3 7-7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        '!'
      )}
    </span>
  );
}

export function EventNavigation({
  eventId,
  destination,
  card,
}: {
  eventId: string;
  destination: EventDestination;
  card?: AdminEventCard;
}) {
  const setup = [
    {
      key: 'jurors',
      label: 'Porotci',
      count: card?.jurors,
      ready: Boolean(card?.jurors),
    },
    {
      key: 'teams',
      label: 'Týmy',
      count: card?.teams,
      ready: Boolean(card?.teams),
    },
    {
      key: 'categories',
      label: 'Kategorie',
      count: card && `${card.readyCategories}/${card.categories} připraveny`,
      ready: Boolean(
        card && card.categories > 0 && card.readyCategories === card.categories,
      ),
    },
  ] as const;
  const operations = [
    ['progress', 'Průběh hlasování'],
    ['results', 'Výsledky'],
    ['settings', 'Nastavení eventu'],
  ] as const;

  return (
    <nav aria-label="Event" className="admin-event-nav">
      <div role="group" aria-label="Příprava" className="admin-setup-nav">
        {setup.map(({ key, label, count, ready }) => (
          <a
            key={key}
            href={eventDestination(eventId, key)}
            aria-current={destination === key ? 'page' : undefined}
          >
            {card && <ReadinessMark ready={ready} />}
            {label}
            {card && (
              <span className="text-header-muted tabular-nums">{count}</span>
            )}
          </a>
        ))}
      </div>
      {operations.map(([key, label]) => (
        <a
          key={key}
          href={eventDestination(eventId, key)}
          aria-current={destination === key ? 'page' : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

export function EventHeading({
  event,
  section,
  preparation = 'categories',
  showTitle = true,
}: {
  event: { id: string; name: string };
  section: EventSection;
  preparation?: PreparationView;
  showTitle?: boolean;
}) {
  const report = useContext(AdminEventContext);
  const { id, name } = event;
  useLayoutEffect(() => {
    report({
      path: window.location.pathname.replace(/\/+$/, ''),
      event: { id, name },
      destination: section === 'preparation' ? preparation : section,
    });
  }, [id, name, section, preparation, report]);
  return showTitle ? (
    <h1 className="page-title mb-5 break-words">{name}</h1>
  ) : null;
}
