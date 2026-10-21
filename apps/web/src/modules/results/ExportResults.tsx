import { useEffect, useRef, useState } from 'react';
import { apiErrorSchema } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';

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
      const response = await fetch(
        `/api/results/export.xlsx?eventId=${eventId}`,
        {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: request.signal,
        },
      );
      if (!response.ok) {
        const error = apiErrorSchema.safeParse(await response.json());
        throw new ApiError(
          response.status,
          error.success ? error.data.error.code : 'UNKNOWN',
        );
      }
      if (
        !response.headers
          .get('content-type')
          ?.startsWith(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          )
      )
        throw new Error('Unexpected export response');
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
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      )
        onExpired();
      else setState('error');
    } finally {
      controller.current = null;
    }
  }
  return (
    <div className="mt-6 border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-semibold">Export výsledků a účasti</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            XLSX obsahuje přehled kategorií, výsledky týmů, stav účasti porotců
            a jednotlivé hlasy porotců s časem exportu. Při stažení se načte
            nový snímek dat.
          </p>
        </div>
        <Button
          ref={button}
          variant="outline"
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
      </div>
      {state === 'pending' && (
        <p role="status" className="mt-3 text-sm">
          Připravuji aktuální data ke stažení…
        </p>
      )}
      {state === 'success' && (
        <p role="status" className="mt-3 text-sm">
          Export je připraven ke stažení. Čas dat najdete v souboru.
        </p>
      )}
      {state === 'error' && (
        <p
          ref={feedback}
          role="alert"
          tabIndex={-1}
          className="mt-3 text-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          Export se nepodařilo připravit. Zkontrolujte připojení a zkuste export
          znovu.
        </p>
      )}
    </div>
  );
}
