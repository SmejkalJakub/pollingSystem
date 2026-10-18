import { useEffect, useId, useRef, useState } from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { managementError } from './api';

export type FormField = {
  key: string;
  label: string;
  maxLength?: number;
  multiline?: boolean;
  disabled?: boolean;
  placeholder?: string;
  inputType?: 'text' | 'number';
  invalidMessage?: string;
  options?: { value: string; label: string }[];
};
export const controlClass =
  'min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 aria-invalid:border-destructive';

export function MutationForm<T>({
  title,
  initial,
  fields,
  schema,
  save,
  cancel,
  onExpired,
  submitLabel = 'Uložit',
  destructive = false,
  description,
  headingLevel = 2,
}: {
  title: string;
  initial: Record<string, string>;
  fields: FormField[];
  schema: z.ZodType<T>;
  save: (input: T) => Promise<void>;
  cancel: () => void;
  onExpired: () => void;
  submitLabel?: string;
  destructive?: boolean;
  description?: string;
  headingLevel?: 2 | 3 | 4;
}) {
  const id = useId();
  const Heading = headingLevel === 4 ? 'h4' : headingLevel === 3 ? 'h3' : 'h2';
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Capture before React disables the opener during this form's mount.
  const [returnFocus] = useState(() => document.activeElement);
  const errorRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
    return () => {
      // Restore after the parent has re-enabled its button in the same commit.
      queueMicrotask(() => {
        if (returnFocus instanceof HTMLElement && returnFocus.isConnected)
          returnFocus.focus();
      });
    };
  }, [returnFocus]);
  useEffect(() => {
    if (error || Object.keys(errors).length) errorRef.current?.focus();
  }, [error, errors]);
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setErrors({});
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            fields.find((field) => field.key === String(issue.path[0]))
              ?.invalidMessage ?? 'Zadejte platnou hodnotu v uvedené délce.',
          ]),
        ),
      );
      return;
    }
    setBusy(true);
    try {
      await save(parsed.data);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onExpired();
      else setError(managementError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      aria-label={title}
      noValidate
      aria-busy={busy}
      className="space-y-5 border border-border bg-card p-5 sm:p-6"
    >
      <Heading
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold outline-none"
      >
        {title}
      </Heading>
      {description && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {(error || Object.keys(errors).length > 0) && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="space-y-2 text-sm text-destructive outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          {error || 'Zkontrolujte formulář:'}
          {fields
            .filter((field) => errors[field.key])
            .map((field) => (
              <a
                key={field.key}
                className="block underline"
                href={`#${id}-${field.key}`}
              >
                {field.label}: {errors[field.key]}
              </a>
            ))}
        </div>
      )}
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        {fields.map((field) => {
          const fieldId = `${id}-${field.key}`;
          const props = {
            id: fieldId,
            name: field.key,
            value: values[field.key] ?? '',
            disabled: field.disabled,
            'aria-invalid': Boolean(errors[field.key]),
            'aria-describedby': errors[field.key]
              ? `${fieldId}-error`
              : undefined,
            onChange: (
              event: React.ChangeEvent<
                HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
              >,
            ) => setValues({ ...values, [field.key]: event.target.value }),
          };
          return (
            <div key={field.key}>
              <label
                htmlFor={fieldId}
                className="mb-2 block text-sm font-medium"
              >
                {field.label}
              </label>
              {field.options ? (
                <select {...props} className={controlClass}>
                  <option value="">
                    {field.placeholder ?? 'Vyberte část poroty'}
                  </option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.multiline ? (
                <textarea
                  {...props}
                  rows={4}
                  maxLength={field.maxLength}
                  className={controlClass}
                />
              ) : (
                <Input
                  {...props}
                  type={field.inputType ?? 'text'}
                  maxLength={field.maxLength}
                  autoComplete="off"
                />
              )}
              {errors[field.key] && (
                <p
                  id={`${fieldId}-error`}
                  className="mt-2 text-sm text-destructive"
                >
                  {errors[field.key]}
                </p>
              )}
            </div>
          );
        })}
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          variant={destructive ? 'destructive' : 'default'}
          disabled={busy}
          className="min-h-11"
        >
          {busy ? 'Ukládání…' : submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={cancel}
          className="min-h-11"
        >
          Zrušit
        </Button>
      </div>
    </form>
  );
}
