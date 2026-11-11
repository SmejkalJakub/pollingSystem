import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError, apiFetch, requestProblem } from '@/lib/api';

export function ExportResults({
  eventId,
  onExpired,
}: {
  eventId: string;
  onExpired: () => void;
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
    if (state === 'error') feedback.current?.focus();
    if (state === 'success') button.current?.focus();
  }, [state]);
  async function download() {
    if (controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setState('pending');
    try {
      const response = await apiFetch(
        `/results/export.xlsx?eventId=${eventId}`,
        { signal: request.signal },
      );
      if (
        !response.headers
          .get('content-type')
          ?.startsWith(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          )
      )
        throw new ApiError(response.status, 'UNEXPECTED_RESPONSE');
      const blob = await response.blob();
      if (request.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `d21-${eventId}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState('success');
    } catch (error) {
      if (request.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) onExpired();
      else {
        setErrorMessage(requestProblem(error));
        setState('error');
      }
    } finally {
      controller.current = null;
    }
  }
  return (
    <div>
      <Button
        ref={button}
        className="min-h-11 shrink-0"
        disabled={state === 'pending'}
        onClick={() => void download()}
      >
        {state === 'pending'
          ? 'Připravuji XLSX…'
          : state === 'error'
            ? 'Zkusit export znovu'
            : 'Stáhnout XLSX'}
      </Button>
      {state === 'pending' && (
        <p role="status" className="sr-only">
          Připravuji aktuální data ke stažení…
        </p>
      )}
      {state === 'success' && (
        <p role="status" className="sr-only">
          Export je připraven ke stažení. Čas dat najdete v souboru.
        </p>
      )}
      {state === 'error' && (
        <p
          ref={feedback}
          role="alert"
          tabIndex={-1}
          className="mt-2 max-w-xs text-sm text-destructive outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          Výsledky se nepodařilo stáhnout. {errorMessage}
        </p>
      )}
    </div>
  );
}
