import { useEffect, useRef, useState } from 'react';
import type { TeamTableRow } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { controlClass } from './MutationForm';
import {
  parseTeamPaste,
  teamRowIssues,
  teamFieldError,
} from './team-table-utils';

export function TeamPaste({
  disabled,
  append,
}: {
  disabled: boolean;
  append: (rows: TeamTableRow[]) => void;
}) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<TeamTableRow[]>();
  const [error, setError] = useState('');
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) feedback.current?.focus();
  }, [error]);
  const issues = preview ? teamRowIssues(preview) : [];
  return (
    <details className="mt-5 border-y border-border py-2">
      <summary className="min-h-11 cursor-pointer py-3 font-medium outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">
        Vložit ze spreadsheetu
      </summary>
      <p id="team-paste-help" className="my-3 text-sm text-muted-foreground">
        Vložte řádky bez záhlaví: první sloupec název, druhý nepovinný popis.
        Sloupce oddělte tabulátorem. Vložené řádky vytvoří nové týmy, včetně
        stejných názvů. Náhled nic neukládá.
      </p>
      <label htmlFor="team-paste" className="mb-2 block text-sm font-medium">
        Řádky z tabulky
      </label>
      <textarea
        id="team-paste"
        aria-describedby="team-paste-help"
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
          const parsed = parseTeamPaste(text);
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
            Náhled nových týmů ({preview.length})
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
                  {index + 1}. {row.name || 'Chybí název'}
                </p>
                <p className="whitespace-pre-wrap text-sm">
                  {row.description || 'Bez popisu'}
                </p>
                {issues
                  .filter((issue) => issue.rowId === row.id)
                  .map((issue) => (
                    <p key={issue.field} className="text-sm text-destructive">
                      {teamFieldError(issue.field)}
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
