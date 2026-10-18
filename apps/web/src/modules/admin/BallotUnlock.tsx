import { useState } from 'react';
import {
  adminBallotSchema,
  adminBallotsSchema,
  votingActionSchema,
  type AdminBallot,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { useResource } from './useResource';
import { ResourceState } from './ResourceState';
import { MutationForm } from './MutationForm';
import { adminRequest } from './api';

export function BallotUnlock({
  votingId,
  onExpired,
}: {
  votingId: string;
  onExpired: () => void;
}) {
  const resource = useResource(
    `/votings/${votingId}/ballots`,
    adminBallotsSchema,
    onExpired,
  );
  const [selected, setSelected] = useState<AdminBallot>();
  const [notice, setNotice] = useState('');
  return (
    <section
      className="mt-8 border-t border-border pt-6"
      aria-label="Odemčení hlasovacích lístků"
    >
      <h2 className="text-lg font-semibold">Odemčení hlasovacích lístků</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Pouze administrátor může vrátit odevzdaný lístek porotci k úpravám.
        Původní odevzdání a zásah zůstanou v historii. Lístek bude znovu
        odevzdaný až po potvrzení porotcem; uzavřenou kategorii je potřeba
        nejprve otevřít.
      </p>
      <Button
        variant="outline"
        className="mt-4 min-h-11"
        disabled={resource.loading}
        onClick={() => {
          setSelected(undefined);
          resource.reload();
        }}
      >
        Obnovit lístky
      </Button>
      <ResourceState resource={resource} />
      {notice && (
        <p role="status" className="mt-4 text-sm">
          {notice}
        </p>
      )}
      {resource.data && !resource.data.length && (
        <p className="mt-4 text-sm text-muted-foreground">
          Zatím žádné uložené lístky.
        </p>
      )}
      <ul className="mt-4 divide-y divide-border">
        {resource.data?.map((ballot) => (
          <li
            key={ballot.id}
            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="break-words font-medium">{ballot.displayName}</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {ballot.jurorId}
              </p>
              <p className="mt-1 text-sm">
                {ballot.status === 'submitted'
                  ? `Odevzdáno ${new Date(ballot.submittedAt!).toLocaleString('cs-CZ')}`
                  : ballot.status === 'draft'
                    ? 'Návrh · neodevzdáno'
                    : 'Uzamčeno'}
              </p>
            </div>
            {ballot.status === 'submitted' && (
              <Button
                variant="outline"
                className="min-h-11 shrink-0"
                disabled={selected?.id === ballot.id}
                aria-label={`Odemknout lístek: ${ballot.displayName}, ${ballot.jurorId}`}
                onClick={() => {
                  setSelected(ballot);
                  setNotice('');
                }}
              >
                Odemknout porotci
              </Button>
            )}
          </li>
        ))}
      </ul>
      {selected && (
        <MutationForm
          key={`${selected.id}:${selected.revision}`}
          headingLevel={3}
          title={`Odemknout lístek: ${selected.displayName}`}
          description="Výběr zůstane zachovaný jako návrh. Dosavadní odevzdání přestane být aktuální; porotce jej může upravit a znovu odevzdat. Historie zůstane zachovaná."
          initial={{}}
          fields={[]}
          schema={votingActionSchema}
          submitLabel="Potvrdit odemčení"
          cancel={() => setSelected(undefined)}
          onExpired={onExpired}
          save={async () => {
            await adminRequest(
              `/votings/${votingId}/ballots/${selected.id}/unlock`,
              adminBallotSchema,
              { method: 'POST', body: { expectedRevision: selected.revision } },
            );
            setSelected(undefined);
            setNotice(
              'Lístek byl odemčen porotci. Historie odevzdání je zachovaná.',
            );
            resource.reload();
          }}
        />
      )}
    </section>
  );
}
