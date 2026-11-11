import { useState } from 'react';
import {
  eventSchema,
  eventInputSchema,
  jurorTableSnapshotSchema,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { useResource } from './useResource';
import { ResourceState } from './ResourceState';
import { MutationForm } from './MutationForm';
import { adminRequest } from './api';
import { JurorTable } from './JurorTable';
import { eventFields } from './formFields';
import { VotingList } from './VotingList';
import { TeamsManager } from './TeamsManager';
import { EventHeading, type EventSection } from './EventNavigation';
import { Dashboard } from '../dashboard/Dashboard';
import { Results } from '../results/Results';

export function EventDetail({
  eventId,
  section,
  search,
  onExpired,
}: {
  eventId: string;
  section: EventSection;
  search?: string;
  onExpired: () => void;
}) {
  const resource = useResource(`/events/${eventId}`, eventSchema, onExpired);
  const setup = new URLSearchParams(search).get('setup');
  const view = setup === 'teams' || setup === 'categories' ? setup : 'jurors';
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  return (
    <>
      <ResourceState
        resource={resource}
        errorTitle="Event se nepodařilo načíst"
      />
      {!resource.data && Boolean(resource.error) && (
        <a className="wizard-link mt-3" href="/admin/events">
          ← Všechny eventy
        </a>
      )}
      {resource.data && (
        <EventHeading
          event={resource.data}
          section={section}
          preparation={view}
        />
      )}
      {resource.error ? null : section === 'progress' ? (
        <Dashboard eventId={eventId} onExpired={onExpired} />
      ) : section === 'results' ? (
        <Results eventId={eventId} onExpired={onExpired} />
      ) : (
        <>
          {view === 'categories' ? (
            <VotingList eventId={eventId} onExpired={onExpired} />
          ) : view === 'teams' ? (
            <TeamsManager eventId={eventId} onExpired={onExpired} />
          ) : (
            <JurorPreparation eventId={eventId} onExpired={onExpired} />
          )}
          {resource.data && (
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
          )}
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
    `/events/${eventId}/jurors/table`,
    jurorTableSnapshotSchema,
    onExpired,
  );
  return (
    <>
      <ResourceState
        resource={roster}
        errorTitle="Porotu se nepodařilo načíst"
      />
      {roster.data && (
        <JurorTable
          eventId={eventId}
          initial={roster.data}
          onExpired={onExpired}
        />
      )}
    </>
  );
}
