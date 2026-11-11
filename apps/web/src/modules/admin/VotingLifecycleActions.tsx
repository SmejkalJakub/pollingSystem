import { useEffect, useRef, useState } from 'react';
import { votingRecordSchema, type VotingRecord } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { adminRequest, managementError } from './api';

export function VotingLifecycleActions({
  voting,
  onExpired,
  onChanged,
  disabled = false,
  compact = false,
  closeConfirmation = false,
  closeLabel,
}: {
  voting: Pick<VotingRecord, 'id' | 'name' | 'status'>;
  onExpired: () => void;
  onChanged: () => void;
  disabled?: boolean;
  compact?: boolean;
  closeConfirmation?: boolean;
  closeLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const controller = useRef<AbortController | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (error) {
      feedback.current?.focus();
    }
  }, [error]);
  useEffect(() => {
    if (notice && !busy && !disabled) {
      button.current?.focus();
    }
  }, [notice, busy, disabled]);
  if (voting.status === 'draft') {
    return null;
  }
  const action = voting.status === 'active' ? 'close' : 'reopen';
  const label =
    action === 'close' ? 'Uzavřít hlasování' : 'Znovu otevřít hlasování';
  let buttonLabel = label;
  if (busy) {
    buttonLabel = 'Probíhá změna…';
  } else if (closeLabel && action === 'close') {
    buttonLabel = closeLabel;
  } else if (compact) {
    buttonLabel = action === 'close' ? 'Uzavřít' : 'Znovu otevřít';
  }
  async function change() {
    if (busy) {
      return;
    }
    if (
      (compact || closeConfirmation) &&
      action === 'close' &&
      !window.confirm(`Uzavřít hlasování „${voting.name}“?`)
    ) {
      return;
    }
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await adminRequest(
        `/votings/${voting.id}/${action}`,
        votingRecordSchema,
        {
          method: 'POST',
          body: {},
          signal: request.signal,
        },
      );
      if (request.signal.aborted) {
        return;
      }
      setNotice(
        action === 'close'
          ? 'Hlasování bylo uzavřeno. Lze je znovu otevřít.'
          : 'Hlasování bylo znovu otevřeno.',
      );
      onChanged();
    } catch (cause) {
      if (request.signal.aborted) {
        return;
      }
      if (cause instanceof ApiError && cause.status === 401) {
        onExpired();
      } else {
        const operation = action === 'close' ? 'Uzavření' : 'Otevření';
        setError(
          `${operation} hlasování se nepodařilo potvrdit. ${managementError(cause)}`,
        );
      }
    } finally {
      if (!request.signal.aborted) {
        setBusy(false);
      }
    }
  }
  return (
    <div className="min-w-0">
      <Button
        ref={button}
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={busy || disabled}
        aria-label={`${label}: ${voting.name}`}
        onClick={() => void change()}
      >
        {buttonLabel}
      </Button>
      {notice && (
        <p role="status" className="mt-2 text-sm">
          {notice}
        </p>
      )}
      {error && (
        <p
          ref={feedback}
          tabIndex={-1}
          role="alert"
          className="mt-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
