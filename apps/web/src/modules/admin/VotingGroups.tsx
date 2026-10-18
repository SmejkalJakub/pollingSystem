import { useId, useState } from 'react';
import { z } from 'zod';
import {
  juryGroupListSchema,
  votingGroupsInputSchema,
  type VotingRecord,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { useResource } from './useResource';
import { ResourceState } from './ResourceState';
import { MutationForm } from './MutationForm';
import { adminRequest } from './api';

const formSchema = z
  .strictObject({ groups: z.string() })
  .transform(({ groups }) => ({
    juryGroupIds: groups ? groups.split(',') : [],
  }))
  .pipe(votingGroupsInputSchema);

export function VotingGroups({
  voting,
  onExpired,
}: {
  voting: VotingRecord;
  onExpired: () => void;
}) {
  const id = useId();
  const available = useResource(
    `/events/${voting.eventId}/jury-groups`,
    juryGroupListSchema,
    onExpired,
  );
  const selected = useResource(
    `/votings/${voting.id}/allowed-groups`,
    juryGroupListSchema,
    onExpired,
  );
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const groups = available.data ?? [];
  const options = groups.map((group) => ({
    value: group.id,
    label: `${group.code} — ${group.name}`,
  }));
  if (groups.length === 2)
    options.push({
      value: groups.map((group) => group.id).join(','),
      label: 'T + V — obě části poroty',
    });
  return (
    <section className="mt-8 border-t border-border pt-6" aria-labelledby={id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="text-lg font-semibold">
          Oprávněná porota
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-11"
            variant="ghost"
            onClick={() => {
              available.reload();
              selected.reload();
            }}
          >
            Obnovit oprávnění
          </Button>
          {voting.status === 'draft' && (
            <Button
              className="min-h-11"
              variant="outline"
              disabled={
                editing ||
                !available.data ||
                !selected.data ||
                groups.length === 0
              }
              onClick={() => {
                setEditing(true);
                setNotice('');
              }}
            >
              Upravit oprávnění
            </Button>
          )}
        </div>
      </div>
      <ResourceState resource={available} />
      <ResourceState resource={selected} />
      {selected.data && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {selected.data.length
            ? selected.data
                .map((group) => `${group.code} — ${group.name}`)
                .join('; ')
            : 'Oprávněná porota zatím není určena.'}
        </p>
      )}
      {available.data?.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Nejprve vytvořte části poroty v detailu eventu.
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm">
          {notice}
        </p>
      )}
      {editing && voting.status === 'draft' && selected.data && (
        <div className="mt-5">
          <MutationForm
            title="Upravit oprávnění"
            headingLevel={3}
            description="V konceptu může porota zůstat neurčená. Vyberte T, V nebo obě části tohoto eventu."
            initial={{
              groups: selected.data.map((group) => group.id).join(','),
            }}
            fields={[
              {
                key: 'groups',
                label: 'Kdo smí hlasovat',
                placeholder: 'Zatím neurčeno',
                options,
              },
            ]}
            schema={formSchema}
            onExpired={onExpired}
            cancel={() => setEditing(false)}
            save={async (input) => {
              await adminRequest(
                `/votings/${voting.id}/allowed-groups`,
                juryGroupListSchema,
                { method: 'PUT', body: input },
              );
              setEditing(false);
              setNotice('Oprávnění poroty bylo uloženo.');
              selected.reload();
            }}
          />
        </div>
      )}
    </section>
  );
}
