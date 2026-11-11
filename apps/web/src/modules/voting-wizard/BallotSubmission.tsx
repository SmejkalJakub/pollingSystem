import { useEffect, useRef } from 'react';
import type {
  BallotDraft,
  BallotValidation,
  WizardStepDetail,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import type { useBallotDraft } from './useBallotDraft';
import { WizardSheet } from './WizardSheet';

function voteCount(count: number, sign: 'kladn' | 'záporn') {
  if (count === 1) {
    return { count: `1 ${sign}ý`, noun: 'hlas' };
  }
  if (count >= 2 && count <= 4) {
    return { count: `${count} ${sign}é`, noun: 'hlasy' };
  }
  return { count: `${count} ${sign}ých`, noun: 'hlasů' };
}

function unusedVotes(plus: number, minus: number) {
  if (plus && minus) {
    const positive = voteCount(plus, 'kladn');
    const negative = voteCount(minus, 'záporn');
    return `${positive.count} a ${negative.count} ${negative.noun}`;
  }
  const part = plus ? voteCount(plus, 'kladn') : voteCount(minus, 'záporn');
  return `${part.count} ${part.noun}`;
}

export function BallotSubmission({
  detail,
  draft,
  local,
  unavailable,
  onCancel,
  onConflict,
  onSubmitted,
}: {
  detail: WizardStepDetail;
  draft: ReturnType<typeof useBallotDraft>;
  local: BallotValidation;
  unavailable: boolean;
  onCancel: () => void;
  onConflict: () => void;
  onSubmitted: (ballot: BallotDraft) => void;
}) {
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (draft.message) {
      feedback.current?.focus();
    }
  }, [draft.message]);

  const { step, items } = detail;
  const plus = Math.max(0, (step.maxPlusVotes ?? 0) - local.plusUsed);
  const minus = step.allowNegativeVotes
    ? Math.max(0, (step.maxMinusVotes ?? 0) - local.minusUsed)
    : 0;
  const entries = new Map(
    draft.entries.map((entry) => [entry.votingItemId, entry.voteValue]),
  );
  const votes = ([1, -1] as const).flatMap((value) =>
    items
      .filter((item) => entries.get(item.id) === value)
      .map((item) => ({ ...item, value })),
  );
  const disabled =
    unavailable || !local.valid || draft.needsComparison || draft.busy;

  return (
    <WizardSheet
      title={`Odevzdat „${step.name}“?`}
      busy={draft.busy}
      onCancel={onCancel}
    >
      <div className="wizard-sheet-totals">
        <div data-sign="plus">
          <p>Kladné</p>
          <strong>
            {local.plusUsed} <span>z {step.maxPlusVotes}</span>
          </strong>
        </div>
        {step.allowNegativeVotes && (
          <div data-sign="minus">
            <p>Záporné</p>
            <strong>
              {local.minusUsed} <span>z {step.maxMinusVotes}</span>
            </strong>
          </div>
        )}
      </div>
      <ul className="wizard-sheet-votes">
        {votes.length === 0 && <li>Prázdný lístek — žádný hlas</li>}
        {votes.map((vote) => (
          <li key={vote.id}>
            <span data-sign={vote.value === 1 ? 'plus' : 'minus'}>
              {vote.value === 1 ? '+' : '−'}
            </span>
            {vote.name}
          </li>
        ))}
      </ul>
      {(plus > 0 || minus > 0) && (
        <p className="wizard-sheet-note">
          Nevyužito {unusedVotes(plus, minus)}. To je v pořádku — hlasy nemusíte
          využít všechny.
        </p>
      )}
      {!local.valid && (
        <p className="text-sm text-destructive">
          Před odevzdáním opravte chyby výběru.
        </p>
      )}
      {draft.message && (
        <p
          ref={feedback}
          tabIndex={-1}
          role="status"
          className="wizard-sheet-note"
        >
          {draft.message}
        </p>
      )}
      <div className="wizard-sheet-actions">
        <Button
          variant="outline"
          type="button"
          disabled={draft.busy}
          onClick={onCancel}
        >
          Zpět k úpravám
        </Button>
        <Button
          type="button"
          disabled={disabled}
          onClick={async () => {
            const result = await draft.submit();
            if (result === 'conflict') {
              onConflict();
            } else if (result?.status === 'submitted') {
              onSubmitted(result);
            }
          }}
        >
          {draft.busy ? 'Odevzdáváme…' : 'Potvrdit odevzdání'}
        </Button>
      </div>
    </WizardSheet>
  );
}
