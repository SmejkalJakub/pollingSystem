import { useEffect, useRef, useState } from 'react';
import type { AdminEventCard } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { EventNavigation } from './EventNavigation';
import { eventDestination, type EventDestination } from './event-context';

export function AdminHeader({
  event,
  showEventListLink,
  events,
  destination,
  logout,
  busy,
}: {
  event?: { id: string; name: string };
  showEventListLink: boolean;
  events?: AdminEventCard[];
  destination: EventDestination;
  logout: () => void;
  busy: boolean;
}) {
  const card = events?.find(({ id }) => id === event?.id);
  return (
    <header className="admin-header">
      <div className="admin-header-inner">
        <div className="admin-header-top">
          <span className="admin-brand">D21</span>
          {showEventListLink ? (
            <a className="admin-header-link" href="/admin/events">
              Eventy
            </a>
          ) : (
            <span className="font-semibold">Eventy</span>
          )}
          {event && (
            <>
              <span aria-hidden="true" className="text-header-muted">
                /
              </span>
              <EventSwitcher
                key={event.id}
                event={event}
                events={events}
                destination={destination}
              />
            </>
          )}
          <Button
            variant="ghost"
            className="admin-logout ml-auto min-h-11 shrink-0"
            onClick={logout}
            disabled={busy}
          >
            {busy ? 'Odhlašování…' : 'Odhlásit se'}
          </Button>
        </div>
        {event && (
          <EventNavigation
            eventId={event.id}
            destination={destination}
            card={card}
          />
        )}
      </div>
    </header>
  );
}

function EventSwitcher({
  event,
  events,
  destination,
}: {
  event: { id: string; name: string };
  events?: AdminEventCard[];
  destination: EventDestination;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) {
      return;
    }
    function outside(pointer: PointerEvent) {
      if (
        pointer.target instanceof Node &&
        !root.current?.contains(pointer.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  return (
    <div
      className="admin-event-switcher"
      ref={root}
      onBlur={(blur) => {
        if (!blur.currentTarget.contains(blur.relatedTarget)) {
          setOpen(false);
        }
      }}
      onKeyDown={(key) => {
        if (key.key === 'Escape' && open) {
          key.preventDefault();
          setOpen(false);
          opener.current?.focus();
        }
      }}
    >
      <button
        ref={opener}
        type="button"
        className="admin-switcher-trigger"
        aria-expanded={open}
        aria-controls="admin-event-options"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{event.name}</span>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          className="shrink-0"
        >
          <path
            d="m4 6 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <ul
        id="admin-event-options"
        className="admin-event-options"
        hidden={!open}
      >
        {events?.map((option) => (
          <li key={option.id}>
            {option.id === event.id ? (
              <span aria-current="true">{option.name}</span>
            ) : (
              <a href={eventDestination(option.id, destination)}>
                {option.name}
              </a>
            )}
          </li>
        ))}
        {!events && (
          <li>
            <a href="/admin/events">Všechny eventy</a>
          </li>
        )}
      </ul>
    </div>
  );
}
