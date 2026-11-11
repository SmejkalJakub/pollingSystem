import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError, apiFetch } from '@/lib/api';
import { managementError } from './api';

export function ExportJurorLinks({
  eventId,
  onExpired,
  disabled,
  label = 'Stáhnout odkazy (XLSX)',
}: {
  eventId: string;
  onExpired: () => void;
  disabled: boolean;
  label?: string;
}) {
  const [state, setState] = useState<'idle' | 'pending' | 'success' | 'error'>(
    'idle',
  );
  const [errorMessage, setErrorMessage] = useState('');
  const controller = useRef<AbortController | null>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (state === 'error') {
      feedback.current?.focus();
    }
    if (state === 'success') {
      button.current?.focus();
    }
  }, [state]);
  async function download() {
    if (controller.current) {
      return;
    }
    const request = new AbortController();
    controller.current = request;
    setState('pending');
    try {
      const response = await apiFetch(`/events/${eventId}/jurors/links.xlsx`, {
        method: 'POST',
        body: {},
        signal: request.signal,
      });
      if (
        !response.headers
          .get('content-type')
          ?.startsWith(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          )
      ) {
        throw new ApiError(response.status, 'UNEXPECTED_RESPONSE');
      }
      const blob = await response.blob();
      if (request.signal.aborted) {
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `d21-jurors-${eventId}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState('success');
    } catch (error) {
      if (request.signal.aborted) {
        return;
      }
      if (error instanceof ApiError && error.status === 401) {
        onExpired();
      } else {
        setErrorMessage(managementError(error));
        setState('error');
      }
    } finally {
      controller.current = null;
    }
  }
  let buttonLabel = label;
  if (state === 'pending') {
    buttonLabel = 'Připravuji XLSX…';
  } else if (state === 'error') {
    buttonLabel = 'Zkusit export znovu';
  }
  return (
    <div className="roster-export">
      <Button
        ref={button}
        title="Export obsahuje uložené porotce a jejich osobní odkazy. Každému předejte pouze jeho vlastní odkaz."
        variant="outline"
        className="min-h-11 shrink-0"
        disabled={disabled || state === 'pending'}
        onClick={() => void download()}
      >
        {buttonLabel}
      </Button>
      {state === 'pending' && (
        <p role="status" className="mt-3 text-sm">
          Připravuji odkazy uložených porotců ke stažení…
        </p>
      )}
      {state === 'success' && (
        <p role="status" className="mt-3 text-sm">
          Odkazy porotců jsou připraveny ke stažení.
        </p>
      )}
      {state === 'error' && (
        <p
          ref={feedback}
          role="alert"
          tabIndex={-1}
          className="mt-3 text-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          Export se nepodařilo připravit. Odkazy se nepodařilo stáhnout.{' '}
          {errorMessage}
        </p>
      )}
    </div>
  );
}
