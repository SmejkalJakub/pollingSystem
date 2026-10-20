import { juryGroupLabel } from '@d21/contracts';
import { useState, type RefObject } from 'react';
import type {
  WizardCurrent,
  WizardStep,
  WizardStepDetail,
  WizardReview,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { CategoryVoting } from './CategoryVoting';
import { WizardReviewScreen } from './WizardReviewScreen';

const stepUrl = (id: string) => `/wizard/steps/${id}`;
const progressLabels = {
  not_started: 'Bez uloženého návrhu',
  in_progress: 'Rozpracováno · návrh uložen',
  invalid_draft: 'Neplatný návrh · vyžaduje opravu',
  submitted: 'Odevzdáno',
  locked: 'Uzamčeno',
};
function status(step: WizardStep) {
  return step.status === 'active'
    ? 'Otevřeno'
    : step.status === 'closed'
      ? 'Uzavřeno — nedostupné'
      : 'Archivováno — nedostupné';
}
export function WizardContent({
  current,
  detail,
  review,
  confirmationPage,
  headingRef,
  logout,
  busy,
  onAccessError,
  onRefresh,
  refreshing,
}: {
  current: WizardCurrent;
  detail?: WizardStepDetail;
  review?: WizardReview;
  confirmationPage: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  logout: () => void;
  busy: boolean;
  onAccessError: (error: unknown) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [unsaved, setUnsaved] = useState(false);
  const index = detail
    ? current.steps.findIndex((step) => step.id === detail.step.id)
    : -1;
  const previous = current.steps[index - 1];
  const next = current.steps[index + 1];
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div className="min-w-0">
          <p className="eyebrow">
            Porota {juryGroupLabel(current.group.code)} · {current.group.name}
          </p>
          <p className="mt-2 break-words font-medium">
            {current.principal.displayName}
          </p>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            {current.event.name}
          </p>
        </div>
        <Button
          variant="ghost"
          className="min-h-11"
          onClick={() => {
            if (
              !unsaved ||
              window.confirm(
                'Máte neuložené změny nebo probíhá ukládání. Opravdu se chcete odhlásit?',
              )
            )
              logout();
          }}
          disabled={busy}
        >
          {busy ? 'Odhlašujeme…' : 'Odhlásit se'}
        </Button>
      </div>
      {review ? (
        <WizardReviewScreen
          review={review}
          confirmationPage={confirmationPage}
          headingRef={headingRef}
          onAccessError={onAccessError}
          onRefresh={onRefresh}
          refreshing={refreshing}
          onPendingChange={setUnsaved}
        />
      ) : !detail ? (
        <section className="py-8 sm:py-12">
          <p className="eyebrow">Vítejte v porotě</p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-3 break-words text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
          >
            Vaše kategorie
          </h1>
          {current.event.description && (
            <p className="mt-4 max-w-2xl whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">
              {current.event.description}
            </p>
          )}
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Přehled obsahuje kategorie přístupné vaší části poroty. Mezi nimi
            můžete volně přecházet; pořadí v průvodci neznamená odevzdání hlasů.
          </p>
          {!current.steps.length ? (
            <div
              role="status"
              className="mt-8 border border-border bg-card p-6"
            >
              <h2 className="text-lg font-semibold">
                Zatím žádné dostupné kategorie
              </h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                Organizátor zatím neotevřel kategorii pro vaši část poroty.
                Zkuste přehled později obnovit nebo se obraťte na organizátora.
              </p>
              <a className="wizard-link mt-4" href="/wizard">
                Obnovit přehled
              </a>
            </div>
          ) : (
            <>
              <ol className="mt-8 divide-y border-y border-border">
                {current.steps.map((step, i) => (
                  <li key={step.id}>
                    <a
                      href={stepUrl(step.id)}
                      className="flex min-h-20 items-center gap-4 py-5 outline-offset-4 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
                      aria-label={`${i + 1}. ${step.name}, ${status(step)}, ${progressLabels[step.progress]}`}
                    >
                      <span className="w-7 shrink-0 font-mono text-sm text-muted-foreground">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-semibold">
                          {step.name}
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {step.kind === 'selection'
                            ? 'Výběrové kolo'
                            : 'Finálová kategorie'}{' '}
                          · {status(step)}
                        </span>
                        <span className="mt-1 block text-sm">
                          {progressLabels[step.progress]}
                        </span>
                      </span>
                      <span aria-hidden="true" className="px-2">
                        →
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild className="min-h-11">
                  <a href={stepUrl(current.steps[0]!.id)}>
                    Přejít na první kategorii
                  </a>
                </Button>
                <Button asChild variant="outline" className="min-h-11">
                  <a href="/wizard/review">Rekapitulace a odevzdání</a>
                </Button>
              </div>
            </>
          )}
        </section>
      ) : (
        <>
          <nav
            aria-label="Kategorie průvodce"
            className="mt-6 flex flex-wrap gap-4"
          >
            <a className="wizard-link" href="/wizard">
              ← Všechny kategorie
            </a>
            <a className="wizard-link" href="/wizard/review">
              Rekapitulace
            </a>
          </nav>
          <div className="mt-5" aria-label="Poloha v průvodci">
            <label htmlFor="wizard-progress" className="font-mono text-sm">
              Krok {index + 1} z {current.steps.length}
            </label>
            <progress
              id="wizard-progress"
              max={current.steps.length}
              value={index + 1}
              className="mt-3 block h-1.5 w-full accent-primary"
            />
          </div>
          <section className="mt-8" aria-labelledby="category-title">
            <p className="eyebrow">
              {detail.step.kind === 'selection'
                ? 'Výběrové kolo'
                : 'Finálová kategorie'}{' '}
              · {status(detail.step)}
            </p>
            <h1
              id="category-title"
              ref={headingRef}
              tabIndex={-1}
              className="mt-3 break-words text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
            >
              {detail.step.name}
            </h1>
            {detail.step.instructions && (
              <p className="mt-4 whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">
                {detail.step.instructions}
              </p>
            )}
            <CategoryVoting
              key={`${current.principal.id}:${detail.step.id}`}
              detail={detail}
              onAccessError={onAccessError}
              onUnsavedChange={setUnsaved}
              onRefresh={onRefresh}
              refreshing={refreshing}
            />
          </section>
          <nav
            aria-label="Navigace mezi kroky"
            className="mt-10 flex flex-wrap justify-between gap-4 border-t border-border pt-6"
          >
            <Button asChild variant="outline" className="min-h-11">
              <a href={previous ? stepUrl(previous.id) : '/wizard'}>
                {previous ? '← Předchozí' : '← Přehled'}
              </a>
            </Button>
            <Button asChild className="min-h-11">
              <a href={next ? stepUrl(next.id) : '/wizard/review'}>
                {next ? 'Další kategorie →' : 'Rekapitulace a odevzdání →'}
              </a>
            </Button>
          </nav>
        </>
      )}
    </>
  );
}
