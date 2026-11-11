import { useState } from 'react';
import {
  eventInputSchema,
  eventSchema,
  type AdminEventCard,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { adminRequest } from './api';
import type { useResource } from './useResource';
import { MutationForm } from './MutationForm';
import { ResourceState } from './ResourceState';
import { eventFields } from './formFields';
import { openSavedAdminPage } from './navigation';
import { ReadinessMark } from './EventNavigation';

const createFields = eventFields.map((field) => {
  if (field.key === 'description') {
    return {
      ...field,
      label: 'Popis pro porotce (nepovinný)',
      placeholder: 'Zobrazí se porotcům nad kategoriemi',
    };
  }
  return field;
});

export function EventList({
  resource,
  onExpired,
}: {
  resource: ReturnType<typeof useResource<AdminEventCard[]>>;
  onExpired: () => void;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Vaše eventy</h1>
          <p className="mt-1 text-muted-foreground">
            Otevřete event a pokračujte tam, kde jste skončili.
          </p>
        </div>
        <Button
          className="min-h-11 rounded-[10px]"
          onClick={() => setCreating(true)}
          disabled={creating}
        >
          + Nový event
        </Button>
      </div>
      {creating && (
        <div className="mt-6">
          <MutationForm
            layout="inline"
            title="Nový event"
            initial={{ name: '', description: '' }}
            fields={createFields}
            schema={eventInputSchema}
            submitLabel="Vytvořit a přidat týmy →"
            onExpired={onExpired}
            cancel={() => setCreating(false)}
            save={async (input) => {
              const created = await adminRequest('/events', eventSchema, {
                method: 'POST',
                body: input,
              });
              openSavedAdminPage(`/admin/events/${created.id}?setup=teams`);
            }}
          />
        </div>
      )}
      <ResourceState
        resource={resource}
        errorTitle="Seznam eventů se nepodařilo načíst"
      />
      {resource.data && (
        <section className="mt-6" aria-label="Seznam eventů">
          {resource.data.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-control-border bg-card p-8 sm:p-12">
              <h2 className="text-xl font-semibold">Začněte prvním eventem</h2>
              <p className="mt-3 max-w-lg text-muted-foreground">
                Založte akci, přidejte Technickou a Veřejnou porotu a přiřaďte
                porotce.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {resource.data.map((event) => (
                <li key={event.id} className="min-w-0">
                  <EventCard event={event} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

const statuses = {
  preparation: {
    label: 'Příprava',
    style: 'bg-warning-soft text-warning-text',
  },
  voting: { label: 'Hlasuje se', style: 'bg-success-soft text-success-text' },
  closed: { label: 'Uzavřeno', style: 'bg-secondary text-muted-foreground' },
};

function EventCard({ event }: { event: AdminEventCard }) {
  const base = `/admin/events/${event.id}`;
  const status = statuses[event.status];
  const categoriesReady =
    event.categories > 0 && event.readyCategories === event.categories;
  let href = base;
  let meta = event.categories
    ? `${event.readyCategories}/${event.categories} kategorií připraveno`
    : 'chybí kategorie';
  let details = (
    <ul className="space-y-1 text-sm tabular-nums">
      <li className="flex items-center gap-2">
        <ReadinessMark ready={event.jurors > 0} />
        {event.jurors} porotců
      </li>
      <li className="flex items-center gap-2">
        <ReadinessMark ready={event.teams > 0} />
        {event.teams} týmů
      </li>
      <li className="flex items-center gap-2">
        <ReadinessMark ready={categoriesReady} />
        {event.categories} kategorií
      </li>
    </ul>
  );
  if (event.status === 'voting') {
    href = `${base}/dashboard`;
    meta = `${event.openCategories} ze ${event.categories} kategorií otevřeno`;
    details = (
      <div className="space-y-3 text-sm text-muted-foreground tabular-nums">
        <div>
          <p>
            Odevzdané lístky{' '}
            <strong className="text-foreground">
              {event.submitted} / {event.expected}
            </strong>
          </p>
          <div
            className="mt-1 h-2 overflow-hidden rounded-full bg-secondary"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{
                width: `${event.expected ? (100 * event.submitted) / event.expected : 0}%`,
              }}
            />
          </div>
        </div>
        <p>
          {event.jurors} porotců · {event.teams} týmů
        </p>
      </div>
    );
  } else if (event.status === 'closed') {
    href = `${base}/results`;
    meta = '';
    details = (
      <>
        <p className="text-sm text-muted-foreground">
          Všechny kategorie uzavřeny
        </p>
        <span className="text-sm font-semibold text-primary">Výsledky →</span>
      </>
    );
  }
  return (
    <a
      href={href}
      aria-labelledby={`event-card-${event.id}`}
      aria-describedby={`event-status-${event.id}`}
      className="admin-event-card group"
    >
      <div
        id={`event-status-${event.id}`}
        className="flex flex-wrap items-center gap-2"
      >
        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold ${status.style}`}
        >
          {status.label}
        </span>
        {meta && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {meta}
          </span>
        )}
      </div>
      <div>
        <h2
          id={`event-card-${event.id}`}
          className="text-[19px] font-bold break-words group-hover:underline"
        >
          {event.name}
        </h2>
        <p className="mt-1 line-clamp-2 text-sm break-words whitespace-pre-wrap text-muted-foreground">
          {event.description || 'Bez popisu'}
        </p>
      </div>
      {details}
    </a>
  );
}
