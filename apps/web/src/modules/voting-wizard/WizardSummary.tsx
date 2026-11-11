import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type {
  BallotDraft,
  WizardFinalSubmit,
  WizardReview,
  WizardReviewCategory,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { czechCount } from '@/lib/plural';
import { messages } from './ballotMessages';
import { canSubmit, useReviewSubmission } from './useReviewSubmission';
import { stepPath } from './useWizardNavigation';
import { WizardSheet } from './WizardSheet';

const rejectionText: Record<string, string> = {
  DRAFT_CONFLICT:
    'Uložená verze se změnila. Porovnejte ji s rekapitulací a vyberte znovu.',
  BALLOT_NOT_EDITABLE:
    'Stav lístku se změnil. Ověřte aktuální odevzdání nebo odemčení.',
  VOTING_UNAVAILABLE:
    'Kategorie byla uzavřena. Návrh zůstává uložený pro pozdější návrat.',
  INVALID_BALLOT: 'Návrh nesplňuje aktuální pravidla. Vraťte se k opravě.',
  CONFIGURATION_NOT_READY:
    'Kategorie není připravena. Obraťte se na organizátora.',
  NOT_FOUND: 'Kategorie nyní není dostupná vašemu přístupu.',
  REVISION_EXHAUSTED:
    'Tento návrh již nelze odevzdat. Obraťte se na organizátora.',
};

const categoryForms = {
  one: 'kategorii',
  few: 'kategorie',
  other: 'kategorií',
};
const plusForms = { one: 'kladný', few: 'kladné', other: 'kladných' };
const minusForms = { one: 'záporný', few: 'záporné', other: 'záporných' };

const changedNotice =
  'Uložené hlasy nebo dostupnost kategorií se změnily. Než vyberete odevzdání, načtěte a zkontrolujte aktuální přehled. Výběr kategorií se vymaže.';

const submittedTime = new Intl.DateTimeFormat('cs-CZ', {
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function statusFor(category: WizardReviewCategory) {
  const { ballot, step } = category;
  if (ballot?.status === 'submitted') {
    const time = ballot.submittedAt
      ? ` ${submittedTime.format(new Date(ballot.submittedAt)).replace(', ', ' ')}`
      : '';
    return {
      tone: 'submitted',
      text: `Odevzdáno${time} · uzamčeno`,
      action: 'Zobrazit hlasy',
    };
  }
  if (ballot?.status === 'cancelled') {
    return { tone: 'default', text: 'Uzamčeno', action: 'Zobrazit hlasy' };
  }
  if (step.status !== 'active') {
    return {
      tone: 'default',
      text: 'Nedostupné · čeká na otevření',
      action: 'Zobrazit hlasy',
    };
  }
  if (ballot && !ballot.validation.valid) {
    const [issue] = ballot.validation.issues;
    return {
      tone: 'invalid',
      text: issue ? messages[issue] : rejectionText.INVALID_BALLOT,
      action: 'Opravit hlasy',
    };
  }
  if (canSubmit(category)) {
    return {
      tone: 'ready',
      text: 'Připraveno k odevzdání',
      action: 'Upravit hlasy',
    };
  }
  if (ballot) {
    return {
      tone: 'ready',
      text: 'Rozpracováno · návrh uložen',
      action: 'Upravit hlasy',
    };
  }
  return { tone: 'default', text: 'Zatím bez hlasů', action: 'Upravit hlasy' };
}

function SummaryCard({
  category,
  selected,
  disabled,
  onToggle,
}: {
  category: WizardReviewCategory;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { step, ballot, items } = category;
  const { text, tone, action } = statusFor(category);
  const titleId = `summary-category-${step.id}`;
  const names = new Map(items.map((item) => [item.id, item.name]));
  const votes =
    ballot?.entries.map(
      (entry) =>
        `${entry.voteValue === 1 ? '+' : '−'} ${names.get(entry.votingItemId) ?? 'Nedostupný tým'}`,
    ) ?? [];

  return (
    <li
      className="wizard-summary-card"
      data-tone={tone}
      data-selected={selected}
    >
      <div className="wizard-summary-card-head">
        <div>
          <h2 id={titleId}>{step.name}</h2>
          <p className="wizard-summary-status">{text}</p>
        </div>
        {canSubmit(category) && (
          <label className="wizard-summary-select">
            <input
              type="checkbox"
              checked={selected}
              disabled={disabled}
              onChange={onToggle}
              aria-label={`Odevzdat kategorii ${step.name}`}
            />
            Odevzdat
          </label>
        )}
      </div>
      {ballot && (
        <p className="wizard-summary-votes">
          {votes.join(' · ') || 'Prázdný lístek'}
        </p>
      )}
      <a
        className="wizard-summary-link"
        href={stepPath(step.id)}
        aria-describedby={titleId}
      >
        {action}
      </a>
    </li>
  );
}

export function WizardSummary({
  review,
  submittedBallots,
  onResult,
  headingRef,
  onAccessError,
  onRefresh,
  refreshing,
  onPendingChange,
}: {
  review: WizardReview;
  submittedBallots: ReadonlyMap<string, BallotDraft>;
  onResult: (review: WizardReview, result: WizardFinalSubmit) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAccessError: (error: unknown) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onPendingChange: (value: boolean) => void;
}) {
  const flow = useReviewSubmission(review, onAccessError);
  const { result, uncertain, busy, attempt } = flow;
  const opener = useRef<HTMLButtonElement>(null);
  const outcomes = useRef<HTMLDivElement>(null);
  const errorFeedback = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    onPendingChange(busy || Boolean(attempt));
    return () => onPendingChange(false);
  }, [busy, attempt, onPendingChange]);
  useEffect(() => {
    if (result) {
      outcomes.current?.focus();
    }
  }, [result]);
  useEffect(() => {
    if (uncertain) {
      errorFeedback.current?.focus();
    }
  }, [uncertain]);
  useEffect(() => {
    if (!busy) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const currentById = new Map(
    review.categories.map((category) => [category.step.id, category]),
  );
  const accepted = new Map(submittedBallots);
  for (const outcome of result?.results ?? []) {
    if (outcome.outcome === 'submitted') {
      const current = currentById.get(outcome.stepId)?.ballot;
      if (current && current.revision <= outcome.ballot.revision) {
        accepted.set(outcome.stepId, outcome.ballot);
      }
    }
  }
  const cards = flow.displayed.categories.flatMap((category) => {
    const current = currentById.get(category.step.id);
    if (!current) {
      return [];
    }
    const ballot = accepted.get(category.step.id);
    if (ballot) {
      return [{ ...category, ballot }];
    }
    if (current.ballot?.status === 'submitted') {
      return [current];
    }
    return [category];
  });
  const submitted = review.categories.filter(
    ({ step, ballot }) =>
      accepted.has(step.id) || ballot?.status === 'submitted',
  ).length;
  const total = review.categories.length;
  const progressText =
    total > 0 && submitted === total
      ? 'Všechny kategorie jsou odevzdané.'
      : `Odevzdány ${submitted} z ${total} kategorií. Zbývající můžete dokončit později.`;
  const selectionCount = flow.chosen.length;
  const actionLabel = selectionCount
    ? `Odevzdat vybrané (${selectionCount})`
    : 'Vyberte kategorie k odevzdání';
  let confirmLabel = 'Potvrdit odevzdání';
  if (busy) {
    confirmLabel = 'Odevzdáváme…';
  } else if (uncertain) {
    confirmLabel = 'Zopakovat stejné odevzdání';
  }

  function cancel() {
    flow.cancel();
    requestAnimationFrame(() => {
      if (opener.current && !opener.current.disabled) {
        opener.current.focus();
      } else {
        headingRef.current?.focus();
      }
    });
  }

  // Accumulate completed categories in the same reviewed snapshot so another
  // batch can be selected before a refresh without losing confirmed progress.
  const lastReported = useRef<WizardFinalSubmit>(null);
  useEffect(() => {
    if (result && lastReported.current !== result) {
      lastReported.current = result;
      onResult(review, result);
      if (result.results.some((outcome) => outcome.outcome === 'rejected')) {
        onRefresh();
      }
    }
  }, [onRefresh, onResult, result, review]);

  return (
    <section
      className="wizard-summary"
      aria-labelledby="wizard-summary-title"
      aria-busy={refreshing}
    >
      <div className="wizard-summary-heading">
        <h1 id="wizard-summary-title" ref={headingRef} tabIndex={-1}>
          Souhrn hlasování
        </h1>
        <progress
          max={total || 1}
          value={submitted}
          aria-label={`Odevzdány ${submitted} z ${total} kategorií`}
        />
        <p>{progressText}</p>
      </div>
      <div className="wizard-summary-body">
        {result && (
          <div
            ref={outcomes}
            tabIndex={-1}
            role="status"
            className="wizard-summary-feedback"
          >
            <h2>Výsledek potvrzeného odevzdání</h2>
            <p>
              Potvrzeno:{' '}
              {
                result.results.filter((item) => item.outcome === 'submitted')
                  .length
              }{' '}
              z {result.results.length} vybraných kategorií.
            </p>
            <ul>
              {result.results.map((item) => {
                let name =
                  currentById.get(item.stepId)?.step.name ??
                  'Nedostupná kategorie';
                let outcome: string;
                if (item.outcome === 'submitted') {
                  const time = item.ballot.submittedAt;
                  outcome = time
                    ? `Odevzdáno ${new Date(time).toLocaleString('cs-CZ')}`
                    : 'Odevzdáno';
                } else {
                  if (item.status === 404) {
                    name = 'Nedostupná kategorie';
                  }
                  outcome =
                    rejectionText[item.code] ??
                    'Nepodařilo se odevzdat. Načtěte aktuální rekapitulaci a zkuste to znovu.';
                }
                return (
                  <li key={item.stepId}>
                    <strong>{name}</strong>
                    <p>{outcome}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {flow.changed && (
          <div role="status" className="wizard-summary-feedback">
            <p>
              Uložené hlasy nebo dostupnost kategorií se změnily. Než vyberete
              odevzdání, načtěte a zkontrolujte aktuální přehled. Výběr
              kategorií se vymaže.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                flow.loadCurrent();
                headingRef.current?.focus();
              }}
            >
              Načíst aktuální přehled
            </Button>
          </div>
        )}
        {!cards.length && (
          <p role="status" className="wizard-summary-feedback">
            Zatím nemáte žádné dostupné kategorie. Zkuste přehled později
            obnovit.
          </p>
        )}
        <ul
          className="wizard-summary-cards"
          role="list"
          aria-label="Uložené hlasy podle kategorií"
        >
          {cards.map((category) => (
            <SummaryCard
              key={category.step.id}
              category={category}
              selected={
                flow.selected.includes(category.step.id) && canSubmit(category)
              }
              disabled={busy || Boolean(attempt) || flow.changed || refreshing}
              onToggle={() => flow.toggle(category.step.id)}
            />
          ))}
        </ul>
        <Button
          type="button"
          className="wizard-summary-refresh"
          variant="outline"
          disabled={busy || refreshing}
          onClick={onRefresh}
        >
          {refreshing ? 'Ověřujeme…' : 'Ověřit aktuální stav'}
        </Button>
      </div>
      <footer className="wizard-summary-footer">
        <Button
          type="button"
          ref={opener}
          disabled={
            !selectionCount || flow.changed || refreshing || Boolean(attempt)
          }
          onClick={flow.confirm}
        >
          {actionLabel}
        </Button>
      </footer>
      {attempt && (
        <WizardSheet
          title={`Odevzdat ${czechCount(attempt.categories.length, categoryForms)}?`}
          busy={busy}
          onCancel={cancel}
        >
          <ul
            className="wizard-sheet-votes wizard-sheet-categories"
            role="list"
          >
            {attempt.categories.map(({ stepId, entries }) => {
              const category = currentById.get(stepId);
              if (!category) {
                return null;
              }
              const plus = entries.filter(
                (entry) => entry.voteValue === 1,
              ).length;
              return (
                <li key={stepId}>
                  <span aria-hidden="true">{plus}+</span>
                  {category.step.name} · {czechCount(plus, plusForms)},{' '}
                  {czechCount(entries.length - plus, minusForms)}
                </li>
              );
            })}
          </ul>
          {flow.changed && !uncertain && (
            <p className="wizard-sheet-note" role="status">
              {changedNotice}
            </p>
          )}
          {uncertain && (
            <div
              ref={errorFeedback}
              tabIndex={-1}
              role="alert"
              className="feedback-error mb-3"
            >
              <p className="feedback-error-title">
                Odevzdání se nepodařilo potvrdit
              </p>
              <p>{uncertain}</p>
              <p className="mt-2">
                Některé kategorie už mohou být odevzdané. Ověřte stav v
                aktuálním přehledu nebo zopakujte stejné odevzdání.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                disabled={refreshing}
                onClick={onRefresh}
              >
                {refreshing ? 'Ověřujeme…' : 'Ověřit aktuální stav'}
              </Button>
            </div>
          )}
          <div className="wizard-sheet-actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={cancel}
            >
              Zpět k úpravám
            </Button>
            <Button
              type="button"
              disabled={busy || (flow.changed && !uncertain)}
              onClick={() => void flow.submit()}
            >
              {confirmLabel}
            </Button>
          </div>
        </WizardSheet>
      )}
    </section>
  );
}
