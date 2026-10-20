import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { jurorLinkSchema, type Roster } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { CopyJurorLink } from './CopyJurorLink';
import { RemoveMembership } from './RemoveMembership';
import { MutationForm } from './MutationForm';
import { adminRequest } from './api';
import { ApiError } from '@/lib/api';

export function JurorControls({
  onPanelChange,
  juror,
  locked,
  disabled,
  reload,
  onExpired,
}: {
  onPanelChange: (open: boolean) => void;
  juror: Roster['jurors'][number];
  locked: boolean;
  disabled: boolean;
  reload: (focusFeedback?: boolean) => void;
  onExpired: () => void;
}) {
  const [action, setAction] = useState<'replace' | 'revoke' | null>(null);
  const [removing, setRemoving] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [notice, setNotice] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const replacement = useRef<HTMLButtonElement>(null);
  const focusOnReady = useRef(false);
  useEffect(() => {
    if (!disabled && focusOnReady.current) {
      const copy = container.current?.querySelector<HTMLButtonElement>(
        '[aria-label^="Kopírovat odkaz"]',
      );
      (copy && !copy.disabled ? copy : replacement.current)?.focus();
      focusOnReady.current = false;
    }
  }, [disabled, juror.access]);
  const path = `/events/${juror.eventId}/jurors/${juror.id}/access`;
  const identityId = `link-identity-${juror.id}`;
  function confirm(next: 'replace' | 'revoke') {
    setEpoch((value) => value + 1);
    setNotice('');
    setAction(next);
    onPanelChange(true);
  }
  function close() {
    setAction(null);
    onPanelChange(false);
  }
  return (
    <div ref={container} className="min-w-0 space-y-2">
      <p id={`${identityId}-name`} className="break-words font-medium">
        {juror.displayName}
      </p>
      <p id={identityId} className="font-mono text-xs text-muted-foreground">
        ID {juror.id.slice(0, 8)}
      </p>
      <fieldset
        disabled={disabled}
        className="flex min-w-0 flex-wrap items-start gap-2"
      >
        <CopyJurorLink
          key={epoch}
          juror={juror}
          access={juror.access}
          onExpired={onExpired}
        />
        {juror.access !== 'none' && (
          <>
            <Button
              ref={replacement}
              aria-describedby={`${identityId}-name ${identityId}`}
              type="button"
              className="min-h-11"
              variant="ghost"
              onClick={() => confirm('replace')}
            >
              {juror.access === 'revoked' ? 'Obnovit odkaz' : 'Nahradit odkaz'}
            </Button>
            {juror.access !== 'revoked' && (
              <Button
                aria-describedby={`${identityId}-name ${identityId}`}
                type="button"
                className="min-h-11"
                variant="ghost"
                onClick={() => confirm('revoke')}
              >
                Zrušit odkazy a přihlášení
              </Button>
            )}
          </>
        )}
        <Button
          type="button"
          className="min-h-11"
          variant="ghost"
          disabled={locked || action !== null || removing}
          aria-label={`Odebrat členství ${juror.displayName}, ID ${juror.id.slice(0, 8)}`}
          onClick={() => {
            setRemoving(true);
            onPanelChange(true);
          }}
        >
          Odebrat
        </Button>
      </fieldset>
      {notice && (
        <p role="status" aria-atomic="true" className="text-sm">
          {notice}
        </p>
      )}
      {action && (
        <MutationForm
          headingLevel={4}
          title={
            action === 'replace'
              ? 'Nahradit osobní odkaz?'
              : 'Zrušit odkazy a přihlášení?'
          }
          initial={{}}
          fields={[]}
          schema={z.strictObject({})}
          onExpired={onExpired}
          cancel={close}
          destructive={action === 'revoke'}
          description={
            `Porotce: ${juror.displayName} (ID ${juror.id}). Všechny dosavadní odkazy tohoto porotce a jeho přihlášení na všech zařízeních přestanou platit. Hlasovací údaje zůstanou zachovány.` +
            (action === 'replace'
              ? ' Nový odkaz poté zkopírujte a doručte soukromě.'
              : '')
          }
          submitLabel={
            action === 'replace' ? 'Potvrdit náhradu' : 'Zrušit přístup'
          }
          save={async () => {
            try {
              if (action === 'replace') {
                await adminRequest(path, jurorLinkSchema, {
                  method: 'POST',
                  body: {},
                });
                setNotice('Nový odkaz je připraven. Použijte Kopírovat odkaz.');
              } else {
                await adminRequest(`${path}/revoke`, z.undefined(), {
                  method: 'POST',
                  body: {},
                });
                setNotice('Odkazy a přihlášení porotce byly zrušeny.');
              }
              focusOnReady.current = true;
              close();
              reload(false);
            } catch (error) {
              if (error instanceof ApiError && error.status === 403)
                onExpired();
              throw error;
            }
          }}
        />
      )}
      {removing && (
        <RemoveMembership
          juror={juror}
          base={`/events/${juror.eventId}`}
          onExpired={onExpired}
          cancel={() => {
            setRemoving(false);
            onPanelChange(false);
          }}
          done={() => {
            setRemoving(false);
            onPanelChange(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
