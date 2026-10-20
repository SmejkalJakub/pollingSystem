import { useState } from 'react';
import { eventInputSchema, eventListSchema, eventSchema } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { adminRequest } from './api';
import { useResource } from './useResource';
import { MutationForm } from './MutationForm';
import { ResourceState } from './ResourceState';
import { eventFields } from './formFields';

export function EventList({ onExpired }: { onExpired: () => void }) {
  const resource = useResource('/events', eventListSchema, onExpired);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Administrace</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Vaše eventy
          </h1>
          <p className="mt-3 text-muted-foreground">
            Připravte event a sestavte jeho porotu.
          </p>
        </div>
        <Button
          className="min-h-11"
          onClick={() => setCreating(true)}
          disabled={creating}
        >
          Nový event
        </Button>
      </div>
      {creating && (
        <div className="mt-8">
          <MutationForm
            title="Nový event"
            initial={{ name: '', description: '' }}
            fields={eventFields}
            schema={eventInputSchema}
            onExpired={onExpired}
            cancel={() => setCreating(false)}
            save={async (input) => {
              const created = await adminRequest('/events', eventSchema, {
                method: 'POST',
                body: input,
              });
              window.location.assign(`/admin/events/${created.id}`);
            }}
          />
        </div>
      )}
      <ResourceState resource={resource} />
      {resource.data && (
        <section className="mt-8" aria-label="Seznam eventů">
          {resource.data.length === 0 ? (
            <div className="border border-dashed border-border p-8 sm:p-12">
              <h2 className="text-xl font-semibold">Začněte prvním eventem</h2>
              <p className="mt-3 max-w-lg text-muted-foreground">
                Založte akci, přidejte Technickou a Veřejnou porotu a přiřaďte
                porotce.
              </p>
            </div>
          ) : (
            <ul className="divide-y border-y border-border">
              {resource.data.map((event) => (
                <li key={event.id}>
                  <a
                    href={`/admin/events/${event.id}`}
                    className="group flex min-h-24 items-center justify-between gap-5 py-6 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <div className="min-w-0">
                      <h2 className="break-words text-xl font-semibold group-hover:underline">
                        {event.name}
                      </h2>
                      <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                        {event.description || 'Bez popisu'}
                      </p>
                    </div>
                    <span aria-hidden="true" className="text-2xl">
                      →
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
