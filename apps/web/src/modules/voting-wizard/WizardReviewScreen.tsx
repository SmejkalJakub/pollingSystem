import { useEffect, useRef, type RefObject } from 'react';
import type { WizardReview } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { ReviewCategoryCard } from './ReviewCategoryCard';
import { useReviewSubmission } from './useReviewSubmission';

const formatTime = (value: string) => new Date(value).toLocaleString('cs-CZ');
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

export function WizardReviewScreen({
  review,
  confirmationPage,
  headingRef,
  onAccessError,
  onRefresh,
  refreshing,
  onPendingChange,
}: {
  review: WizardReview;
  confirmationPage: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAccessError: (error: unknown) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onPendingChange: (value: boolean) => void;
}) {
  const flow = useReviewSubmission(review, onAccessError);
  const confirmation = confirmationPage || Boolean(flow.result);
  const confirmHeading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    onPendingChange(flow.busy);
  }, [flow.busy, onPendingChange]);
  useEffect(() => {
    if (flow.attempt) confirmHeading.current?.focus();
  }, [flow.attempt]);
  useEffect(() => {
    if (flow.result || flow.uncertain) feedback.current?.focus();
  }, [flow.result, flow.uncertain]);
  useEffect(() => {
    if (!flow.busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [flow.busy]);
  // Remove categories immediately when revalidation withdraws access. Other
  // saved versions still require explicit loading before selection changes.
  const categories = confirmation
    ? review.categories
    : flow.displayed.categories.filter((category) =>
        review.categories.some(
          (current) => current.step.id === category.step.id,
        ),
      );
  const submitted = categories.filter(
    (category) => category.ballot?.status === 'submitted',
  ).length;
  return (
    <section className="py-8 sm:py-12" aria-busy={flow.busy || refreshing}>
      <a className="wizard-link" href="/wizard">
        ← Všechny kategorie
      </a>
      <p className="eyebrow mt-6">
        {confirmation ? 'Stav vašich hlasů' : 'Před odevzdáním'}
      </p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-3 break-words text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
      >
        {confirmation ? 'Potvrzení hlasování' : 'Rekapitulace a odevzdání'}
      </h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
        {confirmation
          ? 'Každá kategorie se odevzdává samostatně. Zbývající návrhy můžete dokončit později; odevzdané hlasy může odemknout pouze administrátor.'
          : 'Zkontrolujte uložené kladné a záporné hlasy. Označte kategorie, které chcete odevzdat. Neuložené změny z jiných stránek zde nejsou. Ostatní kategorie můžete dokončit později.'}
      </p>
      {!flow.result && confirmation && (
        <p className="mt-4 font-medium" role="status">
          Aktuálně odevzdáno {submitted} z {categories.length} dostupných
          kategorií.
          {!categories.length && ' Organizátor zatím žádnou nezpřístupnil.'}
        </p>
      )}
      {flow.result && (
        <div
          ref={feedback}
          tabIndex={-1}
          role="status"
          className="mt-6 border border-border bg-card p-5 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <h2 className="text-xl font-semibold">
            Výsledek potvrzeného odevzdání
          </h2>
          <p className="mt-2">
            Potvrzeno:{' '}
            {
              flow.result.results.filter(
                (result) => result.outcome === 'submitted',
              ).length
            }{' '}
            z {flow.result.results.length} vybraných kategorií.
          </p>
          <ul className="mt-4 space-y-4">
            {flow.result.results.map((result) => (
              <li key={result.stepId} className="break-words">
                <strong>
                  {(result.outcome === 'rejected' && result.status === 404) ||
                  !review.categories.some(
                    (category) => category.step.id === result.stepId,
                  )
                    ? 'Nedostupná kategorie'
                    : (flow.displayed.categories.find(
                        (category) => category.step.id === result.stepId,
                      )?.step.name ?? 'Kategorie')}
                </strong>
                <p className="mt-1">
                  {result.outcome === 'submitted'
                    ? `Odevzdáno ${formatTime(result.ballot.submittedAt!)}`
                    : (rejectionText[result.code] ??
                      'Nepodařilo se odevzdat. Načtěte aktuální rekapitulaci a zkuste to znovu.')}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            Toto je výsledek této operace. Aktuální stav ověříte obnovením
            potvrzení.
          </p>
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {!flow.result && (
          <Button
            variant="outline"
            className="min-h-11 h-auto whitespace-normal"
            disabled={flow.busy || refreshing}
            onClick={onRefresh}
          >
            {refreshing ? 'Ověřujeme…' : 'Ověřit aktuální stav'}
          </Button>
        )}
        {confirmation && (
          <>
            <a className="wizard-link" href="/wizard/review">
              Zpět na rekapitulaci
            </a>
            <a className="wizard-link" href="/wizard/confirmation">
              Obnovit potvrzení
            </a>
          </>
        )}
      </div>
      {!confirmation && flow.changed && (
        <div
          role="status"
          className="mt-6 border-l-2 border-primary bg-card p-5"
        >
          <p>
            Uložené hlasy nebo dostupnost kategorií se změnily. Než vyberete
            odevzdání, načtěte a zkontrolujte aktuální přehled. Výběr kategorií
            se vymaže.
          </p>
          <Button
            variant="outline"
            className="mt-4 min-h-11 h-auto whitespace-normal"
            disabled={flow.busy}
            onClick={() => {
              flow.loadCurrent();
              headingRef.current?.focus();
            }}
          >
            Načíst aktuální přehled
          </Button>
        </div>
      )}
      {!categories.length && !confirmation && (
        <p role="status" className="mt-8">
          Zatím nemáte žádné dostupné kategorie. Zkuste přehled později obnovit.
        </p>
      )}
      {!flow.result && (
        <ol className="mt-8 space-y-6">
          {categories.map((category, index) => (
            <ReviewCategoryCard
              key={category.step.id}
              category={category}
              index={index}
              count={categories.length}
              confirmation={confirmation}
              selected={flow.selected.includes(category.step.id)}
              disabled={flow.busy || Boolean(flow.attempt) || flow.changed}
              onToggle={() => flow.toggle(category.step.id)}
            />
          ))}
        </ol>
      )}
      {!confirmation && (
        <div className="mt-8 border-t border-border pt-6">
          {flow.uncertain && (
            <div
              ref={feedback}
              tabIndex={-1}
              role="alert"
              className="mb-6 border-l-2 border-destructive bg-card p-5 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Výsledek se nepodařilo potvrdit. Některé kategorie již mohou být
              odevzdané. Můžete zopakovat stejné odevzdání; již potvrzené hlasy
              se nezmění. Nebo ověřte stav a načtěte aktuální přehled.
            </div>
          )}
          {flow.attempt ? (
            <div className="border border-border bg-card p-5">
              <h2
                ref={confirmHeading}
                tabIndex={-1}
                className="text-xl font-semibold outline-none"
              >
                Potvrdit vybrané kategorie?
              </h2>
              <ul className="mt-4 space-y-3">
                {flow.chosen.map(({ step, ballot }) => (
                  <li className="break-words" key={step.id}>
                    <strong>{step.name}</strong>: {ballot!.validation.plusUsed}{' '}
                    kladných, {ballot!.validation.minusUsed} záporných hlasů
                    {!ballot!.entries.length && ' · prázdný návrh'}
                  </li>
                ))}
              </ul>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Potvrzené kategorie se uzamknou. Každá se odešle samostatně;
                případný problém ostatní odevzdání nezruší. Již odevzdané a
                nevybrané kategorie zůstanou beze změny.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  className="min-h-11 h-auto whitespace-normal"
                  disabled={flow.busy || (flow.changed && !flow.uncertain)}
                  onClick={() => void flow.submit()}
                >
                  {flow.busy
                    ? 'Odevzdáváme…'
                    : flow.uncertain
                      ? 'Zopakovat stejné odevzdání'
                      : 'Potvrdit a odevzdat vybrané'}
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={flow.busy}
                  onClick={() => {
                    flow.cancel();
                    window.setTimeout(() => opener.current?.focus(), 0);
                  }}
                >
                  Zpět k výběru
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p role="status" className="mb-4">
                Vybráno k odevzdání: {flow.chosen.length}. Žádná kategorie se
                nevybírá automaticky.
              </p>
              <Button
                ref={opener}
                className="min-h-11 h-auto whitespace-normal"
                disabled={!flow.chosen.length || flow.changed || refreshing}
                onClick={flow.confirm}
              >
                Odevzdat vybrané kategorie
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
