import { useState } from 'react';
import {
  eventSchema,
  type EventRecord,
  type AdminEventCard,
  eventInputSchema,
  jurorTableSnapshotSchema,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { useResource } from './useResource';
import { ResourceState } from './ResourceState';
import { MutationForm } from './MutationForm';
import { adminRequest } from './api';
import { JurorTable } from './JurorTable';
import { JuryGroups } from './JuryGroups';
import { eventFields } from './formFields';
import { VotingList } from './VotingList';
import { TeamsManager } from './TeamsManager';
import { EventHeading } from './EventNavigation';
import { preparationView, type EventSection } from './event-context';
import { Dashboard } from '../dashboard/Dashboard';
import { Results } from '../results/Results';

export function EventDetail({
  eventId,
  section,
  search,
  card,
  reloadCard,
  onExpired,
}: {
  eventId: string;
  section: EventSection;
  search?: string;
  card?: AdminEventCard;
  reloadCard: () => void;
  onExpired: () => void;
}) {
  const resource = useResource(`/events/${eventId}`, eventSchema, onExpired);
  const view = preparationView(search);
  const [record, setRecord] = useState<typeof resource.data>();
  const event = record ?? resource.data;
  let content;
  if (!resource.error) {
    if (section === 'progress') {
      content = (
        <Dashboard eventId={eventId} onExpired={onExpired} search={search} />
      );
    } else if (section === 'results') {
      content = <Results eventId={eventId} onExpired={onExpired} />;
    } else if (view === 'categories') {
      content = (
        <VotingList
          eventId={eventId}
          onExpired={onExpired}
          card={card}
          reloadCard={reloadCard}
        />
      );
    } else if (view === 'teams') {
      content = <TeamsManager eventId={eventId} onExpired={onExpired} />;
    } else if (view === 'jurors') {
      content = <JurorPreparation eventId={eventId} onExpired={onExpired} />;
    } else if (event) {
      content = (
        <>
          <EventSettings
            event={event}
            onSaved={setRecord}
            onExpired={onExpired}
          />
          <GroupSettings eventId={eventId} onExpired={onExpired} />
        </>
      );
    }
  }
  return (
    <>
      <ResourceState
        resource={resource}
        errorTitle="Event se nepodařilo načíst"
      />
      {!event && Boolean(resource.error) && (
        <a className="wizard-link mt-3" href="/admin/events">
          ← Všechny eventy
        </a>
      )}
      {event && (
        <EventHeading
          event={event}
          section={section}
          preparation={view}
          showTitle={false}
        />
      )}
      {content}
    </>
  );
}

function EventSettings({
  event,
  onSaved,
  onExpired,
}: {
  event: EventRecord;
  onSaved: (event: EventRecord) => void;
  onExpired: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  return (
    <section
      className="max-w-2xl rounded-2xl border border-border bg-card p-5 sm:p-6"
      aria-labelledby="event-settings-heading"
    >
      <h1 id="event-settings-heading" className="section-title">
        Nastavení eventu
      </h1>
      <p className="mt-2 break-words font-semibold">{event.name}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
        {event.description || 'Tento event zatím nemá popis.'}
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
            headingLevel={3}
            initial={{ name: event.name, description: event.description }}
            fields={eventFields}
            schema={eventInputSchema}
            onExpired={onExpired}
            cancel={() => setEditing(false)}
            save={async (input) => {
              const saved = await adminRequest(
                `/events/${event.id}`,
                eventSchema,
                {
                  method: 'PATCH',
                  body: input,
                },
              );
              onSaved(saved);
              setEditing(false);
              setNotice('Event byl uložen.');
            }}
          />
        </div>
      )}
    </section>
  );
}

function GroupSettings({
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
    <div className="max-w-2xl">
      <ResourceState
        resource={roster}
        errorTitle="Porotu se nepodařilo načíst"
      />
      {roster.data && (
        <JuryGroups
          eventId={eventId}
          roster={roster.data}
          onPanelChange={() => undefined}
          disabled={false}
          reload={roster.reload}
          onExpired={onExpired}
        />
      )}
    </div>
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
