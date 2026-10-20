import { useEffect, useRef, useState } from 'react';
import { jurorLinkSchema, type JurorRecord, type Roster } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { adminRequest, managementError } from './api';

export function CopyJurorLink({
  juror,
  access,
  onExpired,
}: {
  juror: JurorRecord;
  access: Roster['jurors'][number]['access'];
  onExpired: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [fallback, setFallback] = useState('');
  const controller = useRef<AbortController | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const id = `copy-link-${juror.id}`;
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (fallback) {
      field.current?.focus();
      field.current?.select();
    }
  }, [fallback]);
  useEffect(() => {
    if (!busy && restoreFocus.current) {
      restoreFocus.current = false;
      if (!fallback) button.current?.focus();
    }
  }, [busy, fallback]);
  async function copy() {
    if (busy) return;
    setBusy(true);
    setNotice('');
    setFallback('');
    const request = new AbortController();
    controller.current = request;
    try {
      const { url } = await adminRequest(
        `/events/${juror.eventId}/jurors/${juror.id}/access/copy`,
        jurorLinkSchema,
        { method: 'POST', body: {}, signal: request.signal },
      );
      if (request.signal.aborted) return;
      try {
        await navigator.clipboard.writeText(url);
        if (!request.signal.aborted)
          setNotice(`Odkaz pro ${juror.displayName} byl zkopírován.`);
      } catch {
        if (!request.signal.aborted) {
          setFallback(url);
          setNotice(
            'Schránka není dostupná. Odkaz označen; zkopírujte jej pomocí Ctrl+C nebo ⌘C.',
          );
        }
      }
    } catch (error) {
      if (request.signal.aborted) return;
      if (error instanceof ApiError && [401, 403].includes(error.status))
        onExpired();
      else setNotice(managementError(error));
    } finally {
      if (!request.signal.aborted) {
        restoreFocus.current = true;
        setBusy(false);
      }
    }
  }
  return (
    <div className="min-w-0 max-w-full">
      <Button
        ref={button}
        variant="outline"
        className="min-h-11"
        disabled={busy || access !== 'stored'}
        aria-label={`Kopírovat odkaz ${juror.displayName}, ID ${juror.id.slice(0, 8)}`}
        onClick={() => void copy()}
      >
        {busy ? 'Kopírování…' : 'Kopírovat odkaz'}
      </Button>
      {access === 'none' && (
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Odkaz vznikne při uložení tabulky.
        </p>
      )}
      {access === 'revoked' && (
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Přístup byl zrušen. Uložení tabulky jej neobnoví.
        </p>
      )}
      {access === 'legacy' && (
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Původní odkaz funguje. Pro kopírování jej musíte výslovně nahradit.
        </p>
      )}
      <p role="status" aria-atomic="true" className="mt-2 max-w-xs text-sm">
        {notice}
      </p>
      {fallback && (
        <div className="mt-2 max-w-xs">
          <label htmlFor={id} className="text-sm font-medium">
            Osobní odkaz pro {juror.displayName}
          </label>
          <textarea
            id={id}
            ref={field}
            readOnly
            value={fallback}
            rows={4}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 w-full min-w-0 resize-y rounded-md border border-input p-3 text-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          />
          <Button
            variant="ghost"
            className="mt-2 min-h-11"
            onClick={() => {
              setFallback('');
              setNotice('Odkaz byl skryt.');
              button.current?.focus();
            }}
          >
            Skrýt odkaz
          </Button>
        </div>
      )}
    </div>
  );
}
