import { useState } from 'react';
import { eventSchema, eventInputSchema, rosterSchema } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { useResource } from './useResource';
import { ResourceState } from './ResourceState';
import { MutationForm } from './MutationForm';
import { adminRequest } from './api';
import { JuryManager } from './JuryManager';
import { eventFields } from './formFields';
import { VotingList } from './VotingList';
import { TeamsManager } from './TeamsManager';

export function EventDetail({
  eventId,
  onExpired,
}: {
  eventId: string;
  onExpired: () => void;
}) {
  const resource = useResource(`/events/${eventId}`, eventSchema, onExpired);
  const roster = useResource(
    `/events/${eventId}/roster`,
    rosterSchema,
    onExpired,
  );
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  return (
    <>
      <a
        href="/admin/events"
        className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      >
        ← Všechny eventy
      </a>
      <ResourceState resource={resource} />
      {resource.data && (
        <>
          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="w-full min-w-0 sm:w-auto sm:flex-1">
              <p className="eyebrow">Detail eventu</p>
              <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl">
                {resource.data.name}
              </h1>
              <p className="mt-4 max-w-2xl whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">
                {resource.data.description || 'Tento event zatím nemá popis.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="min-h-11" variant="outline">
                <a href={`/admin/events/${eventId}/results`}>
                  Výsledky hlasování
                </a>
              </Button>
              <Button asChild className="min-h-11">
                <a href={`/admin/events/${eventId}/dashboard`}>
                  Průběh hlasování
                </a>
              </Button>
              <Button
                className="min-h-11"
                variant="outline"
                onClick={() => {
                  setEditing(true);
                  setNotice('');
                }}
                disabled={editing}
              >
                Upravit event
              </Button>
              <Button
                className="min-h-11"
                variant="ghost"
                onClick={() => {
                  resource.reload();
                  roster.reload();
                }}
              >
                Obnovit přehled
              </Button>
            </div>
          </div>
          {notice && (
            <p role="status" className="mt-5 text-sm">
              {notice}
            </p>
          )}
          {editing && (
            <div className="mt-6">
              <MutationForm
                title="Upravit event"
                initial={{
                  name: resource.data.name,
                  description: resource.data.description,
                }}
                fields={eventFields}
                schema={eventInputSchema}
                onExpired={onExpired}
                cancel={() => setEditing(false)}
                save={async (input) => {
                  await adminRequest(`/events/${eventId}`, eventSchema, {
                    method: 'PATCH',
                    body: input,
                  });
                  setEditing(false);
                  setNotice('Event byl uložen.');
                  resource.reload();
                }}
              />
            </div>
          )}
          <ResourceState resource={roster} />
          <VotingList eventId={eventId} onExpired={onExpired} />
          <TeamsManager eventId={eventId} onExpired={onExpired} />
          {roster.data && (
            <JuryManager
              eventId={eventId}
              roster={roster.data}
              reload={roster.reload}
              onExpired={onExpired}
            />
          )}
        </>
      )}
    </>
  );
}
