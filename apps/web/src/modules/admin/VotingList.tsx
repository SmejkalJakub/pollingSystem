import { useState } from 'react';
import {
  votingDraftInputSchema,
  votingListSchema,
  votingRecordSchema,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { adminRequest } from './api';
import { useResource } from './useResource';
import { MutationForm } from './MutationForm';
import { ResourceState } from './ResourceState';
import { votingFields, votingStatusLabels } from './votingFields';

export function VotingList({
  eventId,
  onExpired,
}: {
  eventId: string;
  onExpired: () => void;
}) {
  const resource = useResource(
    `/events/${eventId}/votings`,
    votingListSchema,
    onExpired,
  );
  const [creating, setCreating] = useState(false);
  return (
    <section className="mt-6" aria-labelledby="votings-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="votings-heading" className="mt-2 text-2xl font-semibold">
            Kategorie hlasování
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-11"
            variant="ghost"
            onClick={resource.reload}
          >
            Obnovit hlasování
          </Button>
          <Button
            className="min-h-11"
            disabled={creating}
            onClick={() => setCreating(true)}
          >
            Nové hlasování
          </Button>
        </div>
      </div>
      {creating && (
        <div className="mt-6">
          <MutationForm
            title="Nové hlasování"
            headingLevel={3}
            initial={{ name: '', instructions: '', kind: '' }}
            fields={votingFields}
            schema={votingDraftInputSchema}
            onExpired={onExpired}
            cancel={() => setCreating(false)}
            save={async (input) => {
              const created = await adminRequest(
                `/events/${eventId}/votings`,
                votingRecordSchema,
                { method: 'POST', body: input },
              );
              window.location.assign(`/admin/votings/${created.id}`);
            }}
          />
        </div>
      )}
      <ResourceState resource={resource} />
      {resource.data &&
        (resource.data.length === 0 ? (
          <div className="mt-6 border border-dashed border-border p-6">
            <h3 className="text-lg font-semibold">Zatím žádné hlasování</h3>
            <p className="mt-2 text-muted-foreground">
              Připravte koncept výběrového kola nebo finálové kategorie.
            </p>
          </div>
        ) : (
          <ul className="mt-6 divide-y border-y border-border">
            {resource.data.map((voting) => (
              <li key={voting.id}>
                <a
                  href={`/admin/votings/${voting.id}`}
                  className="flex min-h-24 flex-wrap items-center justify-between gap-3 py-5 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-lg font-semibold underline-offset-4 hover:underline">
                      {voting.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {voting.kind === 'selection'
                        ? 'Výběrové kolo'
                        : 'Finálová kategorie'}
                    </p>
                  </div>
                  <span className="text-sm">
                    {votingStatusLabels[voting.status]} →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
