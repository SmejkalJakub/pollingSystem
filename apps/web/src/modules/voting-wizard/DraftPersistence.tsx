import { useEffect, useRef, useState } from 'react';
import type { WizardStepDetail } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import type { useBallotDraft } from './useBallotDraft';
import { WizardSheet } from './WizardSheet';

function VoteBadge({ value }: { value?: 1 | -1 }) {
  if (!value) {
    return <span className="wizard-comparison-none">žádný</span>;
  }
  return (
    <span className="wizard-comparison-sign" data-sign={value}>
      <span className="sr-only">
        {value === 1 ? 'Kladný hlas' : 'Záporný hlas'}
      </span>
      <span aria-hidden="true">{value === 1 ? '+' : '−'}</span>
    </span>
  );
}

export function DraftPersistence({
  draft,
  items,
  unavailable,
  interactionDisabled,
}: {
  draft: ReturnType<typeof useBallotDraft>;
  items: WizardStepDetail['items'];
  unavailable: boolean;
  interactionDisabled: boolean;
}) {
  const feedback = useRef<HTMLParagraphElement>(null);
  const reopen = useRef<HTMLButtonElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const comparisonNeeded = draft.needsComparison && !interactionDisabled;
  const comparing = comparisonNeeded && !dismissed;

  function dismiss() {
    setDismissed(true);
    requestAnimationFrame(() => reopen.current?.focus());
  }

  function resolve(keep: boolean) {
    setDismissed(false);
    draft.resolve(keep);
  }
  useEffect(() => {
    if (draft.message && !interactionDisabled && !comparisonNeeded) {
      feedback.current?.focus();
    }
  }, [draft.message, interactionDisabled, comparisonNeeded]);

  const remote = draft.remote;
  const localVotes = new Map(
    draft.entries.map((entry) => [entry.votingItemId, entry.voteValue]),
  );
  const remoteVotes = new Map(
    remote?.entries.map((entry) => [entry.votingItemId, entry.voteValue]),
  );
  const rows = items.filter(
    (item) => localVotes.has(item.id) || remoteVotes.has(item.id),
  );
  const canKeep = remote?.status === 'draft' && !unavailable;

  return (
    <section className="wizard-draft-feedback" aria-label="Uložení návrhu">
      {comparing && (
        <WizardSheet
          title="Hlasy se mezitím změnily"
          note="Uložený návrh byl upraven na jiném zařízení nebo v jiné záložce. Váš výběr zůstal zachovaný — vyberte, kterou verzi ponechat."
          busy={draft.busy}
          onCancel={dismiss}
        >
          {remote && (
            <>
              {remote.status !== 'draft' && (
                <p className="wizard-sheet-note">
                  Uložený lístek je{' '}
                  {remote.status === 'submitted' ? 'již odevzdaný' : 'uzamčený'}{' '}
                  a nelze jej upravovat.
                </p>
              )}
              {rows.length ? (
                <table className="wizard-comparison">
                  <caption className="sr-only">
                    Porovnání vašeho výběru a uložené verze
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Tým</th>
                      <th scope="col">Tady</th>
                      <th scope="col">Uloženo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => (
                      <tr
                        key={item.id}
                        data-different={
                          localVotes.get(item.id) !== remoteVotes.get(item.id)
                        }
                      >
                        <th scope="row">{item.name}</th>
                        <td>
                          <VoteBadge value={localVotes.get(item.id)} />
                        </td>
                        <td>
                          <VoteBadge value={remoteVotes.get(item.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="wizard-sheet-note">Obě verze jsou prázdné.</p>
              )}
              <div className="wizard-sheet-actions wizard-comparison-actions">
                {canKeep && (
                  <Button
                    type="button"
                    disabled={draft.busy}
                    onClick={() => resolve(true)}
                  >
                    Ponechat můj výběr
                  </Button>
                )}
                <Button
                  variant="outline"
                  type="button"
                  disabled={draft.busy}
                  onClick={() => resolve(false)}
                >
                  Načíst uloženou verzi
                </Button>
              </div>
              <p className="wizard-sheet-note mt-3">
                Rozdílné řádky jsou zvýrazněné.{' '}
                {canKeep &&
                  '„Ponechat můj výběr“ ho připraví k dalšímu uložení.'}
              </p>
            </>
          )}
          {!remote && !draft.busy && (
            <Button
              variant="outline"
              type="button"
              className="min-h-11"
              onClick={dismiss}
            >
              Zpět k výběru
            </Button>
          )}
          {draft.message && (
            <p className="wizard-sheet-note" role="status">
              {draft.message}
            </p>
          )}
          <Button
            variant="ghost"
            type="button"
            className="min-h-11"
            disabled={draft.busy}
            onClick={() => void draft.refresh()}
          >
            {draft.busy ? 'Načítáme…' : 'Obnovit porovnání'}
          </Button>
        </WizardSheet>
      )}
      {comparisonNeeded && dismissed && (
        <Button
          ref={reopen}
          variant="outline"
          type="button"
          className="min-h-11"
          onClick={() => setDismissed(false)}
        >
          Porovnat změny
        </Button>
      )}
      <p
        hidden={interactionDisabled || comparing || !draft.message}
        ref={feedback}
        tabIndex={-1}
        className="mt-3 scroll-mt-44 text-sm leading-relaxed outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        role="status"
      >
        {draft.message}
      </p>
    </section>
  );
}
