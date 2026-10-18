import { EventHeading } from './EventNavigation';
import { BallotUnlock } from './BallotUnlock';
import { useState } from 'react';
import {
  eventSchema,
  votingRecordSchema,
  votingDraftInputSchema,
  votingActionSchema,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { useResource } from './useResource';
import { ResourceState } from './ResourceState';
import { MutationForm } from './MutationForm';
import { adminRequest } from './api';
import { votingFields, votingStatusLabels } from './votingFields';
import { VotingGroups } from './VotingGroups';
import { VotingItems } from './VotingItems';
import { VotingConfiguration } from './VotingConfiguration';

export function VotingDetail({
  votingId,
  onExpired,
}: {
  votingId: string;
  onExpired: () => void;
}) {
  const resource = useResource(
    `/votings/${votingId}`,
    votingRecordSchema,
    onExpired,
  );
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [activating, setActivating] = useState(false);
  const [notice, setNotice] = useState('');
  return (
    <>
      <ResourceState resource={resource} />
      {resource.data && (
        <>
          <VotingEventHeading
            eventId={resource.data.eventId}
            onExpired={onExpired}
          />
          <a
            href={`/admin/events/${resource.data.eventId}?setup=categories`}
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            ← Všechny kategorie
          </a>
          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">
                {resource.data.kind === 'selection'
                  ? 'Výběrové kolo'
                  : 'Finálová kategorie'}{' '}
                · {votingStatusLabels[resource.data.status]}
              </p>
              <h2 className="mt-2 break-words text-2xl font-semibold tracking-tight">
                {resource.data.name}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="min-h-11" variant="outline">
                <a href={`/admin/results/votings/${votingId}`}>
                  Výsledky kategorie
                </a>
              </Button>
              {resource.data.status === 'draft' && (
                <Button
                  className="min-h-11"
                  disabled={activating}
                  onClick={() => {
                    setActivating(true);
                    setNotice('');
                  }}
                >
                  Aktivovat hlasování
                </Button>
              )}
              {(resource.data.status === 'closed' ||
                resource.data.status === 'archived') && (
                <Button
                  className="min-h-11"
                  variant="outline"
                  disabled={reopening}
                  onClick={() => {
                    setReopening(true);
                    setNotice('');
                  }}
                >
                  Znovu otevřít hlasování
                </Button>
              )}
              {resource.data.status === 'active' && (
                <Button
                  className="min-h-11"
                  variant="outline"
                  disabled={closing}
                  onClick={() => {
                    setClosing(true);
                    setNotice('');
                  }}
                >
                  Uzavřít hlasování
                </Button>
              )}
              {resource.data.status === 'draft' && (
                <Button
                  className="min-h-11"
                  variant="outline"
                  disabled={editing}
                  onClick={() => {
                    setEditing(true);
                    setNotice('');
                  }}
                >
                  Upravit koncept
                </Button>
              )}
              <Button
                className="min-h-11"
                variant="ghost"
                onClick={resource.reload}
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
          {activating && resource.data.status === 'draft' && (
            <div className="mt-6">
              <MutationForm
                title="Aktivovat hlasování"
                description="Server ověří pravidla, týmy, oprávnění a stejně velké poroty T/V po 5, 7 nebo 9 členech. Úspěšná aktivace uzamkne konfiguraci i složení poroty eventu."
                initial={{}}
                fields={[]}
                schema={votingActionSchema}
                submitLabel="Aktivovat"
                onExpired={onExpired}
                cancel={() => setActivating(false)}
                save={async () => {
                  await adminRequest(
                    `/votings/${votingId}/activate`,
                    votingRecordSchema,
                    { method: 'POST', body: {} },
                  );
                  setActivating(false);
                  setEditing(false);
                  setNotice('Hlasování bylo aktivováno.');
                  resource.reload();
                }}
              />
            </div>
          )}
          {closing && resource.data.status === 'active' && (
            <div className="mt-6">
              <MutationForm
                title="Uzavřít hlasování"
                description="Hlasování bude uzavřeno. Dosavadní hlasovací lístky a konfigurace zůstanou zachované."
                initial={{}}
                fields={[]}
                schema={votingActionSchema}
                submitLabel="Uzavřít"
                onExpired={onExpired}
                cancel={() => setClosing(false)}
                save={async () => {
                  await adminRequest(
                    `/votings/${votingId}/close`,
                    votingRecordSchema,
                    { method: 'POST', body: {} },
                  );
                  setClosing(false);
                  setNotice('Hlasování bylo uzavřeno.');
                  resource.reload();
                }}
              />
            </div>
          )}
          {reopening &&
            (resource.data.status === 'closed' ||
              resource.data.status === 'archived') && (
              <div className="mt-6">
                <MutationForm
                  title="Znovu otevřít hlasování"
                  description="Hlasování bude znovu aktivní bez kontroly připravenosti. Dosavadní hlasovací lístky, konfigurace a uzamčení složení poroty zůstanou zachované."
                  initial={{}}
                  fields={[]}
                  schema={votingActionSchema}
                  submitLabel="Znovu otevřít"
                  onExpired={onExpired}
                  cancel={() => setReopening(false)}
                  save={async () => {
                    await adminRequest(
                      `/votings/${votingId}/reopen`,
                      votingRecordSchema,
                      { method: 'POST', body: {} },
                    );
                    setReopening(false);
                    setNotice('Hlasování bylo znovu otevřeno.');
                    resource.reload();
                  }}
                />
              </div>
            )}
          {editing && resource.data.status === 'draft' && (
            <div className="mt-6">
              <MutationForm
                title="Upravit koncept"
                initial={{
                  name: resource.data.name,
                  instructions: resource.data.instructions,
                  kind: resource.data.kind,
                }}
                fields={votingFields}
                schema={votingDraftInputSchema}
                onExpired={onExpired}
                cancel={() => setEditing(false)}
                save={async (input) => {
                  await adminRequest(
                    `/votings/${votingId}`,
                    votingRecordSchema,
                    { method: 'PATCH', body: input },
                  );
                  setEditing(false);
                  setNotice('Koncept byl uložen.');
                  resource.reload();
                }}
              />
            </div>
          )}
          <section
            className="mt-8 border-t border-border pt-6"
            aria-labelledby="instructions-heading"
          >
            <h2 id="instructions-heading" className="text-lg font-semibold">
              Instrukce pro porotu
            </h2>
            <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">
              {resource.data.instructions || 'Instrukce zatím nejsou vyplněné.'}
            </p>
          </section>
          <VotingGroups voting={resource.data} onExpired={onExpired} />
          <VotingConfiguration
            voting={resource.data}
            onSaved={resource.reload}
            onExpired={onExpired}
          />
          <BallotUnlock votingId={votingId} onExpired={onExpired} />
          <VotingItems voting={resource.data} onExpired={onExpired} />
          {resource.data.status === 'draft' && (
            <p className="mt-8 border border-dashed border-border p-5 text-sm leading-relaxed text-muted-foreground">
              Toto hlasování je koncept. Před aktivací je potřeba dokončit
              pravidla, týmy a oprávnění poroty.
            </p>
          )}
        </>
      )}
    </>
  );
}

function VotingEventHeading({
  eventId,
  onExpired,
}: {
  eventId: string;
  onExpired: () => void;
}) {
  const resource = useResource(`/events/${eventId}`, eventSchema, onExpired);
  return (
    <>
      <ResourceState resource={resource} />
      {resource.data && (
        <EventHeading event={resource.data} section="preparation" />
      )}
    </>
  );
}
