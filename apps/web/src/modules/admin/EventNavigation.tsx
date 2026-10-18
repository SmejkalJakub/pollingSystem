export type EventSection = 'preparation' | 'progress' | 'results';

export function EventNavigation({
  eventId,
  section,
}: {
  eventId: string;
  section: EventSection;
}) {
  const base = `/admin/events/${eventId}`;
  return (
    <nav aria-label="Event" className="event-navigation">
      {[
        ['preparation', 'Příprava', base],
        ['progress', 'Průběh hlasování', `${base}/dashboard`],
        ['results', 'Výsledky', `${base}/results`],
      ].map(([key, label, href]) => (
        <a
          key={key}
          href={href}
          aria-current={section === key ? 'page' : undefined}
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
}: {
  event: { id: string; name: string };
  section: EventSection;
}) {
  return (
    <header className="event-heading">
      <a className="wizard-link text-sm" href="/admin/events">
        ← Všechny eventy
      </a>
      <h1 className="mt-3 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
        {event.name}
      </h1>
      <EventNavigation eventId={event.id} section={section} />
    </header>
  );
}
