import { useEffect, useRef, useState } from 'react';
import type { JurorTableRow } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { controlClass } from './MutationForm';
import { useAdminLeaveWarning } from './navigation';
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
  useAdminLeaveWarning(Boolean(text));
  const [error, setError] = useState('');
  const details = useRef<HTMLDetailsElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) {
      feedback.current?.focus();
    }
  }, [error]);
  function add() {
    const parsed = parseJurorPaste(text);
    const rows = parsed.rows.map((row) => ({
      ...row,
      id: crypto.randomUUID(),
    }));
    const issues = jurorRowIssues(rows);
    const problem =
      parsed.error ||
      (!rows.length ? 'Vložte alespoň jeden řádek.' : '') ||
      issues.map((issue) => jurorFieldError(issue.field)).join(' ');
    setError(problem);
    if (problem) {
      return;
    }
    append(rows);
    setText('');
    if (details.current) {
      details.current.open = false;
    }
  }
  return (
    <details ref={details} className="roster-paste-disclosure">
      <summary className="roster-disclosure-trigger">Vložit z Excelu</summary>
      <div className="roster-paste-popover">
        <p
          id="juror-paste-help"
          className="my-3 max-w-2xl text-sm text-muted-foreground"
        >
          První sloupec jméno, druhý Technická nebo Veřejná (také T nebo V). Bez
          záhlaví, sloupce oddělené tabulátorem. Nové řádky zkontrolujete přímo
          v tabulce. Uloží se až tlačítkem Uložit tabulku; stejná jména zůstanou
          samostatná.
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
            setError('');
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-11 mt-3"
          disabled={disabled || !text}
          onClick={add}
        >
          Přidat řádky do tabulky
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
      </div>
    </details>
  );
}
