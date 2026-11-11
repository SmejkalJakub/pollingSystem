import { juryGroupLabel } from '@d21/contracts';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import type {
  BallotDraft,
  WizardCurrent,
  WizardFinalSubmit,
  WizardStep,
  WizardStepDetail,
  WizardReview,
} from '@d21/contracts';
import { EmptyCategories, LockIcon } from './CategoryAvailability';
import { CategoryVoting } from './CategoryVoting';
import { WizardSummary } from './WizardSummary';
import {
  isWizardTab,
  reviewPath,
  stepPath,
  type useWizardNavigation,
} from './useWizardNavigation';
import './wizard.css';

const emptySummaryBallots = new Map<string, BallotDraft>();

const progressLabels = {
  not_started: 'Bez hlasů',
  in_progress: 'Rozpracováno',
  invalid_draft: 'Neplatný návrh',
  submitted: 'Odevzdáno',
  locked: 'Uzavřeno',
};

function CategoryMark({ state }: { state: WizardStep['progress'] }) {
  return (
    <span className="wizard-mark" data-state={state} aria-hidden="true">
      {state === 'submitted' && (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m4 8 2.5 2.5L12 5" />
        </svg>
      )}
      {state === 'locked' && <LockIcon />}
      {state === 'in_progress' && '•'}
      {state === 'invalid_draft' && '!'}
    </span>
  );
}

function WizardHeader({
  current,
  busy,
  logout,
}: {
  current: WizardCurrent;
  busy: boolean;
  logout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const identity = `${current.principal.displayName} · ${juryGroupLabel(current.group.code)} porota`;
  useEffect(() => {
    if (open) {
      action.current?.focus();
    }
  }, [open]);
  return (
    <header className="wizard-header">
      <div className="wizard-header-inner">
        <span className="wizard-wordmark">D21</span>
        <p className="wizard-identity" title={identity}>
          {identity}
        </p>
        <p className="wizard-event" title={current.event.name}>
          {current.event.name}
        </p>
        <div
          className="wizard-menu"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setOpen(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && open) {
              setOpen(false);
              menu.current?.focus();
            }
          }}
        >
          <button
            ref={menu}
            type="button"
            className="wizard-menu-toggle"
            aria-label="Menu porotce"
            aria-expanded={open}
            aria-controls="wizard-logout"
            onClick={() => setOpen(!open)}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <button
            ref={action}
            id="wizard-logout"
            type="button"
            className="wizard-logout"
            data-open={open}
            onClick={logout}
            disabled={busy}
          >
            {busy ? 'Odhlašujeme…' : 'Odhlásit se'}
          </button>
        </div>
      </div>
    </header>
  );
}

function CategoryNavigation({
  steps,
  ballots,
  path,
}: {
  steps: WizardStep[];
  ballots: ReadonlyMap<string, BallotDraft | null>;
  path: string;
}) {
  const active = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [path]);
  const submitted = steps.filter(
    (step) => step.progress === 'submitted',
  ).length;
  const summary = path === reviewPath || path === '/wizard/confirmation';
  return (
    <nav className="wizard-categories" aria-label="Kategorie">
      <p className="wizard-rail-label">Vaše kategorie</p>
      {steps.map((step) => {
        const href = stepPath(step.id);
        const selected = href === path;
        const state = step.status === 'active' ? step.progress : 'locked';
        const ballot = ballots.get(step.id);
        let label = progressLabels[state];
        if (state === 'in_progress' && ballot && step.maxPlusVotes !== null) {
          label += ` · ${ballot.validation.plusUsed} z ${step.maxPlusVotes} +`;
        }
        return (
          <a
            key={step.id}
            ref={selected ? active : undefined}
            href={href}
            aria-current={selected ? 'page' : undefined}
            className="wizard-tab"
          >
            <CategoryMark state={state} />
            <span className="wizard-tab-copy">
              <span>{step.name}</span>
              <span className="wizard-tab-status" data-state={state}>
                {label}
              </span>
            </span>
          </a>
        );
      })}
      <a
        ref={summary ? active : undefined}
        href={reviewPath}
        aria-current={summary ? 'page' : undefined}
        className="wizard-tab wizard-summary-tab"
      >
        <span>
          Souhrn<span className="wizard-summary-extension"> a odevzdání</span>
        </span>
        <span className="wizard-summary-count">
          {submitted}/{steps.length}
        </span>
      </a>
    </nav>
  );
}

export function WizardContent({
  current,
  detail,
  review,
  rail,
  navigation,
  loading,
  headingRef,
  logout,
  busy,
  onAccessError,
  onRefresh,
  refreshing,
  feedback,
}: {
  current: WizardCurrent;
  detail?: WizardStepDetail;
  review?: WizardReview;
  rail?: WizardReview;
  navigation: ReturnType<typeof useWizardNavigation>;
  loading: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  logout: () => void;
  busy: boolean;
  onAccessError: (error: unknown) => void;
  onRefresh: () => void;
  refreshing: boolean;
  feedback: ReactNode;
}) {
  const [unavailableStep, setUnavailableStep] = useState<string>();
  const recordAvailability = useCallback((id: string, closed: boolean) => {
    setUnavailableStep(closed ? id : undefined);
  }, []);
  const [announcement, setAnnouncement] = useState('');
  const [localBallot, setLocalBallot] = useState<{
    current: WizardCurrent;
    id: string;
    ballot: BallotDraft;
  }>();
  const [summaryUpdates, setSummaryUpdates] = useState<{
    review: WizardReview;
    ballots: ReadonlyMap<string, BallotDraft>;
  }>();
  const summaryBallots =
    summaryUpdates && summaryUpdates.review === review
      ? summaryUpdates.ballots
      : emptySummaryBallots;
  const recordSummaryResult = useCallback(
    (source: WizardReview, result: WizardFinalSubmit) => {
      setSummaryUpdates((previous) => {
        const next = new Map(
          previous?.review === source ? previous.ballots : undefined,
        );
        for (const outcome of result.results) {
          if (outcome.outcome === 'submitted') {
            next.set(outcome.stepId, outcome.ballot);
          }
        }
        return { review: source, ballots: next };
      });
    },
    [],
  );
  const { setGuard } = navigation;
  const reviewGuard = useCallback(
    (pending: boolean) => setGuard(false, pending),
    [setGuard],
  );

  let steps = current.steps;
  const ballots = new Map(
    rail?.categories.map(({ step, ballot }) => [step.id, ballot]),
  );
  if (detail) {
    ballots.set(detail.step.id, detail.ballot);
  }
  if (localBallot?.current === current) {
    const { id, ballot } = localBallot;
    steps = steps.map((step) =>
      step.id === id ? { ...step, progress: ballot.progress } : step,
    );
    ballots.set(id, ballot);
  }
  if (summaryBallots.size) {
    steps = steps.map((step) => {
      const ballot = summaryBallots.get(step.id);
      if (ballot) {
        ballots.set(step.id, ballot);
        return { ...step, progress: ballot.progress };
      }
      return step;
    });
  }
  const index = detail
    ? steps.findIndex((step) => step.id === detail.step.id)
    : -1;
  const next = steps[index + 1];
  const nextAvailable =
    detail &&
    steps.find(
      (step) =>
        step.id !== detail.step.id &&
        step.status === 'active' &&
        step.progress !== 'submitted' &&
        step.progress !== 'locked',
    );

  function openLink(event: MouseEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      !(event.target instanceof Element)
    ) {
      return;
    }
    const link = event.target.closest('a');
    if (link && link.origin === location.origin && isWizardTab(link.pathname)) {
      event.preventDefault();
      navigation.navigate(link.pathname);
    }
  }

  return (
    <div className="wizard-shell" onClick={openLink}>
      <WizardHeader
        current={current}
        busy={busy}
        logout={() => {
          if (
            !navigation.isBlocked() ||
            window.confirm(
              'Máte neuložené změny nebo probíhá ukládání. Opravdu se chcete odhlásit?',
            )
          ) {
            logout();
          }
        }}
      />
      <div className="wizard-layout">
        {steps.length > 0 && (
          <CategoryNavigation
            steps={
              detail && unavailableStep === detail.step.id
                ? steps.map((step) =>
                    step.id === unavailableStep
                      ? { ...step, progress: 'locked' }
                      : step,
                  )
                : steps
            }
            ballots={ballots}
            path={navigation.path}
          />
        )}
        <main className="wizard-main" id="main" aria-busy={loading || busy}>
          <p className="sr-only" role="status">
            {announcement}
          </p>
          {loading && (
            <p role="status" className="p-4 text-muted-foreground">
              Načítáme váš přístup a kategorie…
            </p>
          )}
          {review && steps.length > 0 && (
            <WizardSummary
              key={navigation.path}
              review={review}
              submittedBallots={summaryBallots}
              onResult={recordSummaryResult}
              headingRef={headingRef}
              onAccessError={onAccessError}
              onRefresh={onRefresh}
              refreshing={refreshing}
              onPendingChange={reviewGuard}
            />
          )}
          {detail && (
            <CategoryVoting
              key={detail.step.id}
              detail={detail}
              categoryNumber={index + 1}
              categoryCount={steps.length}
              headingRef={headingRef}
              onAccessError={onAccessError}
              onGuardChange={setGuard}
              onAvailabilityChange={recordAvailability}
              onRefresh={onRefresh}
              refreshing={refreshing}
              navigation={navigation}
              nextHref={next ? stepPath(next.id) : reviewPath}
              lastCategory={!next}
              nextAvailable={nextAvailable}
              onSaved={(ballot) =>
                setLocalBallot({ current, id: detail.step.id, ballot })
              }
              onSubmitted={(ballot) => {
                setLocalBallot({ current, id: detail.step.id, ballot });
                setAnnouncement(
                  `Kategorie ${detail.step.name} byla odevzdána.`,
                );
                // Next open category after this one, then any earlier one.
                const remaining = [
                  ...steps.slice(index + 1),
                  ...steps.slice(0, index),
                ].find(
                  (step) =>
                    step.status === 'active' && step.progress !== 'submitted',
                );
                navigation.navigate(
                  remaining ? stepPath(remaining.id) : reviewPath,
                  true,
                );
              }}
            />
          )}
          {!loading && !steps.length && !feedback && (
            <EmptyCategories
              headingRef={headingRef}
              onRefresh={onRefresh}
              refreshing={refreshing}
            />
          )}
          {feedback}
        </main>
      </div>
    </div>
  );
}
