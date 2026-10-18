import { useEffect, useRef } from 'react';
import type { WizardStepDetail } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import type { useBallotDraft } from './useBallotDraft';

export function DraftPersistence({
  draft,
  items,
  unavailable,
  onRefresh,
  refreshing,
  interactionDisabled,
}: {
  draft: ReturnType<typeof useBallotDraft>;
  items: WizardStepDetail['items'];
  unavailable: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  interactionDisabled: boolean;
}) {
  const readOnly = draft.saved && draft.saved.status !== 'draft';
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (draft.message) feedback.current?.focus();
  }, [draft.message]);
  async function perform(action: () => unknown | Promise<unknown>) {
    await action();
    window.setTimeout(() => feedback.current?.focus(), 0);
  }
  return (
    <section
      className="mt-6 border border-border bg-card p-4 sm:p-6"
      aria-label="Uložení návrhu"
    >
      <h2 className="text-lg font-semibold">
        {draft.saved?.status === 'submitted'
          ? 'Odevzdané hlasování'
          : 'Rozpracované hlasování'}
      </h2>
      <p
        className="mt-2 text-sm leading-relaxed text-muted-foreground"
        role="status"
      >
        {readOnly
          ? draft.saved?.status === 'submitted'
            ? 'Hlasy v této kategorii byly odevzdány a jsou uzamčené. Úpravy může povolit pouze administrátor.'
            : 'Tento hlasovací lístek nelze upravovat.'
          : draft.dirty
            ? 'Máte neuložené změny.'
            : draft.saved
              ? 'Zobrazený výběr je uložený.'
              : 'V této kategorii zatím nemáte uložený návrh.'}
        {draft.saved &&
          ` Naposledy uloženo ${new Date(draft.saved.savedAt).toLocaleString('cs-CZ')}.`}
      </p>
      {!readOnly && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Uložený návrh obnovíte i po návratu z jiného zařízení. Uložit lze také
          neplatný nebo prázdný výběr. Uložení není odevzdání. Před odchodem
          změny uložte.
        </p>
      )}
      {draft.saved?.submittedAt && (
        <p className="mt-3 text-sm" role="status">
          Odevzdáno {new Date(draft.saved.submittedAt).toLocaleString('cs-CZ')}.
          Ostatní kategorie můžete dokončit později.
        </p>
      )}
      {readOnly && !unavailable && (
        <Button
          variant="outline"
          className="mt-4 min-h-11"
          onClick={onRefresh}
          disabled={refreshing}
        >
          Obnovit stav lístku
        </Button>
      )}
      {draft.needsComparison && (
        <div
          className="mt-4 border-l-2 border-destructive pl-4"
          role="region"
          aria-label="Porovnání změn"
        >
          <h3 className="font-semibold">Uložený hlasovací lístek byl změněn</h3>
          <p className="mt-2 text-sm leading-relaxed" role="status">
            Váš výběr zůstává zachovaný. Porovnejte obě verze před dalším
            uložením.
          </p>
          {draft.remote && (
            <>
              {draft.remote.status !== 'draft' && (
                <p className="mt-3 font-medium">
                  Uložený lístek je{' '}
                  {draft.remote.status === 'submitted'
                    ? 'již odevzdaný'
                    : 'uzamčený'}{' '}
                  a nelze jej upravovat.
                </p>
              )}
              <table className="mt-4 w-full table-fixed text-left text-sm">
                <caption className="sr-only">
                  Váš výběr a novější uložený návrh
                </caption>
                <thead>
                  <tr>
                    <th className="w-1/2 py-2">Tým</th>
                    <th className="px-1 py-2">Váš</th>
                    <th className="px-1 py-2">Uložený</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .filter((item) =>
                      [...draft.entries, ...draft.remote!.entries].some(
                        (entry) => entry.votingItemId === item.id,
                      ),
                    )
                    .map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <th
                          scope="row"
                          className="break-words py-2 pr-2 font-normal"
                        >
                          {item.name}
                        </th>
                        {[draft.entries, draft.remote!.entries].map(
                          (entries, i) => (
                            <td key={i} className="px-1 py-2">
                              {entries.find(
                                (entry) => entry.votingItemId === item.id,
                              )?.voteValue === 1
                                ? '+'
                                : entries.find(
                                      (entry) => entry.votingItemId === item.id,
                                    )?.voteValue === -1
                                  ? '−'
                                  : 'Žádný'}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
              {!draft.entries.length && !draft.remote.entries.length && (
                <p className="mt-2 text-sm">Obě verze jsou prázdné.</p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="h-auto min-h-11 whitespace-normal text-left"
                  disabled={draft.busy || interactionDisabled}
                  onClick={() => perform(() => draft.resolve(false))}
                >
                  Zahodit místní změny a načíst uložené
                </Button>
                {draft.remote.status === 'draft' && (
                  <Button
                    variant="outline"
                    className="h-auto min-h-11 whitespace-normal text-left"
                    disabled={draft.busy || interactionDisabled || unavailable}
                    onClick={() => perform(() => draft.resolve(true))}
                  >
                    Ponechat můj výběr pro další uložení
                  </Button>
                )}
              </div>
            </>
          )}
          <Button
            variant="ghost"
            className="mt-3 min-h-11"
            disabled={draft.busy || interactionDisabled}
            onClick={() => perform(draft.refresh)}
          >
            {draft.busy ? 'Načítáme…' : 'Obnovit porovnání'}
          </Button>
        </div>
      )}
      {!readOnly && (
        <Button
          className="mt-4 min-h-11"
          onClick={() => perform(draft.save)}
          disabled={
            draft.busy ||
            interactionDisabled ||
            unavailable ||
            draft.needsComparison ||
            (Boolean(draft.saved) && !draft.dirty)
          }
        >
          {draft.busy ? 'Čekáme na server…' : 'Uložit návrh'}
        </Button>
      )}
      {unavailable && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Ukládání je dostupné pouze v otevřené a připravené kategorii. Pro
            pokračování požádejte organizátora o otevření a poté obnovte
            dostupnost. Váš místní výběr zůstane zachovaný.
          </p>
          <Button
            variant="outline"
            className="mt-3 min-h-11"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Ověřujeme dostupnost…' : 'Obnovit dostupnost'}
          </Button>
        </div>
      )}
      <p
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
