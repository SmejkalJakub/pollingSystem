import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import type {
  BallotDraft,
  BallotIssue,
  WizardStep,
  WizardStepDetail,
} from '@d21/contracts';
import { toggleVote, validateBallot } from '@d21/voting-domain';
import { Button } from '@/components/ui/button';
import { ClosedCategory, LockIcon } from './CategoryAvailability';
import { BallotSubmission } from './BallotSubmission';
import { DraftPersistence } from './DraftPersistence';
import { VoteBudget } from './VoteBudget';
import { useBallotDraft } from './useBallotDraft';
import type { useWizardNavigation } from './useWizardNavigation';
import { messages } from './ballotMessages';

const blockedMessages: Partial<Record<BallotIssue, string>> = {
  PLUS_LIMIT: 'Všechny kladné hlasy jsou rozdané. Nejprve některý odeberte.',
  MINUS_LIMIT: 'Všechny záporné hlasy jsou rozdané. Nejprve některý odeberte.',
  NEGATIVE_ELIGIBILITY:
    'Každý záporný hlas potřebuje dva rozdané kladné hlasy.',
};

function placesLabel(step: WizardStep) {
  const places = step.selectedPlaces;
  if (places === null) {
    return 'počet míst neurčen';
  }
  if (step.kind === 'selection') {
    return `${places} ${places <= 4 ? 'postupující' : 'postupujících'}`;
  }
  if (places === 1) {
    return '1 vítěz';
  }
  return `${places} ${places <= 4 ? 'vítězové' : 'vítězů'}`;
}

function Instructions({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);
  const paragraph = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const target = paragraph.current;
    if (!target) {
      return;
    }
    const observer = new ResizeObserver(() => {
      const twoLines = parseFloat(getComputedStyle(target).lineHeight) * 2;
      setClipped(target.scrollHeight > Math.ceil(twoLines));
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <p
        id="category-instructions"
        ref={paragraph}
        data-expanded={expanded}
        className="wizard-instructions"
      >
        {text}
      </p>
      {clipped && (
        <button
          type="button"
          className="wizard-instructions-toggle"
          aria-expanded={expanded}
          aria-controls="category-instructions"
          onClick={() => setExpanded(!expanded)}
        >
          Zobrazit celé
        </button>
      )}
    </>
  );
}

function savedTime(ballot: BallotDraft) {
  return new Intl.DateTimeFormat('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ballot.savedAt));
}

export function CategoryVoting({
  detail,
  categoryNumber,
  categoryCount,
  headingRef,
  onAccessError,
  onGuardChange,
  onAvailabilityChange,
  onRefresh,
  refreshing,
  navigation,
  nextHref,
  lastCategory,
  nextAvailable,
  onSaved,
  onSubmitted,
}: {
  detail: WizardStepDetail;
  categoryNumber: number;
  categoryCount: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAccessError: (error: unknown) => void;
  onGuardChange: (dirty: boolean, busy: boolean) => void;
  onAvailabilityChange: (id: string, closed: boolean) => void;
  onRefresh: () => void;
  refreshing: boolean;
  navigation: ReturnType<typeof useWizardNavigation>;
  nextHref: string;
  lastCategory: boolean;
  nextAvailable?: WizardStep;
  onSaved: (ballot: BallotDraft) => void;
  onSubmitted: (ballot: BallotDraft) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [blocked, setBlocked] = useState<BallotIssue>();
  const draft = useBallotDraft(detail, onAccessError);
  const { entries, setEntries } = draft;
  const submitButton = useRef<HTMLButtonElement>(null);
  const leavePrompt = useRef<HTMLDivElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const category = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    onGuardChange(draft.dirty, draft.busy || confirming);
  }, [draft.dirty, draft.busy, confirming, onGuardChange]);
  useEffect(() => {
    if (navigation.pending && !confirming) {
      leavePrompt.current?.focus({ preventScroll: true });
    }
  }, [navigation.pending, confirming]);

  const { step, items } = detail;
  const ids = items.map((item) => item.id);
  const local = validateBallot(step, ids, entries);
  const categoryUnavailable =
    Boolean(draft.serverIssue) ||
    local.issues.some((issue) =>
      ['VOTING_UNAVAILABLE', 'CONFIGURATION_NOT_READY'].includes(issue),
    );
  const closed =
    categoryUnavailable ||
    (draft.remote ?? draft.saved)?.status === 'cancelled';
  useLayoutEffect(() => {
    onAvailabilityChange(step.id, closed);
  }, [onAvailabilityChange, step.id, closed]);
  const submitted = draft.saved?.status === 'submitted';
  const readOnly = Boolean(draft.saved && draft.saved.status !== 'draft');
  const unavailable =
    categoryUnavailable ||
    readOnly ||
    Boolean(draft.remote && draft.remote.status !== 'draft');
  const issues = [
    ...new Set([
      ...local.issues,
      ...(draft.serverIssue ? [draft.serverIssue] : []),
    ]),
  ];
  const votesDisabled = confirming || draft.busy || unavailable;
  const cannotSubmit = votesDisabled || !local.valid || draft.needsComparison;
  const cannotSave =
    closed || confirming || draft.busy || !local.valid || draft.needsComparison;

  function toggle(itemId: string, value: 1 | -1) {
    const result = toggleVote(step, ids, entries, itemId, value);
    const after = validateBallot(step, ids, result.entries);
    if (
      after.minusUsed - after.minusEntitlement >
      Math.max(0, local.minusUsed - local.minusEntitlement)
    ) {
      setBlocked('NEGATIVE_ELIGIBILITY');
      return;
    }
    if (result.blocked) {
      setBlocked(result.blocked);
      return;
    }
    setEntries(result.entries);
    setBlocked(undefined);
  }

  function teamKeys(event: KeyboardEvent<HTMLOListElement>) {
    if (
      !window.matchMedia('(min-width: 1024px)').matches ||
      votesDisabled ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      !(event.target instanceof HTMLButtonElement)
    ) {
      return;
    }
    const row = event.target.closest('li');
    const id = row?.dataset.itemId;
    if (!row || !id) {
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const adjacent =
        event.key === 'ArrowUp'
          ? row.previousElementSibling
          : row.nextElementSibling;
      adjacent
        ?.querySelector<HTMLButtonElement>('button[data-sign="plus"]')
        ?.focus();
    } else if (event.key === '+' || event.key === '-' || event.key === '−') {
      const sign = event.key === '+' ? 1 : -1;
      if (sign === 1 || step.allowNegativeVotes) {
        event.preventDefault();
        if (!event.repeat) {
          toggle(id, sign);
        }
      }
    }
  }

  async function save() {
    const result = await draft.save();
    if (!result || result === 'conflict') {
      return false;
    }
    onSaved(result);
    return true;
  }

  let status = 'Zatím neuloženo';
  let saveState = 'new';
  const time = draft.saved ? savedTime(draft.saved) : undefined;
  if (submitted) {
    status = 'Odevzdáno · uzamčeno';
    saveState = 'submitted';
  } else if (draft.dirty) {
    status = 'Neuložené změny';
    saveState = 'dirty';
  } else if (time) {
    status = `Návrh uložen · ${time}`;
    saveState = 'saved';
  }
  let nextLabel = 'Další →';
  let desktopNextLabel = 'Další kategorie →';
  if (lastCategory) {
    nextLabel = 'Souhrn →';
    desktopNextLabel = nextLabel;
  }
  if (draft.dirty) {
    nextLabel = lastCategory ? 'Uložit a souhrn' : 'Uložit a další';
    desktopNextLabel = lastCategory ? nextLabel : 'Uložit a další kategorie →';
  }

  const pendingPrompt = navigation.pending && (
    <div
      ref={leavePrompt}
      tabIndex={-1}
      role="region"
      aria-label="Neuložené změny"
      className="wizard-leave-prompt"
    >
      <p>Máte neuložené změny v této kategorii.</p>
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={draft.busy}
          onClick={() => {
            setEntries(draft.saved?.entries ?? []);
            navigation.followPending();
          }}
        >
          Zahodit
        </Button>
        <Button
          type="button"
          disabled={cannotSave || readOnly}
          onClick={async () => {
            if (!draft.dirty || (await save())) {
              navigation.followPending();
            }
          }}
        >
          Uložit a přejít
        </Button>
      </div>
    </div>
  );
  useLayoutEffect(() => {
    const footer = actions.current;
    const container = category.current;
    if (!footer || !container) {
      return;
    }
    const observer = new ResizeObserver(() => {
      container.style.setProperty(
        '--wizard-actions-height',
        `${footer.offsetHeight}px`,
      );
    });
    observer.observe(footer);
    return () => observer.disconnect();
  }, [closed]);
  const persistence = (
    <DraftPersistence
      draft={draft}
      items={items}
      unavailable={closed}
      interactionDisabled={confirming}
    />
  );

  return (
    <div ref={category} className="wizard-voting" data-closed={closed}>
      <header className="wizard-category-heading">
        <p className="wizard-eyebrow">
          {step.kind === 'selection' ? 'Výběrové kolo' : 'Finále'} ·{' '}
          {placesLabel(step)} · kategorie {categoryNumber} z {categoryCount}
        </p>
        <h1 ref={headingRef} tabIndex={-1} id="category-title">
          {step.name}
        </h1>
        {step.instructions && <Instructions text={step.instructions} />}
      </header>

      {closed ? (
        <div className="wizard-closed-content">
          <ClosedCategory
            items={items}
            ballot={draft.remote ?? draft.saved}
            next={nextAvailable}
            dirty={draft.dirty}
            onRefresh={onRefresh}
            refreshing={refreshing}
          />
          {pendingPrompt}
          {persistence}
        </div>
      ) : (
        <>
          <section className="wizard-teams" aria-label="Týmy">
            {submitted && (
              <p className="wizard-locked" role="status">
                <LockIcon /> Odevzdáno a uzamčeno. Úpravy může povolit jen
                organizátor.
              </p>
            )}
            <div aria-live="polite" aria-atomic="true">
              {issues.length > 0 && (
                <div className="feedback-error mb-3">
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
            </div>
            {persistence}
            {readOnly && (
              <Button
                variant="outline"
                className="my-3 min-h-11"
                onClick={onRefresh}
                disabled={refreshing}
              >
                Obnovit stav lístku
              </Button>
            )}
            {items.length ? (
              <ol
                className="wizard-team-list"
                role="list"
                aria-label="Soutěžní týmy"
                onKeyDown={teamKeys}
              >
                {items.map((item, index) => {
                  const value = entries.find(
                    (entry) => entry.votingItemId === item.id,
                  )?.voteValue;
                  const signs = step.allowNegativeVotes
                    ? ([1, -1] as const)
                    : ([1] as const);
                  return (
                    <li
                      key={item.id}
                      data-item-id={item.id}
                      data-vote={value}
                      className="wizard-team"
                    >
                      <span className="wizard-team-index" aria-hidden="true">
                        {index + 1}
                      </span>
                      <div className="wizard-team-copy">
                        <p>{item.name}</p>
                        {item.description && <p>{item.description}</p>}
                      </div>
                      <div className="wizard-team-actions">
                        {signs.map((sign) => (
                          <button
                            key={sign}
                            type="button"
                            className="wizard-sign"
                            data-sign={sign === 1 ? 'plus' : 'minus'}
                            aria-label={`${sign === 1 ? 'Kladný' : 'Záporný'} hlas: ${item.name}`}
                            aria-pressed={value === sign}
                            disabled={votesDisabled}
                            onClick={() => toggle(item.id, sign)}
                          >
                            {sign === 1 ? '+' : '−'}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="py-8 text-muted-foreground">
                V této kategorii zatím nejsou žádné týmy. Obraťte se na
                organizátora.
              </p>
            )}
          </section>

          <aside className="wizard-side" aria-label="Vaše hlasy">
            <VoteBudget step={step} local={local} teamCount={items.length} />
            <p className="wizard-blocked" role="status" hidden={!blocked}>
              {blocked ? (blockedMessages[blocked] ?? messages[blocked]) : null}
            </p>
            <div ref={actions} className="wizard-actions">
              {pendingPrompt}
              <div className="wizard-save-row" data-state={saveState}>
                <p role="status">{status}</p>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      cannotSave || (Boolean(draft.saved) && !draft.dirty)
                    }
                    onClick={() => void save()}
                  >
                    {draft.busy && !confirming ? 'Ukládáme…' : 'Uložit návrh'}
                  </Button>
                )}
              </div>
              {time && !readOnly && (
                <p className="wizard-last-saved">
                  Naposledy uloženo {time}. Uložený návrh se nezapočítává, dokud
                  kategorii neodevzdáte.
                </p>
              )}
              <div className="wizard-action-row">
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    confirming ||
                    draft.busy ||
                    (draft.dirty && (cannotSave || unavailable))
                  }
                  onClick={async () => {
                    if (!draft.dirty || (await save())) {
                      navigation.navigate(nextHref, true);
                    }
                  }}
                >
                  <span className="wizard-next-phone">{nextLabel}</span>
                  <span className="wizard-next-desktop">
                    {desktopNextLabel}
                  </span>
                </Button>
                {!readOnly && (
                  <Button
                    ref={submitButton}
                    type="button"
                    disabled={cannotSubmit}
                    onClick={() => setConfirming(true)}
                  >
                    Odevzdat kategorii
                  </Button>
                )}
              </div>
              <p className="wizard-key-hint">
                Klávesy: šipky ↑ ↓ mezi týmy, + a − pro hlas.
              </p>
            </div>
          </aside>
        </>
      )}

      {confirming && !readOnly && (
        <BallotSubmission
          detail={detail}
          draft={draft}
          local={local}
          unavailable={unavailable}
          onCancel={() => {
            setConfirming(false);
            requestAnimationFrame(() => submitButton.current?.focus());
          }}
          onConflict={() => setConfirming(false)}
          onSubmitted={(ballot) => {
            setConfirming(false);
            onSubmitted(ballot);
          }}
        />
      )}
    </div>
  );
}
