import { useRef, useState } from 'react';
import type { Roster } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { CopyJurorLink } from './CopyJurorLink';
import { JurorAccess } from './JurorAccess';
import { RemoveMembership } from './RemoveMembership';
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
  reload: () => void;
  onExpired: () => void;
}) {
  const [access, setAccess] = useState(false),
    [removing, setRemoving] = useState(false),
    [epoch, setEpoch] = useState(0);
  const opener = useRef<HTMLButtonElement | null>(null);
  return (
    <div className="min-w-0 space-y-2">
      <p className="break-words font-medium">{juror.displayName}</p>
      <p className="font-mono text-xs text-muted-foreground">
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
        <Button
          type="button"
          className="min-h-11"
          variant="outline"
          disabled={access || removing}
          aria-label={`Osobní přístup ${juror.displayName}, ID ${juror.id.slice(0, 8)}`}
          onClick={(event) => {
            opener.current = event.currentTarget;
            setAccess(true);
            onPanelChange(true);
          }}
        >
          Osobní přístup
        </Button>
        <Button
          type="button"
          className="min-h-11"
          variant="ghost"
          disabled={locked || access || removing}
          aria-label={`Odebrat členství ${juror.displayName}, ID ${juror.id.slice(0, 8)}`}
          onClick={() => {
            setRemoving(true);
            onPanelChange(true);
          }}
        >
          Odebrat
        </Button>
      </fieldset>
      {access && (
        <JurorAccess
          juror={juror}
          onExpired={onExpired}
          onMutating={() => setEpoch((value) => value + 1)}
          onChanged={reload}
          close={() => {
            setAccess(false);
            onPanelChange(false);
            requestAnimationFrame(() => opener.current?.focus());
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
