import type { BallotValidation, WizardStep } from '@d21/contracts';

function Pips({
  max,
  used,
  unlocked,
  negative = false,
}: {
  max: number;
  used: number;
  unlocked?: number;
  negative?: boolean;
}) {
  return (
    <div className="wizard-pips" aria-hidden="true">
      {Array.from({ length: max }, (_, index) => {
        let state = 'empty';
        if (index < used) {
          state = negative ? 'negative' : 'positive';
        } else if (unlocked !== undefined) {
          state = index < unlocked ? 'available' : 'locked';
        }
        return <span key={index} data-pip={state} />;
      })}
    </div>
  );
}

function remainingMinus(count: number) {
  if (count === 1) {
    return '1 záporný';
  }
  if (count >= 2 && count <= 4) {
    return `${count} záporné`;
  }
  return `${count} záporných`;
}

export function VoteBudget({
  step,
  local,
  teamCount,
}: {
  step: WizardStep;
  local: BallotValidation;
  teamCount: number;
}) {
  let hint =
    'Záporné hlasy nejsou v této kategorii povoleny. Hlasy nemusíte využít všechny.';
  if (step.allowNegativeVotes) {
    hint = `Každý záporný hlas odemknou 2 kladné. Teď můžete dát ještě ${remainingMinus(local.minusRemaining)}.`;
    if (step.maxMinusVotes !== null && local.minusUsed >= step.maxMinusVotes) {
      hint = 'Záporné hlasy jsou vyčerpané. Hlasy nemusíte využít všechny.';
    }
  }
  return (
    <section className="wizard-budget" aria-label="Zbývající hlasy">
      <div className="wizard-budget-totals" role="status" aria-atomic="true">
        <div>
          <p>
            Kladné{' '}
            <strong>
              {local.plusUsed}/{step.maxPlusVotes ?? '—'}
            </strong>
          </p>
          <Pips
            max={Math.min(teamCount, step.maxPlusVotes ?? 0)}
            used={local.plusUsed}
          />
        </div>
        <div>
          <p>
            Záporné{' '}
            <strong>
              {step.allowNegativeVotes
                ? `${local.minusUsed}/${step.maxMinusVotes ?? '—'}`
                : 'nepovoleny'}
            </strong>
          </p>
          {step.allowNegativeVotes ? (
            <Pips
              max={Math.min(teamCount, step.maxMinusVotes ?? 0)}
              used={local.minusUsed}
              unlocked={local.minusEntitlement}
              negative
            />
          ) : (
            <div className="wizard-pips" aria-hidden="true">
              <span data-pip="disabled" />
            </div>
          )}
        </div>
        <p className="wizard-budget-hint">{hint}</p>
      </div>
    </section>
  );
}
