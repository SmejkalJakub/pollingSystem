import { useEffect, useId, useRef, type ReactNode } from 'react';

export function WizardSheet({
  title,
  busy,
  note = 'Po odevzdání se hlasy uzamknou. Upravit je půjde jen po odemčení organizátorem.',
  onCancel,
  children,
}: {
  title: string;
  busy: boolean;
  onCancel: () => void;
  note?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const sheet = dialog.current;
    sheet?.showModal();
    heading.current?.focus();
    return () => sheet?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="wizard-sheet"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onCancel();
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') {
          return;
        }
        const controls =
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            'button:not(:disabled)',
          );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) {
          event.preventDefault();
          heading.current?.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === heading.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <h2 id={titleId} ref={heading} tabIndex={-1} className="outline-none">
        {title}
      </h2>
      <p className="wizard-sheet-note">{note}</p>
      {children}
    </dialog>
  );
}
