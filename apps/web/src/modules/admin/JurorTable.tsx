import './roster.css';
import { RosterQuickAdd } from './RosterQuickAdd';
import { RosterSaveStatus } from './RosterSaveStatus';

const stagedNotice = 'Nové řádky jsou připraveny. Uložte tabulku.';
import { juryGroupLabel } from '@d21/contracts';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  jurorTableSnapshotSchema,
  jurorTableSaveSchema,
  type JurorTableSnapshot,
  type JurorTableRow,
  type JurorTableIssue,
} from '@d21/contracts';
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
import { useAdminLeaveWarning } from './navigation';

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
  const [pastedIds, setPastedIds] = useState<string[]>([]);
  const [base, setBase] = useState(initial);
  const [rows, setRows] = useState<JurorTableRow[]>(tableRows(initial));
  const [issues, setIssues] = useState<JurorTableIssue[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [latest, setLatest] = useState<JurorTableSnapshot>();
  const [conflict, setConflict] = useState(false);
  const [undo, setUndo] = useState<{
    rows: JurorTableRow[];
    pastedIds: string[];
    issues: JurorTableIssue[];
    error: string;
    latest?: JurorTableSnapshot;
    conflict: boolean;
  }>();
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
    if (error || issues.length) {
      feedback.current?.focus();
    }
  }, [error, issues]);
  useEffect(() => {
    if (focusTarget) {
      document.getElementById(focusTarget.id)?.focus();
    }
  }, [focusTarget]);
  useAdminLeaveWarning(dirty || busy);
  function reset(snapshot: JurorTableSnapshot) {
    setPastedIds([]);
    setBase(snapshot);
    setRows(tableRows(snapshot));
    setLatest(undefined);
    setConflict(false);
    setIssues([]);
    setUndo(undefined);
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
    } else {
      setError(
        cause instanceof ApiError && cause.status === 413
          ? 'Tabulka je pro jeden požadavek příliš velká (64 KiB). Zkraťte jména nebo odeberte některé nové řádky. Hodnoty zůstaly zachovány.'
          : managementError(cause),
      );
    }
  }
  async function loadLatest(focusFeedback = true) {
    if (busy) {
      return;
    }
    setBusy(true);
    setUndo(undefined);
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
        if (focusFeedback) {
          setFocusTarget({ id: 'jurors-status' });
        }
      }
    } catch (cause) {
      if (!request.signal.aborted) {
        fail(cause);
      }
    } finally {
      if (!request.signal.aborted) {
        setBusy(false);
      }
    }
  }
  async function save() {
    if (busy || conflict) {
      return;
    }
    setError('');
    setNotice('');
    const errors = jurorRowIssues(rows);
    setIssues(errors);
    if (errors.length) {
      return;
    }
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
      if (result.status === 'invalid') {
        setIssues(result.issues);
      } else {
        reset(result.snapshot);
        setNotice('Tabulka porotců byla uložena.');
        setFocusTarget({ id: 'jurors-status' });
      }
    } catch (cause) {
      if (!request.signal.aborted) {
        fail(cause);
      }
    } finally {
      if (!request.signal.aborted) {
        setBusy(false);
      }
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
    setUndo(undefined);
    // Retain submitted errors until another validation, including while correcting fields.
  }
  function append(added: JurorTableRow[]) {
    setUndo(undefined);
    setRows((current) => [...current, ...added]);
    setNotice(stagedNotice);
    if (added[0]) {
      setFocusTarget({ id: `juror-${added[0].id}-displayName` });
    }
  }
  function appendPaste(added: JurorTableRow[]) {
    setPastedIds(added.map((row) => row.id));
    append(added);
  }
  const pasted = rows.filter(
    (row) => pastedIds.includes(row.id) && !baseById.has(row.id),
  );
  const pastedRowsLabel = new Intl.PluralRules('cs').select(pasted.length);
  const pastedLabels = { one: 'řádek', few: 'řádky', other: 'řádků' };
  function rebase() {
    setUndo(undefined);
    if (!latest || !canRebase(rows, base, latest)) {
      return;
    }
    const local = new Map(rows.map((row) => [row.id, row]));
    const merged: JurorTableRow[] = tableRows(latest).map((juror) => {
      const row = local.get(juror.id);
      return row && rowChanged(row, baseById.get(row.id)) ? row : juror;
    });
    const ids = new Set(merged.map((row) => row.id));
    for (const row of rows) {
      if (!ids.has(row.id) && !baseById.has(row.id)) {
        merged.push(row);
      }
    }
    const positions = new Map(rows.map((row, index) => [row.id, index]));
    // Keep edited rows in place while reviewing a merge; sort after saving.
    merged.sort(
      (a, b) =>
        (positions.get(a.id) ?? rows.length) -
        (positions.get(b.id) ?? rows.length),
    );
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
  function addRow(name = '') {
    append([{ id: crypto.randomUUID(), displayName: name, groupCode: '' }]);
  }
  const invalidRows = new Set(issues.map((issue) => issue.rowId)).size;
  const pendingSetup =
    rows.length > 0 && (missingGroups || missingLinks) && !conflict;
  return (
    <section aria-labelledby="jurors-heading">
      <div className="roster-page-head">
        <h1 id="jurors-heading">Porotci</h1>
        {(['T', 'V'] as const).map((code) => (
          <span className="roster-pill" key={code}>
            {juryGroupLabel(code)}{' '}
            {rows.filter((row) => row.groupCode === code).length}
          </span>
        ))}
        <div className="roster-page-actions">
          <JurorPaste
            disabled={busy || auxiliary || conflict}
            append={appendPaste}
          />
          <ExportJurorLinks
            eventId={eventId}
            onExpired={onExpired}
            disabled={busy || auxiliary || base.jurors.length === 0}
          />
        </div>
      </div>
      {base.locked && (
        <p className="roster-status text-muted-foreground">
          Jména můžete upravit a přidat nové porotce. Noví porotci zvýší
          očekávaný počet hlasujících v kategoriích jejich poroty. Zařazení
          stávajících porotců je pevné.
        </p>
      )}
      {notice && (
        <p
          id="jurors-status"
          tabIndex={-1}
          role="status"
          aria-atomic="true"
          className={notice === stagedNotice ? 'sr-only' : 'roster-status'}
        >
          {notice}
        </p>
      )}
      {(error || issues.length > 0) && (
        <div
          ref={feedback}
          role="alert"
          tabIndex={-1}
          className="feedback-error mb-4 space-y-2 text-sm text-destructive outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
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
      {conflict && (
        <div className="mb-4 space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 id="jurors-comparison" tabIndex={-1} className="font-semibold">
            Porovnání s aktuální tabulkou
          </h2>
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
                {latest.locked
                  ? 'Zařazení stávajících porotců je pevné.'
                  : 'Složení lze upravit.'}
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
      {pasted.length > 0 && (
        <section
          className="roster-paste-banner"
          aria-label="Náhled vložených řádků"
        >
          <p role="status">
            <strong>
              Vloženo {pasted.length}{' '}
              {pastedLabels[pastedRowsLabel as keyof typeof pastedLabels] ??
                pastedLabels.other}{' '}
              ze schránky.
            </strong>{' '}
            Sloupce: Jméno, Porota (T/V). Řádky jsou níže označené jako nové;
            uloží se s tabulkou.
          </p>
          <button
            type="button"
            disabled={busy || auxiliary}
            onClick={() => {
              const ids = new Set(pasted.map((row) => row.id));
              setRows((current) => current.filter((row) => !ids.has(row.id)));
              setIssues((current) =>
                current.filter((issue) => !ids.has(issue.rowId)),
              );
              setPastedIds([]);
              setNotice('Vložení bylo vráceno.');
              setFocusTarget({ id: 'jurors-status' });
            }}
          >
            Vrátit vložení
          </button>
        </section>
      )}
      <div aria-label="Tabulka porotců" role="form" aria-busy={busy}>
        <fieldset disabled={busy} className="min-w-0">
          <JurorRows
            locked={base.locked || !!latest?.locked}
            editingDisabled={auxiliary}
            onPanelChange={setAuxiliary}
            snapshot={base}
            disabled={busy || auxiliary || dirty || conflict}
            copyDisabled={busy || auxiliary}
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
            addRow={
              <RosterQuickAdd
                kind="jurors"
                label="Přidat porotce"
                prompt="Napište jméno nového porotce a stiskněte Enter"
                disabled={busy || auxiliary || conflict}
                add={addRow}
              />
            }
          />
        </fieldset>
        <p className="roster-footnote">
          Porota stávajících porotců je po prvním otevření hlasování pevná.
          Další akce (⋯): Nahradit odkaz, Zrušit přístup, Odebrat.
        </p>
        {(dirty || issues.length > 0 || error || undo || pendingSetup) && (
          <div className="roster-save-bar">
            <RosterSaveStatus changed={changed} invalid={invalidRows} />
            {dirty && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy || auxiliary}
                onClick={() => {
                  const previous = {
                    rows,
                    pastedIds,
                    issues,
                    error,
                    latest,
                    conflict,
                  };
                  reset(base);
                  setUndo(previous);
                  setError('');
                  setNotice('Místní změny byly zahozeny.');
                  setFocusTarget({ id: 'jurors-status' });
                }}
              >
                Zahodit
              </Button>
            )}
            {undo && (
              <Button
                type="button"
                variant="outline"
                disabled={busy || auxiliary}
                onClick={() => {
                  setRows(undo.rows);
                  setPastedIds(undo.pastedIds);
                  setIssues(undo.issues);
                  setError(undo.error);
                  setLatest(undo.latest);
                  setConflict(undo.conflict);
                  setUndo(undefined);
                  setNotice('Místní změny byly obnoveny.');
                  setFocusTarget({ id: 'jurors-status' });
                }}
              >
                Vrátit změny
              </Button>
            )}
            <Button
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
          </div>
        )}
      </div>
    </section>
  );
}
