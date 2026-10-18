import type { WizardReviewCategory } from '@d21/contracts';
import { messages } from './ballotMessages';
import { canSubmit } from './useReviewSubmission';

const formatTime = (value: string) => new Date(value).toLocaleString('cs-CZ');
const categoryUrl = (id: string) => `/wizard/steps/${id}`;
function stateText(category: WizardReviewCategory) {
  if (category.ballot?.status === 'submitted') return 'Odevzdáno · uzamčeno';
  if (category.ballot?.status === 'cancelled') return 'Uzamčeno';
  if (category.step.status !== 'active') return 'Nedostupné · čeká na otevření';
  if (!category.ballot) return 'Bez uloženého návrhu';
  return category.ballot.validation.valid
    ? 'Platný uložený návrh'
    : 'Neplatný návrh · vyžaduje opravu';
}

function Choices({ category }: { category: WizardReviewCategory }) {
  if (!category.ballot)
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        {category.step.status === 'active'
          ? 'Žádný uložený výběr. Nejdříve otevřete kategorii a uložte návrh.'
          : 'Žádný uložený výběr. Pokračovat můžete po otevření kategorie organizátorem.'}
      </p>
    );
  return (
    <>
      {!category.ballot.entries.length && (
        <p className="mt-4 font-medium">
          {category.ballot.status === 'submitted'
            ? 'Prázdný odevzdaný lístek'
            : 'Prázdný uložený návrh'}{' '}
          · 0 kladných a 0 záporných hlasů
        </p>
      )}
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {([1, -1] as const).map((sign) => {
          const entries = category.ballot!.entries.filter(
            (entry) => entry.voteValue === sign,
          );
          return (
            <div key={sign}>
              <h3 className="text-sm font-semibold">
                {sign === 1 ? '+ Kladné' : '− Záporné'} hlasy ({entries.length})
              </h3>
              {entries.length ? (
                <ul className="mt-2 space-y-2">
                  {entries.map((entry) => {
                    const item = category.items.find(
                      (item) => item.id === entry.votingItemId,
                    );
                    return (
                      <li className="break-words" key={entry.votingItemId}>
                        {item?.name ?? 'Nedostupný tým'}{' '}
                        <span className="block font-mono text-xs text-muted-foreground">
                          Položka{' '}
                          {category.items.findIndex(
                            (item) => item.id === entry.votingItemId,
                          ) + 1}{' '}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Žádné</p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Uloženo {formatTime(category.ballot.savedAt)} · verze{' '}
        {category.ballot.revision}
      </p>
      <p className="mt-2 text-sm">
        {category.ballot.validation.valid
          ? 'Výběr splňuje aktuální pravidla.'
          : 'Aktuální kontrola:'}
      </p>
      {category.ballot.validation.issues.length > 0 && (
        <ul className="mt-2 space-y-2 text-sm">
          {category.ballot.validation.issues.map((issue) => (
            <li key={issue}>{messages[issue]}</li>
          ))}
        </ul>
      )}
    </>
  );
}

export function ReviewCategoryCard({
  category,
  index,
  count,
  confirmation,
  selected,
  disabled,
  onToggle,
}: {
  category: WizardReviewCategory;
  index: number;
  count: number;
  confirmation: boolean;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="min-w-0 border border-border bg-card p-5 sm:p-6">
      <p className="eyebrow">
        {index + 1} / {count} ·{' '}
        {category.step.kind === 'selection'
          ? 'Výběrové kolo'
          : 'Finálová kategorie'}
      </p>
      <h2 className="mt-2 break-words text-xl font-semibold">
        {category.step.name}
      </h2>
      <p className="mt-2 font-medium">{stateText(category)}</p>
      {category.ballot?.submittedAt && (
        <p className="mt-2 text-sm">
          Odevzdáno {formatTime(category.ballot.submittedAt)}
        </p>
      )}
      {!confirmation && <Choices category={category} />}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <a className="wizard-link" href={categoryUrl(category.step.id)}>
          {canSubmit(category) ||
          (category.step.status === 'active' &&
            (!category.ballot || category.ballot.status === 'draft'))
            ? 'Vrátit se k úpravě'
            : 'Zobrazit kategorii'}
        </a>
        {!confirmation && canSubmit(category) && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 p-2 font-medium">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={selected}
              disabled={disabled}
              onChange={onToggle}
              aria-label={`Odevzdat kategorii ${category.step.name}`}
            />
            Vybrat k odevzdání
            {!category.ballot!.entries.length && ' (prázdný návrh)'}
          </label>
        )}
      </div>
    </li>
  );
}
