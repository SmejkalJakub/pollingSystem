import { useEffect, useRef, useState } from 'react';
import {
  wizardFinalSubmitSchema,
  type WizardReview,
  type WizardReviewCategory,
  type WizardFinalSubmit,
  type WizardFinalSubmitInput,
} from '@d21/contracts';
import { ApiError, apiRequest } from '@/lib/api';

export function canSubmit(category: WizardReviewCategory) {
  return (
    category.step.status === 'active' &&
    category.ballot?.status === 'draft' &&
    category.ballot.validation.valid
  );
}

export function useReviewSubmission(
  review: WizardReview,
  onAccessError: (error: unknown) => void,
) {
  const [displayed, setDisplayed] = useState(review);
  const [selected, setSelected] = useState<string[]>([]);
  const [attempt, setAttempt] = useState<WizardFinalSubmitInput>();
  const [result, setResult] = useState<WizardFinalSubmit>();
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const changed =
    JSON.stringify(displayed.categories) !== JSON.stringify(review.categories);
  const chosen = displayed.categories.filter(
    (category) =>
      selected.includes(category.step.id) &&
      canSubmit(category) &&
      review.categories.some((current) => current.step.id === category.step.id),
  );
  function confirm() {
    if (changed || !chosen.length || controller.current) return;
    setAttempt({
      categories: chosen.map(({ step, ballot }) => ({
        stepId: step.id,
        expectedRevision: ballot!.revision,
        entries: ballot!.entries,
      })),
    });
    setUncertain(false);
  }
  async function submit() {
    if (!attempt || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setUncertain(false);
    try {
      const value = await apiRequest(
        '/wizard/final-submit',
        wizardFinalSubmitSchema,
        { method: 'POST', body: attempt, signal: request.signal },
      );
      if (request.signal.aborted) return;
      setResult(value);
      setAttempt(undefined);
      setSelected([]);
      // The URL is refreshable: a reload derives confirmation from current ballots.
      window.history.replaceState(null, '', '/wizard/confirmation');
    } catch (error) {
      if (request.signal.aborted) return;
      if (error instanceof ApiError && [401, 403].includes(error.status))
        onAccessError(error);
      else setUncertain(true);
    } finally {
      if (!request.signal.aborted) setBusy(false);
      controller.current = null;
    }
  }
  return {
    displayed,
    chosen,
    selected,
    changed,
    attempt,
    result,
    busy,
    uncertain,
    confirm,
    submit,
    toggle(id: string) {
      if (!attempt && !busy)
        setSelected((ids) =>
          ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
        );
    },
    cancel() {
      if (!busy) {
        setAttempt(undefined);
        setUncertain(false);
      }
    },
    loadCurrent() {
      if (!busy) {
        setDisplayed(review);
        setSelected([]);
        setAttempt(undefined);
        setUncertain(false);
      }
    },
  };
}
