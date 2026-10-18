import { useRef, useState } from 'react';
import { z } from 'zod';
import {
  juryGroupCodes,
  juryGroupPatchSchema,
  juryGroupSchema,
  jurorInputSchema,
  jurorSchema,
  type Roster,
  type JurorRecord,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminRequest } from './api';
import { MutationForm } from './MutationForm';
import { JurorAccess } from './JurorAccess';

export function JuryManager({
  eventId,
  roster,
  reload,
  onExpired,
}: {
  eventId: string;
  roster: Roster;
  reload: () => void;
  onExpired: () => void;
}) {
  const [groupEditor, setGroupEditor] = useState<'T' | 'V' | null>(null);
  const [jurorEditor, setJurorEditor] = useState<JurorRecord | 'new' | null>(
    null,
  );
  const [removing, setRemoving] = useState<JurorRecord | null>(null);
  const [accessJuror, setAccessJuror] = useState<JurorRecord | null>(null);
  const accessOpener = useRef<HTMLButtonElement | null>(null);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  function saved(message: string) {
    setGroupEditor(null);
    setJurorEditor(null);
    setRemoving(null);
    setNotice(message);
    reload();
  }
  const groups = roster.groups;
  const filtered = roster.jurors.filter((juror) =>
    juror.displayName
      .toLocaleLowerCase('cs')
      .includes(query.toLocaleLowerCase('cs')),
  );
  const selectedGroup = groups.find((group) => group.code === groupEditor);
  const jurorFields = [
    { key: 'displayName', label: 'Jméno porotce', maxLength: 200 },
    {
      key: 'juryGroupId',
      label: 'Část poroty',
      disabled: roster.locked,
      options: groups.map((group) => ({
        value: group.id,
        label: `${group.code} — ${group.name}`,
      })),
    },
  ];
  const base = `/events/${eventId}`;
  return (
    <>
      <section className="mt-12" aria-labelledby="groups-title">
        <h2 id="groups-title" className="text-2xl font-semibold tracking-tight">
          Části poroty
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Při přípravě může být porota neúplná. Před aktivací hlasování musí mít
          T i V stejný počet členů: 5, 7 nebo 9.
        </p>
        {roster.locked && (
          <p
            role="status"
            className="mt-5 border-l-2 border-primary bg-secondary p-4 text-sm leading-relaxed"
          >
            Složení poroty je uzamčeno. Hlasování již začalo nebo existují
            hlasovací lístky. Jména lze stále opravit; členství a přiřazení k
            T/V již měnit nelze.
          </p>
        )}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {juryGroupCodes.map((code) => {
            const group = groups.find((value) => value.code === code);
            const count = roster.jurors.filter(
              (juror) => juror.juryGroupId === group?.id,
            ).length;
            return (
              <div
                key={code}
                className="min-w-0 border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="font-mono text-sm font-semibold">
                    POROTA {code}
                  </span>
                  <span className="font-mono text-sm text-muted-foreground">
                    {count} členů
                  </span>
                </div>
                <h3 className="mt-4 break-words text-lg font-semibold">
                  {group?.name ?? 'Zatím nevytvořena'}
                </h3>
                <Button
                  className="mt-5 min-h-11"
                  variant="outline"
                  onClick={() => {
                    setGroupEditor(code);
                    setNotice('');
                  }}
                  disabled={groupEditor !== null || (!group && roster.locked)}
                >
                  {group ? `Upravit část ${code}` : `Vytvořit část ${code}`}
                </Button>
              </div>
            );
          })}
        </div>
        {groupEditor && (
          <div className="mt-5">
            <MutationForm
              headingLevel={3}
              key={groupEditor}
              title={`${selectedGroup ? 'Upravit' : 'Vytvořit'} část ${groupEditor}`}
              initial={{
                name:
                  selectedGroup?.name ??
                  (groupEditor === 'T'
                    ? 'Technická porota'
                    : 'Druhá část poroty'),
              }}
              fields={[
                { key: 'name', label: 'Název části poroty', maxLength: 200 },
              ]}
              schema={juryGroupPatchSchema}
              cancel={() => setGroupEditor(null)}
              onExpired={onExpired}
              save={async (input) => {
                await adminRequest(
                  `${base}/jury-groups${selectedGroup ? `/${selectedGroup.id}` : ''}`,
                  juryGroupSchema,
                  {
                    method: selectedGroup ? 'PATCH' : 'POST',
                    body: selectedGroup
                      ? { name: input.name }
                      : { ...input, code: groupEditor },
                  },
                );
                saved('Část poroty byla uložena.');
              }}
            />
          </div>
        )}
      </section>
      <section className="mt-12" aria-labelledby="jurors-title">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2
              id="jurors-title"
              className="text-2xl font-semibold tracking-tight"
            >
              Porotci{' '}
              <span className="ml-2 font-mono text-base font-normal text-muted-foreground">
                {roster.jurors.length}
              </span>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Každý porotce patří právě do jedné části této poroty.
            </p>
          </div>
          <Button
            className="min-h-11"
            disabled={roster.locked || !groups.length || jurorEditor !== null}
            onClick={() => {
              setJurorEditor('new');
              setNotice('');
            }}
          >
            Přidat porotce
          </Button>
        </div>
        {!groups.length && (
          <p className="mt-4 text-sm text-muted-foreground">
            Nejprve vytvořte část poroty T nebo V.
          </p>
        )}
        {notice && (
          <p role="status" className="mt-5 text-sm">
            {notice}
          </p>
        )}
        {jurorEditor && (
          <div className="mt-6">
            <MutationForm
              headingLevel={3}
              key={jurorEditor === 'new' ? 'new' : jurorEditor.id}
              title={
                jurorEditor === 'new' ? 'Přidat porotce' : 'Upravit porotce'
              }
              initial={
                jurorEditor === 'new'
                  ? { displayName: '', juryGroupId: '' }
                  : {
                      displayName: jurorEditor.displayName,
                      juryGroupId: jurorEditor.juryGroupId,
                    }
              }
              fields={jurorFields}
              schema={jurorInputSchema}
              cancel={() => setJurorEditor(null)}
              onExpired={onExpired}
              save={async (input) => {
                await adminRequest(
                  `${base}/jurors${jurorEditor === 'new' ? '' : `/${jurorEditor.id}`}`,
                  jurorSchema,
                  {
                    method: jurorEditor === 'new' ? 'POST' : 'PATCH',
                    body: input,
                  },
                );
                saved('Porotce byl uložen.');
              }}
            />
          </div>
        )}
        {accessJuror && (
          <JurorAccess
            key={accessJuror.id}
            juror={accessJuror}
            onExpired={onExpired}
            close={() => {
              setAccessJuror(null);
              requestAnimationFrame(() => accessOpener.current?.focus());
            }}
          />
        )}
        {removing && (
          <RemoveMembership
            juror={removing}
            base={base}
            onExpired={onExpired}
            cancel={() => setRemoving(null)}
            done={() => saved('Členství porotce bylo odebráno.')}
          />
        )}
        {roster.jurors.length > 0 && (
          <div className="mt-6 max-w-sm">
            <label
              htmlFor="juror-search"
              className="mb-2 block text-sm font-medium"
            >
              Hledat porotce
            </label>
            <Input
              id="juror-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        )}
        <ul className="mt-5 divide-y border-y border-border">
          {filtered.map((juror) => (
            <li
              key={juror.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div className="min-w-0 flex-1 basis-44">
                <p className="break-words font-medium">{juror.displayName}</p>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {groups.find((group) => group.id === juror.juryGroupId)?.code}{' '}
                  ·{' '}
                  {groups.find((group) => group.id === juror.juryGroupId)?.name}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  ID {juror.id.slice(0, 8)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="min-h-11"
                  variant="outline"
                  disabled={accessJuror !== null}
                  aria-label={`Osobní přístup ${juror.displayName}, ID ${juror.id.slice(0, 8)}`}
                  onClick={(event) => {
                    accessOpener.current = event.currentTarget;
                    setAccessJuror(juror);
                  }}
                >
                  Osobní přístup
                </Button>
                <Button
                  className="min-h-11"
                  variant="outline"
                  aria-label={`Upravit porotce ${juror.displayName}, ID ${juror.id.slice(0, 8)}`}
                  disabled={jurorEditor !== null}
                  onClick={() => {
                    setJurorEditor(juror);
                    setNotice('');
                  }}
                >
                  Upravit
                </Button>
                <Button
                  className="min-h-11"
                  variant="ghost"
                  disabled={roster.locked || removing !== null}
                  aria-label={`Odebrat členství ${juror.displayName}, ID ${juror.id.slice(0, 8)}`}
                  onClick={() => {
                    setRemoving(juror);
                    setNotice('');
                  }}
                >
                  Odebrat
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {filtered.length === 0 && (
          <p className="py-8 text-muted-foreground">
            {roster.jurors.length
              ? 'Žádný porotce neodpovídá hledání.'
              : 'Zatím zde nejsou žádní porotci.'}
          </p>
        )}
      </section>
    </>
  );
}

function RemoveMembership({
  juror,
  base,
  cancel,
  done,
  onExpired,
}: {
  juror: JurorRecord;
  base: string;
  cancel: () => void;
  done: () => void;
  onExpired: () => void;
}) {
  return (
    <div className="mt-6">
      <MutationForm
        headingLevel={3}
        title={`Odebrat členství: ${juror.displayName}?`}
        initial={{}}
        fields={[]}
        schema={z.strictObject({})}
        cancel={cancel}
        onExpired={onExpired}
        description="Porotce bude trvale odebrán z tohoto eventu. Tuto akci nelze vrátit zpět. Pokud má členství navázané záznamy, server odebrání odmítne."
        submitLabel="Odebrat členství"
        destructive
        save={async () => {
          await adminRequest(`${base}/jurors/${juror.id}`, z.undefined(), {
            method: 'DELETE',
          });
          done();
        }}
      />
    </div>
  );
}
