import { useEffect, useId, useRef, useState } from 'react';
import {
  votingSetupSnapshotSchema,
  votingSetupSaveSchema,
  type VotingSetupSnapshot,
  type VotingSetupValues,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { useAdminLeaveWarning } from './navigation';
import { ApiError } from '@/lib/api';
import { adminRequest, managementError } from './api';
import {
  rebaseSetup,
  sameSetup,
  setupFieldLabels,
  setupValues,
} from './voting-setup-utils';
import { VotingSetupComparison } from './VotingSetupComparison';
import { VotingSetupFields } from './VotingSetupFields';
import { VotingReadiness } from './VotingReadiness';

export function VotingSetup({
  eventId,
  votingId,
  onExpired,
  onSaved,
  onBlocked,
  onCancel,
  paused = false,
}: {
  eventId: string;
  votingId: string;
  onExpired: () => void;
  onSaved: () => void;
  onBlocked?: (blocked: boolean) => void;
  onCancel?: () => void;
  paused?: boolean;
}) {
  const [returnFocus] = useState(() => document.activeElement);
  const [isCreation] = useState(Boolean(onCancel));
  const initiallyFocused = useRef(false);
  const id = useId(),
    path = `/events/${eventId}/votings/${votingId}/setup`;
  const [base, setBase] = useState<VotingSetupSnapshot>();
  const [values, setValues] = useState<VotingSetupValues>();
  const [current, setCurrent] = useState<VotingSetupSnapshot>();
  const [issues, setIssues] = useState<string[]>([]),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false),
    [conflict, setConflict] = useState(false);
  const [undo, setUndo] = useState<{
    values: VotingSetupValues;
    current?: VotingSetupSnapshot;
    issues: string[];
    error: string;
    conflict: boolean;
  }>();
  const feedback = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    controller = useRef<AbortController>(null);
  const dirty = Boolean(
    base && values && !sameSetup(setupValues(base), values),
  );
  const blocked = dirty || busy || conflict || Boolean(current);
  useEffect(() => {
    onBlocked?.(blocked);
    return () => onBlocked?.(false);
  }, [blocked, onBlocked]);
  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    adminRequest(path, votingSetupSnapshotSchema, { signal: abort.signal })
      .then((snapshot) => {
        if (!abort.signal.aborted) {
          setBase(snapshot);
          setValues(setupValues(snapshot));
        }
      })
      .catch((cause: unknown) => {
        if (!abort.signal.aborted) {
          if (cause instanceof ApiError && [401, 403].includes(cause.status))
            onExpired();
          else setError(managementError(cause));
        }
      });
    return () => abort.abort();
  }, [path, onExpired]);
  useEffect(() => {
    if (base && isCreation && !initiallyFocused.current) {
      heading.current?.focus();
      initiallyFocused.current = true;
    }
  }, [base, isCreation]);
  useEffect(
    () => () => {
      if (isCreation)
        queueMicrotask(() => {
          if (returnFocus instanceof HTMLElement && returnFocus.isConnected)
            returnFocus.focus();
        });
    },
    [isCreation, returnFocus],
  );
  useEffect(() => {
    if (error || issues.length || current || notice) feedback.current?.focus();
  }, [error, issues, current, notice]);
  useAdminLeaveWarning(dirty || busy);
  function accept(snapshot: VotingSetupSnapshot) {
    setBase(snapshot);
    setValues(setupValues(snapshot));
    setCurrent(undefined);
    setIssues([]);
    setConflict(false);
    setUndo(undefined);
    setError('');
  }
  async function refresh() {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const snapshot = await adminRequest(path, votingSetupSnapshotSchema, {
        signal: controller.current?.signal,
      });
      if (dirty || conflict) setCurrent(snapshot);
      else {
        accept(snapshot);
        setNotice('Aktuální příprava byla načtena.');
      }
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  }
  function fail(cause: unknown) {
    if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
      setBase(undefined);
      setValues(undefined);
      onExpired();
    } else if (
      cause instanceof ApiError &&
      ['VOTING_SETUP_CONFLICT', 'VOTING_NOT_EDITABLE'].includes(cause.code)
    ) {
      setConflict(true);
      setError(
        'Kategorie se změnila nebo byla uzamčena. Načtěte aktuální přípravu a porovnejte ji.',
      );
    } else if (cause instanceof ApiError && cause.status === 413)
      setError(
        'Příprava je příliš velká. Zkraťte texty nebo přidejte méně nových položek a uložte znovu. Nic se neuložilo.',
      );
    else setError(managementError(cause));
  }
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!base || !values || busy || paused || conflict || current) return;
    setBusy(true);
    setError('');
    setNotice('');
    setIssues([]);
    try {
      const result = await adminRequest(path, votingSetupSaveSchema, {
        method: 'PUT',
        body: { baseVersion: base.version, values },
        signal: controller.current?.signal,
      });
      if (result.status === 'invalid')
        setIssues(result.issues.map((issue) => issue.field));
      else {
        accept(result.snapshot);
        setNotice('Kategorie byla uložena.');
        onSaved();
      }
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  }
  function change(next: VotingSetupValues) {
    if (values && next.items.length !== values.items.length) setIssues([]);
    setValues(next);
    setNotice('');
    setUndo(undefined);
  }
  const fieldId = (field: string) => `${id}-${field}`;
  const fieldLabel = (field: string) =>
    setupFieldLabels[field] ??
    `${field.endsWith('teamId') ? 'Tým' : 'Pořadí'}, položka ${Number(field.split('.')[1]) + 1}`;
  if (!base || !values)
    return (
      <div
        ref={feedback}
        tabIndex={error ? -1 : undefined}
        className="mt-6"
        role={error ? 'alert' : 'status'}
      >
        {error || 'Načítání přípravy…'}
        {error && (
          <Button className="ml-3 min-h-11" onClick={() => void refresh()}>
            Zkusit znovu
          </Button>
        )}
      </div>
    );
  const rebased = current ? rebaseSetup(base, values, current) : null;
  const editingDisabled =
    busy || paused || !base.editable || conflict || Boolean(current);
  return (
    <form
      onSubmit={save}
      aria-label="Příprava kategorie"
      noValidate
      aria-busy={busy}
      className="mt-6 space-y-6 border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3
          ref={heading}
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          Příprava kategorie
        </h3>
        <Button
          className="min-h-11"
          type="button"
          variant="ghost"
          disabled={busy || paused}
          onClick={() => void refresh()}
        >
          Načíst aktuální přípravu
        </Button>
      </div>
      {isCreation && (
        <p className="text-sm text-muted-foreground">
          Kategorii můžete uložit jako koncept a dokončit ji později.
        </p>
      )}
      {base.editable && (
        <VotingReadiness
          values={values}
          snapshot={base}
          eventId={eventId}
          fieldId={fieldId}
          needsSave={dirty || isCreation}
          disabled={editingDisabled}
          onChange={change}
        />
      )}
      <div className="editor-actions">
        <Button type="submit" className="min-h-11" disabled={editingDisabled}>
          {busy ? 'Ukládání…' : 'Uložit kategorii'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={busy || !dirty}
          onClick={() => {
            const previous = { values, current, issues, error, conflict };
            accept(base);
            setUndo(previous);
            setNotice('Místní změny byly zahozeny.');
          }}
        >
          Zahodit místní změny
        </Button>
        {undo && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy || paused}
            onClick={() => {
              setValues(undo.values);
              setCurrent(undo.current);
              setIssues(undo.issues);
              setError(undo.error);
              setConflict(undo.conflict);
              setUndo(undefined);
              setNotice('Místní změny byly obnoveny.');
            }}
          >
            Vrátit změny
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          {dirty ? 'Neuložené změny' : 'Žádné neuložené úpravy'}
        </span>
        {onCancel && (
          <Button
            type="button"
            className="min-h-11"
            variant="ghost"
            disabled={busy || dirty}
            onClick={onCancel}
          >
            Zrušit
          </Button>
        )}
      </div>
      {(error || issues.length > 0 || notice || current) && (
        <div
          ref={feedback}
          tabIndex={-1}
          role={error || issues.length ? 'alert' : 'status'}
          className="space-y-3 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p>{notice}</p>}
          {issues.length > 0 && (
            <>
              <p className="text-sm text-destructive">
                Zkontrolujte formulář. Nic se neuložilo.
              </p>
              {[...new Set(issues)].map((field) => (
                <a
                  className="block text-sm underline"
                  key={field}
                  href={`#${fieldId(field)}`}
                  onClick={() =>
                    document.getElementById(fieldId(field))?.focus()
                  }
                >
                  {fieldLabel(field)}
                </a>
              ))}
            </>
          )}
          {current && (
            <section
              aria-label="Porovnání přípravy"
              className="space-y-4 border border-border p-4"
            >
              <h4 className="font-semibold">
                Zkontrolujte místní a aktuální přípravu
              </h4>
              <p className="text-sm">
                Změněná místní pole a celé změněné položky lze převzít až po
                této kontrole. Nezměněná pole a nové vzdálené položky budou
                aktuální. Převzetí ještě nic neukládá.
              </p>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                {[
                  ['Moje změny', values],
                  ['Aktuálně uložené', setupValues(current)],
                ].map(([title, data]) => (
                  <div className="min-w-0" key={String(title)}>
                    <h4 className="font-semibold">{String(title)}</h4>
                    <VotingSetupComparison
                      values={data as VotingSetupValues}
                      snapshot={title === 'Moje změny' ? base : current}
                    />
                  </div>
                ))}
              </div>
              <p>
                {current.editable
                  ? 'Konfigurace je stále upravitelná.'
                  : 'Konfigurace je uzamčená. Místní změny nelze uložit.'}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="min-h-11 h-auto whitespace-normal"
                  disabled={busy || !rebased}
                  onClick={() => {
                    if (rebased) {
                      setBase(current);
                      setValues(rebased);
                      setCurrent(undefined);
                      setConflict(false);
                      setError('');
                      setIssues([]);
                      setNotice(
                        'Změny byly převzaty po kontrole. Uložte kategorii samostatně.',
                      );
                    }
                  }}
                >
                  Použít moje změny po kontrole
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 h-auto whitespace-normal"
                  disabled={busy || paused}
                  onClick={() => {
                    accept(current);
                    setNotice('Aktuální příprava byla načtena.');
                    onSaved();
                  }}
                >
                  Zahodit moje změny a načíst aktuální
                </Button>
              </div>
            </section>
          )}
        </div>
      )}
      {!base.editable && (
        <p className="text-sm">
          Pravidla, položky a oprávnění jsou uzamčené po aktivaci nebo vzniku
          hlasovacího lístku.
        </p>
      )}
      <fieldset disabled={editingDisabled} className="min-w-0 space-y-6">
        <VotingSetupFields
          values={values}
          snapshot={base}
          onChange={change}
          issues={issues}
          fieldId={fieldId}
        />
      </fieldset>
    </form>
  );
}
