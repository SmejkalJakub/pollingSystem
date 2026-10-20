import { juryGroupLabel } from '@d21/contracts';
import { useState } from 'react';
import {
  juryGroupCodes,
  juryGroupPatchSchema,
  juryGroupSchema,
  type Roster,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { MutationForm } from './MutationForm';
import { adminRequest } from './api';
export function JuryGroups({
  onPanelChange,
  eventId,
  roster,
  reload,
  onExpired,
  disabled,
}: {
  onPanelChange: (open: boolean) => void;
  eventId: string;
  roster: Roster;
  reload: () => void;
  onExpired: () => void;
  disabled: boolean;
}) {
  const [groupEditor, setGroupEditor] = useState<'T' | 'V' | null>(null);
  const groups = roster.groups;
  const selectedGroup = groups.find((group) => group.code === groupEditor);
  const base = `/events/${eventId}`;
  function saved() {
    setGroupEditor(null);
    onPanelChange(false);
    reload();
  }
  return (
    <>
      <section className="mt-6" aria-labelledby="groups-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="groups-title"
            className="text-xl font-semibold tracking-tight"
          >
            Části poroty
          </h2>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Technická a Veřejná porota mohou mít libovolné a rozdílné počty členů.
          Kategorie může hlasování povolit jedné nebo oběma částem.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {juryGroupCodes.map((code) => {
            const group = groups.find((value) => value.code === code);
            const count = roster.jurors.filter(
              (juror) => juror.juryGroupId === group?.id,
            ).length;
            return (
              <div
                key={code}
                className="min-w-0 border border-border bg-card px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="font-mono text-sm font-semibold">
                    POROTA {juryGroupLabel(code)}
                  </span>
                  <span className="font-mono text-sm text-muted-foreground">
                    {count} členů
                  </span>
                </div>
                <h3 className="mt-2 break-words text-base font-semibold">
                  {group?.name ?? 'Zatím nevytvořena'}
                </h3>
                <Button
                  className="mt-3 min-h-11"
                  variant="outline"
                  onClick={() => {
                    setGroupEditor(code);
                    onPanelChange(true);
                  }}
                  disabled={disabled || groupEditor !== null || !group}
                >
                  {`Upravit část ${juryGroupLabel(code)}`}
                </Button>
              </div>
            );
          })}
        </div>
        {groupEditor && selectedGroup && (
          <div className="mt-5">
            <MutationForm
              headingLevel={3}
              key={groupEditor}
              title={`Upravit část ${juryGroupLabel(groupEditor)}`}
              initial={{ name: selectedGroup.name }}
              fields={[
                { key: 'name', label: 'Název části poroty', maxLength: 200 },
              ]}
              schema={juryGroupPatchSchema}
              cancel={() => {
                setGroupEditor(null);
                onPanelChange(false);
              }}
              onExpired={onExpired}
              save={async (input) => {
                await adminRequest(
                  `${base}/jury-groups/${selectedGroup.id}`,
                  juryGroupSchema,
                  {
                    method: 'PATCH',
                    body: { name: input.name },
                  },
                );
                saved();
              }}
            />
          </div>
        )}
      </section>
    </>
  );
}
