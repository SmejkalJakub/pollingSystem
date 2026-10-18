import { useEffect, useRef, useState } from 'react';
import {
  teamTableSnapshotSchema,
  teamTableSaveSchema,
  type TeamTableSnapshot,
  type TeamTableRow,
  type TeamTableIssue,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { adminRequest, managementError } from './api';
import { teamRowIssues, teamFieldError, rowChanged } from './team-table-utils';
import { TeamPaste } from './TeamPaste';
import { TeamRows } from './TeamRows';

export function TeamTable({
  initial,
  eventId,
  onExpired,
}: {
  initial: TeamTableSnapshot;
  eventId: string;
  onExpired: () => void;
}) {
  const [base, setBase] = useState(initial);
  const [rows, setRows] = useState<TeamTableRow[]>(initial.teams);
  const [issues, setIssues] = useState<TeamTableIssue[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [latest, setLatest] = useState<TeamTableSnapshot>();
  const [conflict, setConflict] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{ id: string }>();
  const feedback = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const baseById = new Map(base.teams.map((team) => [team.id, team]));
  const changed = rows.filter((row) =>
    rowChanged(row, baseById.get(row.id)),
  ).length;
  const dirty = changed > 0;
  const path = `/events/${eventId}/teams/table`;
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (error || issues.length) feedback.current?.focus();
  }, [error, issues]);
  useEffect(() => {
    if (focusTarget) document.getElementById(focusTarget.id)?.focus();
  }, [focusTarget]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function reset(snapshot: TeamTableSnapshot) {
    setBase(snapshot);
    setRows(snapshot.teams);
    setLatest(undefined);
    setConflict(false);
    setIssues([]);
    setDiscard(false);
  }
  function fail(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) {
      onExpired();
      return;
    }
    if (cause instanceof ApiError && cause.code === 'TEAM_TABLE_CONFLICT') {
      setConflict(true);
      setError(
        'Tabulka se změnila. Vaše hodnoty zůstaly zachovány. Načtěte aktuální týmy pro porovnání a před dalším uložením je zkontrolujte.',
      );
    } else
      setError(
        cause instanceof ApiError && cause.status === 413
          ? 'Tabulka je pro jeden požadavek příliš velká (64 KiB). Zkraťte popisy nebo odeberte některé nové řádky. Hodnoty zůstaly zachovány.'
          : managementError(cause),
      );
  }
  async function loadLatest() {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const request = new AbortController();
    controller.current = request;
    try {
      const snapshot = await adminRequest(path, teamTableSnapshotSchema, {
        signal: request.signal,
      });
      if (dirty || conflict) {
        setLatest(snapshot);
        setConflict(true);
        setFocusTarget({ id: 'teams-comparison' });
        setNotice(
          'Aktuální tabulka je načtena k porovnání. Vaše úpravy jsou stále v polích.',
        );
      } else {
        reset(snapshot);
        setNotice('Týmy byly obnoveny.');
        setFocusTarget({ id: 'teams-status' });
      }
    } catch (cause) {
      if (!request.signal.aborted) fail(cause);
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || conflict) return;
    setError('');
    setNotice('');
    const errors = teamRowIssues(rows);
    setIssues(errors);
    if (errors.length) return;
    setBusy(true);
    const request = new AbortController();
    controller.current = request;
    try {
      const result = await adminRequest(path, teamTableSaveSchema, {
        method: 'PUT',
        body: {
          baseVersion: base.version,
          rows: rows.map(({ id, name, description }) => ({
            id,
            name,
            description,
          })),
        },
        signal: request.signal,
      });
      if (result.status === 'invalid') setIssues(result.issues);
      else {
        reset(result.snapshot);
        setNotice('Tabulka týmů byla uložena.');
        setFocusTarget({ id: 'teams-status' });
      }
    } catch (cause) {
      if (!request.signal.aborted) fail(cause);
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  function update(id: string, field: 'name' | 'description', value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
    setNotice('');
    setDiscard(false);
    // Retain submitted errors until another validation, including while correcting fields.
  }
  function append(added: TeamTableRow[]) {
    setRows((current) => [...current, ...added]);
    setNotice('Nové řádky jsou připraveny. Uložte tabulku.');
    if (added[0]) setFocusTarget({ id: `team-${added[0].id}-name` });
  }
  function rebase() {
    if (!latest) return;
    const local = new Map(rows.map((row) => [row.id, row]));
    const merged: TeamTableRow[] = latest.teams.map((team) => {
      const row = local.get(team.id);
      return row && rowChanged(row, baseById.get(row.id)) ? row : team;
    });
    const ids = new Set(merged.map((row) => row.id));
    for (const row of rows) if (!ids.has(row.id)) merged.push(row);
    setRows(merged);
    setBase(latest);
    setLatest(undefined);
    setConflict(false);
    setError('');
    setFocusTarget({ id: 'teams-status' });
    setNotice(
      'Vaše změny jsou připraveny nad aktuální tabulkou. Zkontrolujte je a uložte.',
    );
  }
  return (
    <>
      <form
        aria-label="Tabulka týmů"
        className="mt-5"
        onSubmit={save}
        noValidate
        aria-busy={busy}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {rows.length} týmů · {changed} změněných řádků
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void loadLatest()}
            >
              Obnovit týmy
            </Button>
            <Button
              className="min-h-11"
              type="button"
              variant="outline"
              id="teams-add"
              disabled={busy || conflict}
              onClick={() =>
                append([{ id: crypto.randomUUID(), name: '', description: '' }])
              }
            >
              Nový tým
            </Button>
          </div>
        </div>
        {(error || issues.length > 0) && (
          <div
            ref={feedback}
            role="alert"
            tabIndex={-1}
            className="mt-4 space-y-2 border border-destructive p-4 text-sm text-destructive outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <p>{error || 'Zkontrolujte označená pole. Nic nebylo uloženo.'}</p>
            {issues.map((issue) => (
              <a
                className="block underline"
                href={`#team-${issue.rowId}-${issue.field}`}
                key={`${issue.rowId}-${issue.field}`}
              >
                Řádek {rows.findIndex((row) => row.id === issue.rowId) + 1}:{' '}
                {teamFieldError(issue.field)}
              </a>
            ))}
          </div>
        )}
        {notice && (
          <p
            id="teams-status"
            tabIndex={-1}
            role="status"
            aria-atomic="true"
            className="mt-4 text-sm"
          >
            {notice}
          </p>
        )}
        <fieldset disabled={busy} className="min-w-0">
          <TeamRows
            showIds={conflict}
            rows={rows}
            baseById={baseById}
            issues={issues}
            onChange={update}
            onRemove={(id) => {
              setRows((current) => current.filter((row) => row.id !== id));
              setIssues((current) =>
                current.filter((issue) => issue.rowId !== id),
              );
              setFocusTarget({ id: 'teams-add' });
              setNotice('Nový řádek byl odebrán z místních úprav.');
            }}
          />
        </fieldset>
        {conflict && (
          <div className="mt-5 space-y-3 border border-border bg-card p-4">
            <h3 id="teams-comparison" tabIndex={-1} className="font-semibold">
              Porovnání s aktuální tabulkou
            </h3>
            <Button
              className="min-h-11"
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void loadLatest()}
            >
              Načíst aktuální pro porovnání
            </Button>
            {latest && (
              <>
                <p className="text-sm text-muted-foreground">
                  Níže jsou uložené hodnoty. Volba „Použít moje změny“ zachová
                  vaše změněné řádky, převezme ostatní aktuální hodnoty a přidá
                  nové týmy z obou verzí. Uložení je stále samostatný krok.
                </p>
                <ul className="divide-y divide-border">
                  {latest.teams.map((team) => (
                    <li className="break-words py-3" key={team.id}>
                      <p className="font-medium">{team.name}</p>
                      <p className="whitespace-pre-wrap">
                        {team.description || 'Bez popisu'}
                      </p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        ID: {team.id}
                      </p>
                    </li>
                  ))}
                </ul>
                <Button
                  className="min-h-11"
                  type="button"
                  disabled={busy}
                  onClick={rebase}
                >
                  Použít moje změny po kontrole
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 sm:ml-2"
                  disabled={busy}
                  onClick={() => {
                    reset(latest);
                    setFocusTarget({ id: 'teams-status' });
                    setError('');
                    setNotice(
                      'Byla načtena aktuální tabulka. Místní změny byly zahozeny.',
                    );
                  }}
                >
                  Zahodit moje změny a načíst aktuální
                </Button>
              </>
            )}
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button
            className="min-h-11"
            id="teams-save"
            type="submit"
            disabled={busy || !dirty || conflict}
          >
            {busy ? 'Probíhá požadavek…' : 'Uložit tabulku'}
          </Button>
          {dirty && (
            <Button
              className="min-h-11"
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setDiscard(true)}
            >
              Zahodit změny
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            Uloží se vše, nebo nic. Před odchodem uložte změny.
          </p>
        </div>
        {discard && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border border-border p-4">
            <p>Zahodit všechny místní úpravy?</p>
            <Button
              className="min-h-11"
              type="button"
              disabled={busy}
              onClick={() => {
                reset(base);
                setFocusTarget({ id: 'teams-status' });
                setError('');
                setNotice('Místní změny byly zahozeny.');
              }}
            >
              Ano, zahodit
            </Button>
            <Button
              className="min-h-11"
              type="button"
              variant="outline"
              onClick={() => {
                setDiscard(false);
                setFocusTarget({ id: 'teams-add' });
              }}
            >
              Pokračovat v úpravách
            </Button>
          </div>
        )}
      </form>
      <TeamPaste disabled={busy || conflict} append={append} />
    </>
  );
}
