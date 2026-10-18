import { useEffect, useRef, useState } from 'react';
import {
  ballotDraftSchema,
  ballotDraftResponseSchema,
  type BallotDraft,
  type BallotEntry,
  type WizardStepDetail,
} from '@d21/contracts';
import { ApiError, apiRequest } from '@/lib/api';

function sameEntries(a: BallotEntry[], b: BallotEntry[]) {
  return (
    a.length === b.length &&
    a.every((entry) =>
      b.some(
        (other) =>
          other.votingItemId === entry.votingItemId &&
          other.voteValue === entry.voteValue,
      ),
    )
  );
}

export function useBallotDraft(
  detail: WizardStepDetail,
  onAccessError: (error: unknown) => void,
) {
  const [entries, setEntries] = useState<BallotEntry[]>(
    detail.ballot?.entries ?? [],
  );
  const [saved, setSaved] = useState(detail.ballot);
  const [latest, setLatest] = useState<BallotDraft>();
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [rejection, setRejection] = useState<{
    detail: WizardStepDetail;
    issue: 'VOTING_UNAVAILABLE' | 'CONFIGURATION_NOT_READY';
  }>();
  const serverIssue =
    rejection?.detail === detail ? rejection.issue : undefined;
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const dirty = !sameEntries(entries, saved?.entries ?? []);
  // Revalidation must never replace local choices or silently advance their base revision.
  const remote =
    latest ??
    ((detail.ballot?.revision ?? -1) > (saved?.revision ?? -1)
      ? detail.ballot!
      : undefined);
  const needsComparison = conflict || Boolean(remote);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);

  const path = `/wizard/steps/${detail.step.id}/ballot-draft`;
  async function loadLatest(signal: AbortSignal) {
    const value = await apiRequest(path, ballotDraftResponseSchema, { signal });
    if (!value) throw new Error('Saved draft is unavailable.');
    setLatest(value);
    setConflict(true);
    setMessage(
      'Novější uložená verze je připravená k porovnání. Váš výběr zůstává zachovaný.',
    );
  }
  async function run(operation: 'save' | 'load' | 'submit') {
    if (controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setMessage('');
    try {
      if (operation !== 'load') {
        const value = await apiRequest(
          operation === 'submit'
            ? `/wizard/steps/${detail.step.id}/submit`
            : path,
          ballotDraftSchema,
          {
            method: operation === 'submit' ? 'POST' : 'PUT',
            body: { entries, expectedRevision: saved?.revision ?? null },
            signal: request.signal,
          },
        );
        setSaved(value);
        setEntries(value.entries);
        setLatest(undefined);
        setConflict(false);
        setMessage(
          value.status === 'submitted'
            ? 'Hlasy v této kategorii byly odevzdány. Další kategorie můžete dokončit později.'
            : value.validation.valid
              ? 'Návrh je uložený. Hlasy zatím nejsou odevzdané.'
              : 'Návrh je uložený jako neplatný. Před odevzdáním opravte uvedené chyby.',
        );
      } else await loadLatest(request.signal);
      return true;
    } catch (error) {
      if (request.signal.aborted) return;
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        onAccessError(error);
        return;
      }
      if (
        error instanceof ApiError &&
        ['DRAFT_CONFLICT', 'BALLOT_NOT_EDITABLE'].includes(error.code)
      ) {
        setConflict(true);
        try {
          await loadLatest(request.signal);
        } catch (cause) {
          if (request.signal.aborted) return;
          if (
            cause instanceof ApiError &&
            [401, 403, 404].includes(cause.status)
          ) {
            onAccessError(cause);
            return;
          }
          setMessage(
            'Novější návrh se nepodařilo načíst. Váš výběr zůstává na stránce. Zkuste načtení znovu.',
          );
        }
        return 'conflict' as const;
      } else if (error instanceof ApiError && error.code === 'INVALID_BALLOT') {
        setMessage(
          'Výběr nelze odevzdat. Opravte uvedené chyby a zkuste to znovu.',
        );
      } else if (
        error instanceof ApiError &&
        ['VOTING_UNAVAILABLE', 'CONFIGURATION_NOT_READY'].includes(error.code)
      ) {
        setRejection({
          detail,
          issue: error.code as 'VOTING_UNAVAILABLE' | 'CONFIGURATION_NOT_READY',
        });
        setMessage('');
      } else
        setMessage(
          'Výsledek operace se nepodařilo potvrdit. Váš výběr zůstává na stránce. Zkontrolujte připojení a zkuste to znovu.',
        );
    } finally {
      if (!request.signal.aborted) setBusy(false);
      if (controller.current === request) controller.current = null;
    }
  }
  function resolve(useLocal: boolean) {
    if (!remote) return;
    setSaved(remote);
    if (!useLocal) setEntries(remote.entries);
    setLatest(undefined);
    setConflict(false);
    setMessage(
      useLocal
        ? 'Váš výběr je zachovaný. Tlačítkem Uložit návrh nahradíte porovnanou uloženou verzi.'
        : 'Načtena uložená verze. Předchozí místní změny byly zahozené.',
    );
  }
  return {
    entries,
    setEntries: (value: BallotEntry[]) => {
      setEntries(value);
      setMessage('');
    },
    saved,
    remote,
    needsComparison,
    dirty,
    busy,
    message: serverIssue
      ? 'Kategorie nyní nepřijímá změny. Uložený návrh je zachovaný a neuložené změny zůstávají na této stránce.'
      : message,
    serverIssue,
    save: () => run('save'),
    submit: () => run('submit'),
    refresh: () => run('load'),
    resolve,
  };
}
