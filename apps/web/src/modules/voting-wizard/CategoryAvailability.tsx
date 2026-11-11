import type { BallotDraft, WizardStep, WizardStepDetail } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { stepPath } from './useWizardNavigation';

type RefreshProps = { onRefresh: () => void; refreshing: boolean };

export function LockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function RefreshButton({ onRefresh, refreshing }: RefreshProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onRefresh}
      disabled={refreshing}
    >
      {refreshing ? 'Ověřujeme dostupnost…' : 'Zkontrolovat znovu'}
    </Button>
  );
}

export function ClosedCategory({
  items,
  ballot,
  next,
  dirty,
  ...refresh
}: RefreshProps & {
  items: WizardStepDetail['items'];
  ballot: BallotDraft | null;
  next?: WizardStep;
  dirty: boolean;
}) {
  const votes = new Map(
    ballot?.entries.map((entry) => [entry.votingItemId, entry.voteValue]),
  );
  const voteLine = ([1, -1] as const)
    .flatMap((value) =>
      items
        .filter((item) => votes.get(item.id) === value)
        .map((item) => `${value === 1 ? '+' : '−'} ${item.name}`),
    )
    .join(' · ');

  return (
    <div className="wizard-availability">
      <section
        className="wizard-availability-card"
        aria-labelledby="category-closed"
      >
        <div className="wizard-lock-tile">
          <LockIcon />
        </div>
        <h2 id="category-closed">Hlasování v této kategorii je uzavřené</h2>
        <p>
          Hlasy teď nelze měnit ani odevzdat. Váš uložený návrh zůstává
          zachovaný, pokud organizátor kategorii znovu otevře.
        </p>
        {ballot?.status === 'draft' && (
          <p className="wizard-saved-vote-line">
            <strong>Uložený návrh:</strong>{' '}
            {voteLine || 'Prázdný lístek — žádný hlas'}
          </p>
        )}
        {ballot?.status === 'submitted' && (
          <p>Odevzdáno a uzamčeno. Úpravy může povolit jen organizátor.</p>
        )}
        {dirty && (
          <p role="status">Neuložené změny zůstávají na této stránce.</p>
        )}
        <RefreshButton {...refresh} />
      </section>
      {next && (
        <a className="wizard-continue" href={stepPath(next.id)}>
          <span>
            <span>Můžete pokračovat</span>
            {next.name}
          </span>
          <span aria-hidden="true">→</span>
        </a>
      )}
    </div>
  );
}

export function EmptyCategories({
  headingRef,
  ...refresh
}: RefreshProps & {
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="wizard-availability">
      <section
        className="wizard-availability-card wizard-availability-empty"
        aria-labelledby="categories-empty"
      >
        <h1 ref={headingRef} tabIndex={-1} id="categories-empty">
          Zatím žádné dostupné kategorie
        </h1>
        <p>
          Organizátor zatím neotevřel žádnou kategorii pro vaši porotu. Stránku
          můžete nechat otevřenou a později zkontrolovat znovu.
        </p>
        <RefreshButton {...refresh} />
      </section>
    </div>
  );
}
