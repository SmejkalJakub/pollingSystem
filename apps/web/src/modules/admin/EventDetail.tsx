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
import { EventHeading } from './EventNavigation';

export function EventDetail({
  eventId,
  onExpired,
}: {
  eventId: string;
  onExpired: () => void;
}) {
  const resource = useResource(`/events/${eventId}`, eventSchema, onExpired);
  const setup = new URLSearchParams(window.location.search).get('setup');
  const view = setup === 'teams' || setup === 'categories' ? setup : 'jurors';
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  return (
    <>
      <ResourceState resource={resource} />
      {resource.data && (
        <>
          <EventHeading event={resource.data} section="preparation" />
          <nav aria-label="Příprava" className="preparation-navigation">
            {[
              ['jurors', 'Porotci'],
              ['teams', 'Týmy'],
              ['categories', 'Kategorie'],
            ].map(([key, label]) => (
              <a
                key={key}
                href={`/admin/events/${eventId}?setup=${key}`}
                aria-current={view === key ? 'page' : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          {view === 'categories' ? (
            <VotingList eventId={eventId} onExpired={onExpired} />
          ) : view === 'teams' ? (
            <TeamsManager eventId={eventId} onExpired={onExpired} />
          ) : (
            <JurorPreparation eventId={eventId} onExpired={onExpired} />
          )}
          <details className="mt-4 border-b border-border pb-4">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">
              Nastavení eventu
            </summary>
            <p className="mt-2 max-w-2xl whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
              {resource.data.description || 'Tento event zatím nemá popis.'}
            </p>
            <Button
              className="mt-3 min-h-11"
              variant="outline"
              onClick={() => {
                setEditing(true);
                setNotice('');
              }}
              disabled={editing}
            >
              Upravit event
            </Button>
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
          </details>
        </>
      )}
    </>
  );
}

function JurorPreparation({
  eventId,
  onExpired,
}: {
  eventId: string;
  onExpired: () => void;
}) {
  const roster = useResource(
    `/events/${eventId}/roster`,
    rosterSchema,
    onExpired,
  );
  return (
    <>
      <ResourceState resource={roster} />
      {roster.data && (
        <JuryManager
          eventId={eventId}
          roster={roster.data}
          reload={roster.reload}
          onExpired={onExpired}
        />
      )}
    </>
  );
}
