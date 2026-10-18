import { useState } from 'react';
import {
  teamInputSchema,
  teamListSchema,
  teamRecordSchema,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { MutationForm } from './MutationForm';
import { useResource } from './useResource';
import { ResourceState } from './ResourceState';
import { adminRequest } from './api';

const fields = [
  { key: 'name', label: 'Název týmu', maxLength: 200 },
  {
    key: 'description',
    label: 'Popis (nepovinný)',
    multiline: true,
    maxLength: 5000,
  },
];
export function TeamsManager({
  eventId,
  onExpired,
}: {
  eventId: string;
  onExpired: () => void;
}) {
  const resource = useResource(
    `/events/${eventId}/teams`,
    teamListSchema,
    onExpired,
  );
  const [editor, setEditor] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const existing = resource.data?.find((team) => team.id === editor);
  return (
    <section
      className="mt-12 border-t border-border pt-8"
      aria-labelledby="teams-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Společné pro event</p>
          <h2 id="teams-heading" className="mt-2 text-2xl font-semibold">
            Soutěžní týmy
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-11"
            variant="ghost"
            onClick={resource.reload}
          >
            Obnovit týmy
          </Button>
          <Button
            className="min-h-11"
            disabled={editor !== null}
            onClick={() => {
              setEditor('new');
              setNotice('');
            }}
          >
            Nový tým
          </Button>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Týmy přidávejte do jednotlivých hlasování. Oprava názvu nebo popisu se
        projeví ve všech jejich kategoriích.
      </p>
      {notice && (
        <p role="status" className="mt-4 text-sm">
          {notice}
        </p>
      )}
      {editor && (editor === 'new' || existing) && (
        <div className="mt-6">
          <MutationForm
            key={editor}
            title={existing ? 'Upravit tým' : 'Nový tým'}
            headingLevel={3}
            initial={{
              name: existing?.name ?? '',
              description: existing?.description ?? '',
            }}
            fields={fields}
            schema={teamInputSchema}
            onExpired={onExpired}
            cancel={() => setEditor(null)}
            save={async (input) => {
              await adminRequest(
                `/events/${eventId}/teams${existing ? `/${existing.id}` : ''}`,
                teamRecordSchema,
                { method: existing ? 'PATCH' : 'POST', body: input },
              );
              setEditor(null);
              setNotice('Tým byl uložen.');
              resource.reload();
            }}
          />
        </div>
      )}
      <ResourceState resource={resource} />
      {resource.data &&
        (resource.data.length === 0 ? (
          <p className="mt-6 border border-dashed border-border p-6 text-muted-foreground">
            Zatím žádné týmy. Přidejte první tým tohoto eventu.
          </p>
        ) : (
          <ol className="mt-6 divide-y border-y border-border">
            {resource.data.map((team, index) => (
              <li
                key={team.id}
                className="flex flex-wrap items-start justify-between gap-3 py-5"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-semibold">
                    {index + 1}. {team.name}
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {team.description || 'Bez popisu'}
                  </p>
                </div>
                <Button
                  className="min-h-11"
                  variant="outline"
                  aria-label={`Upravit tým ${index + 1}: ${team.name}`}
                  disabled={editor !== null}
                  onClick={() => {
                    setEditor(team.id);
                    setNotice('');
                  }}
                >
                  Upravit
                </Button>
              </li>
            ))}
          </ol>
        ))}
    </section>
  );
}
