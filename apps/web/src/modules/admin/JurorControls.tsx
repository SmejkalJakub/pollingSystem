import './roster.css';
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
  menuLinks,
  allowRemoval = true,
  juror,
  locked,
  disabled,
  copyDisabled,
  reload,
  onExpired,
}: {
  onPanelChange: (open: boolean) => void;
  menuLinks?: { href: string; label: string }[];
  allowRemoval?: boolean;
  juror: Roster['jurors'][number];
  locked: boolean;
  disabled: boolean;
  copyDisabled: boolean;
  reload: (focusFeedback?: boolean) => void;
  onExpired: () => void;
}) {
  const [action, setAction] = useState<'replace' | 'revoke' | null>(null);
  const [removing, setRemoving] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [notice, setNotice] = useState('');
  const [menuPosition, setMenuPosition] = useState<{
    top?: number;
    bottom?: number;
    right: number;
  }>();
  const container = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const menuTrigger = useRef<HTMLElement>(null);
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
  function closeMenu() {
    if (menu.current) {
      menu.current.open = false;
    }
  }
  // Closing hides the chosen item, so dialogs return focus to the ⋯ trigger.
  function closeMenuToTrigger() {
    closeMenu();
    menuTrigger.current?.focus();
  }
  useEffect(() => {
    if (!menuPosition) {
      return;
    }
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menu.current?.contains(event.target)
      ) {
        closeMenu();
      }
    }
    // A fixed menu must not drift away from its row while the page scrolls.
    function moved(event: Event) {
      if (
        event.target instanceof Node &&
        menu.current?.contains(event.target)
      ) {
        return;
      }
      closeMenu();
    }
    document.addEventListener('pointerdown', outside);
    window.addEventListener('scroll', moved, true);
    window.addEventListener('resize', closeMenu);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('scroll', moved, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [menuPosition]);
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
    <div
      ref={container}
      className="flex min-w-0 flex-wrap items-start gap-2 [&>form]:basis-full"
    >
      <p id={`${identityId}-name`} className="sr-only">
        {juror.displayName}
      </p>
      <fieldset
        disabled={copyDisabled}
        className="flex min-w-0 flex-wrap items-start gap-2"
      >
        <CopyJurorLink
          key={epoch}
          juror={juror}
          access={juror.access}
          onExpired={onExpired}
        />
      </fieldset>
      {juror.access === 'revoked' && (
        <Button
          ref={replacement}
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => confirm('replace')}
        >
          Obnovit odkaz…
        </Button>
      )}
      <details
        ref={menu}
        className="roster-row-actions"
        onToggle={(event) => {
          const opened = event.currentTarget.open;
          const trigger = menuTrigger.current?.getBoundingClientRect();
          if (opened && trigger) {
            const right = Math.max(8, window.innerWidth - trigger.right);
            // Open upward near the bottom edge so every item stays reachable.
            if (trigger.bottom > window.innerHeight * 0.6) {
              setMenuPosition({
                bottom: window.innerHeight - trigger.top + 6,
                right,
              });
            } else {
              setMenuPosition({ top: trigger.bottom + 6, right });
            }
          } else {
            setMenuPosition(undefined);
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !menu.current?.open) {
            return;
          }
          event.stopPropagation();
          menu.current.open = false;
          menuTrigger.current?.focus();
        }}
      >
        <summary
          ref={menuTrigger}
          aria-label={`Další možnosti: ${juror.displayName}`}
          className="roster-disclosure-trigger roster-row-trigger"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
          </svg>
        </summary>
        <fieldset
          disabled={disabled}
          className="roster-row-menu"
          style={menuPosition}
        >
          <p id={identityId} className="sr-only">
            ID {juror.id.slice(0, 8)}
          </p>
          {menuLinks?.map(({ href, label }) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
          {juror.access !== 'none' && juror.access !== 'revoked' && (
            <>
              <button
                aria-describedby={`${identityId}-name ${identityId}`}
                type="button"
                onClick={() => {
                  closeMenuToTrigger();
                  confirm('replace');
                }}
              >
                Nahradit odkaz…
              </button>
              <button
                aria-describedby={`${identityId}-name ${identityId}`}
                type="button"
                data-tone="destructive"
                onClick={() => {
                  closeMenuToTrigger();
                  confirm('revoke');
                }}
              >
                Zrušit přístup…
              </button>
            </>
          )}
          {allowRemoval && (
            <button
              type="button"
              disabled={locked || action !== null || removing}
              aria-label={`Odebrat členství ${juror.displayName}, ID ${juror.id.slice(0, 8)}`}
              onClick={() => {
                closeMenuToTrigger();
                setRemoving(true);
                onPanelChange(true);
              }}
            >
              Odebrat
            </button>
          )}
        </fieldset>
      </details>
      {notice && (
        <p role="status" aria-atomic="true" className="basis-full text-sm">
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
              if (error instanceof ApiError && error.status === 403) {
                onExpired();
              }
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
