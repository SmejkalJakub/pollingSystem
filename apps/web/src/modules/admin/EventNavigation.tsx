export type EventSection = 'preparation' | 'progress' | 'results';
type PreparationView = 'jurors' | 'teams' | 'categories';

export function EventNavigation({
  eventId,
  section,
  preparation = 'categories',
}: {
  eventId: string;
  section: EventSection;
  preparation?: PreparationView;
}) {
  const base = `/admin/events/${eventId}`;
  return (
    <nav aria-label="Event" className="event-navigation">
      <nav aria-label="Příprava">
        <span className="event-nav-label">Příprava</span>
        <div className="event-nav-links">
          {[
            ['jurors', 'Porotci'],
            ['teams', 'Týmy'],
            ['categories', 'Kategorie'],
          ].map(([key, label]) => (
            <a
              key={key}
              href={`${base}?setup=${key}`}
              aria-current={
                section === 'preparation' && preparation === key
                  ? 'page'
                  : undefined
              }
            >
              {label}
            </a>
          ))}
        </div>
      </nav>
      <div>
        <span className="event-nav-label">Hlasování</span>
        <div className="event-nav-links">
          {[
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
        </div>
      </div>
    </nav>
  );
}

export function EventHeading({
  event,
  section,
  preparation,
}: {
  event: { id: string; name: string };
  section: EventSection;
  preparation?: PreparationView;
}) {
  return (
    <header className="event-heading">
      <a className="wizard-link text-sm" href="/admin/events">
        ← Všechny eventy
      </a>
      <h1 className="page-title mt-1">{event.name}</h1>
      <EventNavigation
        eventId={event.id}
        section={section}
        preparation={preparation}
      />
    </header>
  );
}
