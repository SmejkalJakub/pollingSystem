import { juryGroupLabel } from '@d21/contracts';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  jurorTableSnapshotSchema,
  jurorTableSaveSchema,
  type JurorTableSnapshot,
  type JurorTableRow,
  type JurorTableIssue,
} from '@d21/contracts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { adminRequest, managementError } from './api';
import {
  jurorRowIssues,
  jurorFieldError,
  rowChanged,
  tableRows,
  canRebase,
} from './juror-table-utils';
import { ExportJurorLinks } from './ExportJurorLinks';
import { JurorPaste } from './JurorPaste';
import { JurorRows } from './JurorRows';
import { JuryGroups } from './JuryGroups';

export function JurorTable({
  initial,
  eventId,
  onExpired,
}: {
  initial: JurorTableSnapshot;
  eventId: string;
  onExpired: () => void;
}) {
  const [auxiliary, setAuxiliary] = useState(false);
  const [query, setQuery] = useState('');
  const [base, setBase] = useState(initial);
  const [rows, setRows] = useState<JurorTableRow[]>(tableRows(initial));
  const [issues, setIssues] = useState<JurorTableIssue[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [latest, setLatest] = useState<JurorTableSnapshot>();
  const [conflict, setConflict] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{ id: string }>();
  const feedback = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const baseById = new Map(tableRows(base).map((juror) => [juror.id, juror]));
  const changed = rows.filter((row) =>
    rowChanged(row, baseById.get(row.id)),
  ).length;
  const dirty = changed > 0;
  const draftDirty = useRef(false);
  useLayoutEffect(() => {
    draftDirty.current = dirty || conflict;
  }, [dirty, conflict]);
  const missingGroups = !base.locked && base.groups.length < 2;
  const missingLinks = base.jurors.some((juror) => juror.access === 'none');
  const path = `/events/${eventId}/jurors/table`;
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
  function reset(snapshot: JurorTableSnapshot) {
    setBase(snapshot);
    setRows(tableRows(snapshot));
    setLatest(undefined);
    setConflict(false);
    setIssues([]);
    setDiscard(false);
  }
  function fail(cause: unknown) {
    if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
      onExpired();
      return;
    }
    if (
      cause instanceof ApiError &&
      (cause.code === 'JUROR_TABLE_CONFLICT' || cause.code === 'ROSTER_LOCKED')
    ) {
      setConflict(true);
      setError(
        'Tabulka se změnila. Vaše hodnoty zůstaly zachovány. Načtěte aktuální porotce pro porovnání a před dalším uložením je zkontrolujte.',
      );
    } else
      setError(
        cause instanceof ApiError && cause.status === 413
          ? 'Tabulka je pro jeden požadavek příliš velká (64 KiB). Zkraťte jména nebo odeberte některé nové řádky. Hodnoty zůstaly zachovány.'
          : managementError(cause),
      );
  }
  async function loadLatest(focusFeedback = true) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const request = new AbortController();
    controller.current = request;
    try {
      const snapshot = await adminRequest(path, jurorTableSnapshotSchema, {
        signal: request.signal,
      });
      if (draftDirty.current) {
        setLatest(snapshot);
        setConflict(true);
        setFocusTarget({ id: 'jurors-comparison' });
        setNotice(
          'Aktuální tabulka je načtena k porovnání. Vaše úpravy jsou stále v polích.',
        );
      } else {
        reset(snapshot);
        setNotice('Porotci byli obnoveni.');
        if (focusFeedback) setFocusTarget({ id: 'jurors-status' });
      }
    } catch (cause) {
      if (!request.signal.aborted) fail(cause);
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  async function save() {
    setQuery('');
    if (busy || conflict) return;
    setError('');
    setNotice('');
    const errors = jurorRowIssues(rows);
    setIssues(errors);
    if (errors.length) return;
    setBusy(true);
    const request = new AbortController();
    controller.current = request;
    try {
      const result = await adminRequest(path, jurorTableSaveSchema, {
        method: 'PUT',
        body: {
          baseVersion: base.version,
          rows: rows.map(({ id, displayName, groupCode }) => ({
            id,
            displayName,
            groupCode,
          })),
        },
        signal: request.signal,
      });
      if (result.status === 'invalid') setIssues(result.issues);
      else {
        reset(result.snapshot);
        setNotice('Tabulka porotců byla uložena.');
        setFocusTarget({ id: 'jurors-status' });
      }
    } catch (cause) {
      if (!request.signal.aborted) fail(cause);
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  function update(
    id: string,
    field: 'displayName' | 'groupCode',
    value: string,
  ) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
    setNotice('');
    setDiscard(false);
    // Retain submitted errors until another validation, including while correcting fields.
  }
  function append(added: JurorTableRow[]) {
    setRows((current) => [...current, ...added]);
    setNotice('Nové řádky jsou připraveny. Uložte tabulku.');
    if (added[0]) setFocusTarget({ id: `juror-${added[0].id}-displayName` });
  }
  function rebase() {
    if (!latest || !canRebase(rows, base, latest)) return;
    const local = new Map(rows.map((row) => [row.id, row]));
    const merged: JurorTableRow[] = tableRows(latest).map((juror) => {
      const row = local.get(juror.id);
      return row && rowChanged(row, baseById.get(row.id)) ? row : juror;
    });
    const ids = new Set(merged.map((row) => row.id));
    for (const row of rows)
      if (!ids.has(row.id) && !baseById.has(row.id)) merged.push(row);
    setRows(merged);
    setBase(latest);
    setLatest(undefined);
    setConflict(false);
    setError('');
    setFocusTarget({ id: 'jurors-status' });
    setNotice(
      'Vaše změny jsou připraveny nad aktuální tabulkou. Zkontrolujte je a uložte.',
    );
  }
  return (
    <>
      <h2 className="mt-6 text-2xl font-semibold">Porotci</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Upravte jména a přiřazení k Technické či Veřejné porotě a uložte celou
        tabulku najednou. Stejná jména označují samostatná členství.
      </p>
      {missingGroups && (
        <p className="mt-4 text-sm text-muted-foreground">
          Uložení tabulky automaticky vytvoří chybějící Technickou či Veřejnou
          porotu. Existující názvy a členové zůstanou zachováni.
        </p>
      )}
      {base.locked && (
        <p
          role="status"
          className="mt-4 border-l-2 border-primary bg-secondary p-4 text-sm"
        >
          Složení poroty je uzamčeno. Jména lze opravit; členství a přiřazení k
          Technické či Veřejné porotě měnit nelze.
        </p>
      )}
      <div
        aria-label="Tabulka porotců"
        className="mt-5"
        role="form"
        aria-busy={busy}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {rows.length} porotců · {changed} změněných řádků
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              type="button"
              variant="ghost"
              disabled={busy || auxiliary}
              onClick={() => void loadLatest()}
            >
              Obnovit porotu
            </Button>
            <Button
              className="min-h-11"
              type="button"
              variant="outline"
              id="jurors-add"
              disabled={busy || auxiliary || conflict || base.locked}
              onClick={() =>
                append([
                  { id: crypto.randomUUID(), displayName: '', groupCode: '' },
                ])
              }
            >
              Nový porotce
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
                href={`#juror-${issue.rowId}-${issue.field}`}
                key={`${issue.rowId}-${issue.field}`}
              >
                Řádek {rows.findIndex((row) => row.id === issue.rowId) + 1}:{' '}
                {jurorFieldError(issue.field)}
              </a>
            ))}
          </div>
        )}
        {notice && (
          <p
            id="jurors-status"
            tabIndex={-1}
            role="status"
            aria-atomic="true"
            className="mt-4 text-sm"
          >
            {notice}
          </p>
        )}
        <div className="mt-4 max-w-sm">
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
            disabled={busy || auxiliary}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {dirty && (
          <p className="mt-3 text-sm text-muted-foreground">
            Před správou osobních odkazů, členství nebo názvů částí uložte či
            zahoďte změny v tabulce.
          </p>
        )}
        {query && (
          <p className="mt-2 text-sm text-muted-foreground">
            Hledání skrývá řádky; uloží se celá tabulka.
          </p>
        )}
        <fieldset disabled={busy} className="min-w-0">
          <JurorRows
            locked={base.locked || !!latest?.locked}
            editingDisabled={auxiliary}
            onPanelChange={setAuxiliary}
            query={query}
            snapshot={base}
            disabled={busy || auxiliary || dirty || conflict}
            reload={(focusFeedback = true) => void loadLatest(focusFeedback)}
            onExpired={onExpired}
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
              setFocusTarget({ id: 'jurors-add' });
              setNotice('Nový řádek byl odebrán z místních úprav.');
            }}
          />
        </fieldset>
        {conflict && (
          <div className="mt-5 space-y-3 border border-border bg-card p-4">
            <h3 id="jurors-comparison" tabIndex={-1} className="font-semibold">
              Porovnání s aktuální tabulkou
            </h3>
            <Button
              className="min-h-11"
              type="button"
              variant="outline"
              disabled={busy || auxiliary}
              onClick={() => void loadLatest()}
            >
              Načíst aktuální pro porovnání
            </Button>
            {latest && (
              <>
                <p className="text-sm text-muted-foreground">
                  Níže jsou uložené hodnoty. Volba „Použít moje změny“ zachová
                  vaše změněné řádky, převezme ostatní aktuální hodnoty a přidá
                  nové porotce z obou verzí. Uložení je stále samostatný krok.
                </p>
                {!canRebase(rows, base, latest) && (
                  <p role="alert" className="text-sm text-destructive">
                    Aktuální porota je uzamčena nebo byl váš upravený člen
                    odebrán. Tyto místní změny nelze bezpečně přenést. Načtěte
                    aktuální tabulku a zadejte povolené opravy znovu.
                  </p>
                )}
                <p className="break-words text-sm">
                  Aktuální části:{' '}
                  {latest.groups
                    .map(
                      (group) =>
                        `${juryGroupLabel(group.code)} — ${group.name} (${group.id})`,
                    )
                    .join('; ') || 'Zatím žádné'}
                  .{' '}
                  {latest.locked ? 'Složení uzamčeno.' : 'Složení lze upravit.'}
                </p>
                <ul className="divide-y divide-border">
                  {tableRows(latest).map((juror) => (
                    <li className="break-words py-3" key={juror.id}>
                      <p className="font-medium">{juror.displayName}</p>
                      <p className="whitespace-pre-wrap">
                        {juryGroupLabel(juror.groupCode)}
                      </p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        ID: {juror.id}
                      </p>
                    </li>
                  ))}
                </ul>
                <Button
                  className="min-h-11"
                  type="button"
                  disabled={busy || !canRebase(rows, base, latest)}
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
                    setFocusTarget({ id: 'jurors-status' });
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
            id="jurors-save"
            type="button"
            onClick={() => void save()}
            disabled={
              busy ||
              auxiliary ||
              (!dirty && !missingGroups && !missingLinks) ||
              conflict
            }
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
                setFocusTarget({ id: 'jurors-status' });
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
                setFocusTarget({ id: 'jurors-add' });
              }}
            >
              Pokračovat v úpravách
            </Button>
          </div>
        )}
      </div>
      <ExportJurorLinks
        eventId={eventId}
        onExpired={onExpired}
        disabled={
          busy || auxiliary || dirty || conflict || base.jurors.length === 0
        }
      />
      <JurorPaste
        disabled={busy || auxiliary || conflict || base.locked}
        append={append}
      />
      <JuryGroups
        onPanelChange={setAuxiliary}
        eventId={eventId}
        roster={base}
        disabled={busy || auxiliary || dirty || conflict}
        reload={() => void loadLatest()}
        onExpired={onExpired}
      />
    </>
  );
}
