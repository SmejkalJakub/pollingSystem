import { useState } from 'react';
import { z } from 'zod';
import {
  teamListSchema,
  votingItemInputSchema,
  votingItemListSchema,
  votingItemRecordSchema,
  type VotingRecord,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { MutationForm } from './MutationForm';
import { useResource } from './useResource';
import { ResourceState } from './ResourceState';
import { adminRequest } from './api';

const formSchema = votingItemInputSchema.omit({ displayOrder: true }).extend({
  displayOrder: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(votingItemInputSchema.shape.displayOrder),
});
export function VotingItems({
  voting,
  onExpired,
}: {
  voting: VotingRecord;
  onExpired: () => void;
}) {
  const items = useResource(
    `/votings/${voting.id}/items`,
    votingItemListSchema,
    onExpired,
  );
  const teams = useResource(
    `/events/${voting.eventId}/teams`,
    teamListSchema,
    onExpired,
  );
  const [editor, setEditor] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const existing = items.data?.find((item) => item.id === editor);
  const options = (teams.data ?? [])
    .map((team, index) => ({
      value: team.id,
      label: `${index + 1} — ${team.name}`,
    }))
    .filter(
      (team) =>
        team.value === existing?.teamId ||
        !items.data?.some((item) => item.teamId === team.value),
    );
  return (
    <section
      className="mt-8 border-t border-border pt-6"
      aria-labelledby="items-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="items-heading" className="text-lg font-semibold">
          Týmy v hlasování
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-11"
            variant="ghost"
            onClick={() => {
              items.reload();
              teams.reload();
            }}
          >
            Obnovit položky
          </Button>
          {voting.status === 'draft' && (
            <Button
              className="min-h-11"
              variant="outline"
              disabled={
                editor !== null ||
                !items.data ||
                !teams.data ||
                options.length === 0
              }
              onClick={() => {
                setEditor('new');
                setNotice('');
              }}
            >
              Přidat tým
            </Button>
          )}
        </div>
      </div>
      <ResourceState resource={items} />
      <ResourceState resource={teams} />
      {items.data && (
        <p className="mt-3 text-sm text-muted-foreground">
          Přihlášené týmy: {items.data.length}.
          {voting.selectedPlaces !== null && (
            <>
              {' '}
              {voting.kind === 'selection' ? 'Postupuje' : 'Vítězů'}:{' '}
              {voting.selectedPlaces}.
              {voting.kind === 'selection' &&
                voting.selectedPlaces < items.data.length && (
                  <>
                    {' '}
                    Nepostupuje: {items.data.length - voting.selectedPlaces}.
                  </>
                )}
            </>
          )}
        </p>
      )}
      {teams.data?.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Nejprve přidejte soutěžní týmy v detailu eventu.
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm">
          {notice}
        </p>
      )}
      {editor &&
        voting.status === 'draft' &&
        (editor === 'new' || existing) && (
          <div className="mt-5">
            <MutationForm
              key={editor}
              title={existing ? 'Upravit položku' : 'Přidat tým do hlasování'}
              headingLevel={3}
              initial={{
                teamId: existing?.teamId ?? '',
                displayOrder: String(
                  existing?.displayOrder ?? items.data?.length ?? 0,
                ),
              }}
              fields={[
                {
                  key: 'teamId',
                  label: 'Tým',
                  placeholder: 'Vyberte tým',
                  options,
                },
                {
                  key: 'displayOrder',
                  label: 'Pořadí (od 0)',
                  inputType: 'number',
                  invalidMessage: 'Zadejte celé nezáporné číslo.',
                },
              ]}
              schema={formSchema}
              onExpired={onExpired}
              cancel={() => setEditor(null)}
              save={async (input) => {
                await adminRequest(
                  `/votings/${voting.id}/items${existing ? `/${existing.id}` : ''}`,
                  votingItemRecordSchema,
                  { method: existing ? 'PATCH' : 'POST', body: input },
                );
                setEditor(null);
                setNotice('Položka byla uložena.');
                items.reload();
              }}
            />
          </div>
        )}
      {items.data &&
        (items.data.length === 0 ? (
          <p className="mt-5 border border-dashed border-border p-5 text-sm text-muted-foreground">
            Zatím žádné týmy v tomto hlasování.
          </p>
        ) : (
          <ol className="mt-5 divide-y border-y border-border">
            {items.data.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-3 py-5"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-semibold">{item.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pořadí: {item.displayOrder}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                {voting.status === 'draft' && (
                  <Button
                    className="min-h-11"
                    variant="outline"
                    aria-label={`Upravit položku: ${item.name}`}
                    disabled={editor !== null}
                    onClick={() => {
                      setEditor(item.id);
                      setNotice('');
                    }}
                  >
                    Upravit
                  </Button>
                )}
              </li>
            ))}
          </ol>
        ))}
    </section>
  );
}
