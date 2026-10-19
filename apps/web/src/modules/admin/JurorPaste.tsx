import { useEffect, useRef, useState } from 'react';
import type { JurorTableRow } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { controlClass } from './MutationForm';
import {
  parseJurorPaste,
  jurorRowIssues,
  jurorFieldError,
} from './juror-table-utils';

export function JurorPaste({
  disabled,
  append,
}: {
  disabled: boolean;
  append: (rows: JurorTableRow[]) => void;
}) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<JurorTableRow[]>();
  const [error, setError] = useState('');
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) feedback.current?.focus();
  }, [error]);
  const issues = preview ? jurorRowIssues(preview) : [];
  return (
    <details className="mt-5 border-y border-border py-2">
      <summary className="min-h-11 cursor-pointer py-3 font-medium outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">
        Vložit ze spreadsheetu
      </summary>
      <p id="juror-paste-help" className="my-3 text-sm text-muted-foreground">
        Vložte řádky bez záhlaví: první sloupec jméno, druhý T nebo V. Sloupce
        oddělte tabulátorem. Vložené řádky vytvoří nové porotce, včetně stejných
        jmen. Náhled nic neukládá.
      </p>
      <label htmlFor="juror-paste" className="mb-2 block text-sm font-medium">
        Řádky z tabulky
      </label>
      <textarea
        id="juror-paste"
        aria-describedby="juror-paste-help"
        className={controlClass}
        rows={5}
        value={text}
        disabled={disabled}
        onChange={(event) => {
          setText(event.target.value);
          setPreview(undefined);
          setError('');
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="min-h-11 mt-3"
        disabled={disabled || !text}
        onClick={() => {
          const parsed = parseJurorPaste(text);
          setPreview(undefined);
          setError(
            parsed.error ||
              (!parsed.rows.length ? 'Vložte alespoň jeden řádek.' : ''),
          );
          if (!parsed.error && parsed.rows.length)
            setPreview(
              parsed.rows.map((row) => ({ ...row, id: crypto.randomUUID() })),
            );
        }}
      >
        Zobrazit náhled
      </Button>
      {error && (
        <div
          role="alert"
          tabIndex={-1}
          ref={feedback}
          className="mt-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      {preview && (
        <div className="mt-4 space-y-3">
          <h3 className="font-semibold" tabIndex={-1}>
            Náhled nových porotců ({preview.length})
          </h3>
          {issues.length > 0 && (
            <p role="alert" className="text-sm text-destructive">
              Opravte označené hodnoty ve vloženém textu a zobrazte náhled
              znovu. Nic nebylo přidáno ani uloženo.
            </p>
          )}
          <ol className="divide-y divide-border border-y border-border">
            {preview.map((row, index) => (
              <li key={row.id} className="break-words py-3">
                <p className="font-medium">
                  {index + 1}. {row.displayName || 'Chybí jméno'}
                </p>
                <p className="whitespace-pre-wrap text-sm">
                  {row.groupCode || 'Chybí T/V'}
                </p>
                {issues
                  .filter((issue) => issue.rowId === row.id)
                  .map((issue) => (
                    <p key={issue.field} className="text-sm text-destructive">
                      {jurorFieldError(issue.field)}
                    </p>
                  ))}
              </li>
            ))}
          </ol>
          <Button
            className="min-h-11"
            type="button"
            variant="outline"
            disabled={disabled || issues.length > 0}
            onClick={() => {
              append(preview);
              setPreview(undefined);
              setText('');
            }}
          >
            Přidat náhled do tabulky
          </Button>
        </div>
      )}
    </details>
  );
}
