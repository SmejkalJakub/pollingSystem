import { BallotSubmission } from './BallotSubmission';
import { useEffect, useRef, useState } from 'react';
import {
  ballotValidationSchema,
  type BallotIssue,
  type BallotValidation,
  type WizardStepDetail,
} from '@d21/contracts';
import { toggleVote, validateBallot } from '@d21/voting-domain';
import { Button } from '@/components/ui/button';
import { ApiError, apiRequest } from '@/lib/api';
import { useBallotDraft } from './useBallotDraft';
import { DraftPersistence } from './DraftPersistence';

import { messages } from './ballotMessages';

export function CategoryVoting({
  detail,
  onAccessError,
  onUnsavedChange,
  onRefresh,
  refreshing,
}: {
  detail: WizardStepDetail;
  onAccessError: (error: unknown) => void;
  onUnsavedChange: (unsaved: boolean) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const draft = useBallotDraft(detail, onAccessError);
  const { entries, setEntries } = draft;
  useEffect(() => {
    onUnsavedChange(draft.dirty || draft.busy);
  }, [draft.dirty, draft.busy, onUnsavedChange]);
  const [blocked, setBlocked] = useState<BallotIssue>();
  const [verification, setVerified] = useState<{
    detail: WizardStepDetail;
    report: BallotValidation;
  }>();
  const verified =
    verification?.detail === detail ? verification.report : undefined;
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const { step, items } = detail;
  const ids = items.map((item) => item.id);
  const local = validateBallot(step, ids, entries);
  const categoryUnavailable =
    Boolean(draft.serverIssue) ||
    local.issues.some((issue) =>
      ['VOTING_UNAVAILABLE', 'CONFIGURATION_NOT_READY'].includes(issue),
    ) ||
    verified?.issues.some((issue) =>
      [
        'VOTING_UNAVAILABLE',
        'CONFIGURATION_NOT_READY',
        'UNKNOWN_ITEM',
      ].includes(issue),
    );
  const unavailable =
    categoryUnavailable ||
    Boolean(draft.saved && draft.saved.status !== 'draft') ||
    Boolean(draft.remote && draft.remote.status !== 'draft');
  const issues = [
    ...new Set([
      ...local.issues,
      ...(verified?.issues ?? []),
      ...(draft.serverIssue ? [draft.serverIssue] : []),
    ]),
  ];

  function toggle(itemId: string, value: 1 | -1) {
    const result = toggleVote(step, ids, entries, itemId, value);
    setEntries(result.entries);
    setBlocked(result.blocked);
    setVerified(undefined);
    setFailed(false);
  }
  async function check() {
    if (checking) return;
    setChecking(true);
    setVerified(undefined);
    setFailed(false);
    controller.current = new AbortController();
    try {
      const result = await apiRequest(
        `/wizard/steps/${step.id}/validate`,
        ballotValidationSchema,
        {
          method: 'POST',
          body: { entries },
          signal: controller.current.signal,
        },
      );
      setVerified({ detail, report: result });
    } catch (error) {
      if (controller.current.signal.aborted) return;
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        onAccessError(error);
        return;
      }
      setFailed(true);
    } finally {
      if (!controller.current.signal.aborted) {
        setChecking(false);
        // Focus only after an explicit check, never while toggling a vote.
        window.setTimeout(() => feedback.current?.focus(), 0);
      }
    }
  }
  return (
    <>
      <div
        className="sticky top-0 z-10 mt-6 border-y border-border bg-background py-3 sm:py-4"
        aria-label="Souhrn hlasů"
      >
        <div
          className="grid grid-cols-2 gap-3 text-sm"
          role="status"
          aria-atomic="true"
        >
          <p>
            <span className="block font-medium">Kladné hlasy</span>
            <strong className="font-mono text-lg">
              {local.plusUsed} / {step.maxPlusVotes ?? '—'}
            </strong>
            <span className="block text-muted-foreground">
              Zbývá {local.plusRemaining}
            </span>
          </p>
          <p>
            <span className="block font-medium">Záporné hlasy</span>
            <strong className="font-mono text-lg">
              {local.minusUsed} / {step.maxMinusVotes ?? '—'}
            </strong>
            <span className="block text-muted-foreground">
              {step.allowNegativeVotes
                ? `Nyní zbývá ${local.minusRemaining}`
                : 'Nejsou povoleny'}
            </span>
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {step.kind === 'selection' ? 'Postupujících' : 'Vítězů'}:{' '}
        {step.selectedPlaces ?? 'Neuvedeno'}. Hlasy nemusíte využít všechny.
        {step.allowNegativeVotes && ' Každý záporný hlas vyžaduje dva kladné.'}
        {' Opětovné stisknutí hlas odebere; opačné znaménko jej nahradí.'}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Návrh uložíte tlačítkem pod seznamem týmů. Kontrola výběru hlasy
        neukládá ani neodevzdává. Neuložené změny se při odchodu ztratí.
      </p>
      <div aria-live="polite" aria-atomic="true" className="mt-4">
        {issues.length > 0 && (
          <div className="border-l-2 border-destructive bg-card p-4">
            <p className="font-semibold">
              {unavailable
                ? 'Kategorie není dostupná'
                : 'Výběr zatím není platný'}
            </p>
            <ul className="mt-2 space-y-2">
              {issues.map((issue) => (
                <li key={issue}>{messages[issue]}</li>
              ))}
            </ul>
          </div>
        )}
        {blocked && !issues.includes(blocked) && (
          <p className="border-l-2 border-destructive p-4">
            {messages[blocked]}
          </p>
        )}
      </div>
      {items.length ? (
        <table
          className="voting-table mt-6 w-full table-fixed text-left"
          role="table"
        >
          <caption className="mb-3 text-left text-lg font-semibold">
            Soutěžní týmy
          </caption>
          <thead className="text-sm text-muted-foreground">
            <tr role="row">
              <th scope="col" className="w-10 py-3 font-normal">
                Č.
              </th>
              <th scope="col" className="py-3 font-normal">
                Tým
              </th>
              <th scope="col" className="w-14 py-3 text-center font-normal">
                Hlas +
              </th>
              <th scope="col" className="w-14 py-3 text-center font-normal">
                Hlas −
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const value = entries.find(
                (entry) => entry.votingItemId === item.id,
              )?.voteValue;
              return (
                <tr
                  key={item.id}
                  role="row"
                  className="border-t border-border align-top"
                >
                  <td
                    role="cell"
                    className="py-5 font-mono text-sm text-muted-foreground"
                  >
                    {index + 1}
                  </td>
                  <th
                    role="rowheader"
                    scope="row"
                    className="min-w-0 py-4 pr-2 font-normal"
                  >
                    <span className="break-words font-semibold">
                      {item.name}
                    </span>
                    {item.description && (
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </th>
                  {([1, -1] as const).map((sign) => (
                    <td role="cell" key={sign} className="py-4 text-center">
                      <Button
                        variant="outline"
                        className={`relative min-h-11 min-w-11 p-0 text-xl ${value === sign ? (sign === 1 ? 'border-2 border-ring bg-ring text-primary-foreground hover:bg-ring hover:text-primary-foreground dark:bg-ring dark:hover:bg-ring' : 'border-2 border-destructive bg-destructive text-primary-foreground hover:bg-destructive hover:text-primary-foreground dark:bg-destructive dark:hover:bg-destructive') : ''}`}
                        aria-label={`${sign === 1 ? 'Kladný' : 'Záporný'} hlas: ${item.name}, tým ${index + 1}`}
                        aria-pressed={value === sign}
                        disabled={
                          confirming ||
                          checking ||
                          draft.busy ||
                          Boolean(unavailable) ||
                          (sign === -1 && !step.allowNegativeVotes)
                        }
                        onClick={() => toggle(item.id, sign)}
                      >
                        {sign === 1 ? '+' : '−'}
                        {value === sign && (
                          <span
                            aria-hidden="true"
                            className="absolute right-0.5 top-0 text-xs"
                          >
                            ✓
                          </span>
                        )}
                      </Button>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="py-8 text-muted-foreground">
          V této kategorii zatím nejsou žádné týmy. Obraťte se na organizátora.
        </p>
      )}
      <DraftPersistence
        draft={draft}
        items={items}
        unavailable={Boolean(categoryUnavailable)}
        interactionDisabled={confirming || checking}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
      <BallotSubmission
        draft={draft}
        valid={local.valid}
        unavailable={Boolean(unavailable) || checking}
        confirming={confirming}
        setConfirming={setConfirming}
      />
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button
          variant="outline"
          className="min-h-11"
          onClick={check}
          disabled={
            confirming || checking || draft.busy || Boolean(unavailable)
          }
        >
          {checking ? 'Kontrolujeme…' : 'Zkontrolovat výběr'}
        </Button>
        <span className="text-sm text-muted-foreground">
          Kontrola nic neukládá
        </span>
      </div>
      <div
        ref={feedback}
        tabIndex={-1}
        className="mt-4 scroll-mt-44 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        role="status"
      >
        {verified && (
          <p className={verified.valid ? 'text-ring' : 'text-destructive'}>
            {verified.valid
              ? 'Server potvrdil platný výběr. Kontrola neukládá změny ani neodevzdává hlasy.'
              : 'Server výběr nepotvrdil. Opravte uvedené chyby.'}
          </p>
        )}
        {failed && (
          <p className="text-destructive">
            Kontrola se nezdařila. Váš výběr zůstává na stránce. Zkontrolujte
            připojení a zkuste kontrolu znovu.
          </p>
        )}
      </div>
    </>
  );
}
