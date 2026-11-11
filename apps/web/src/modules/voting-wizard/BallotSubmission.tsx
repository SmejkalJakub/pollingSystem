import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import type { useBallotDraft } from './useBallotDraft';

export function BallotSubmission({
  draft,
  valid,
  unavailable,
  confirming,
  setConfirming,
  onCancel,
}: {
  draft: ReturnType<typeof useBallotDraft>;
  valid: boolean;
  unavailable: boolean;
  confirming: boolean;
  setConfirming: (value: boolean) => void;
  onCancel: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (confirming) heading.current?.focus();
  }, [confirming]);
  if (
    !confirming ||
    draft.saved?.status === 'submitted' ||
    draft.saved?.status === 'cancelled'
  )
    return null;
  const disabled = unavailable || !valid || draft.needsComparison || draft.busy;
  return (
    <section
      className="mt-4 rounded-xl border border-border bg-card p-4"
      aria-label="Odevzdání kategorie"
    >
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-lg font-semibold outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      >
        Potvrdit odevzdání této kategorie
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Odevzdáním uzamknete výběr v této kategorii. Úpravy pak může povolit
        administrátor.
      </p>
      {!valid && (
        <p className="mt-3 text-sm text-destructive">
          Před odevzdáním opravte chyby výběru.
        </p>
      )}
      <div className="mt-3">
        <p className="text-sm">
          Odevzdáte {draft.entries.filter((e) => e.voteValue === 1).length}{' '}
          kladných a {draft.entries.filter((e) => e.voteValue === -1).length}{' '}
          záporných hlasů{!draft.entries.length && ' (prázdný lístek)'}.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            className="min-h-11"
            disabled={disabled}
            onClick={async () => {
              const result = await draft.submit();
              if (result === true || result === 'conflict')
                setConfirming(false);
              window.setTimeout(() => feedback.current?.focus(), 0);
            }}
          >
            {draft.busy ? 'Odevzdáváme…' : 'Potvrdit odevzdání'}
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={draft.busy}
            onClick={onCancel}
          >
            Zpět k úpravám
          </Button>
        </div>
        <p
          ref={feedback}
          tabIndex={-1}
          role="status"
          className="mt-3 text-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          {draft.message}
        </p>
      </div>
    </section>
  );
}
