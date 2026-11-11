import { useEffect, useRef, useState } from 'react';
import type { TeamTableRow } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { controlClass } from './MutationForm';
import { useAdminLeaveWarning } from './navigation';
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
  useAdminLeaveWarning(Boolean(text));
  const [error, setError] = useState('');
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) feedback.current?.focus();
  }, [error]);
  function add() {
    const parsed = parseTeamPaste(text);
    const rows = parsed.rows.map((row) => ({
      ...row,
      id: crypto.randomUUID(),
    }));
    const issues = teamRowIssues(rows);
    const problem =
      parsed.error ||
      (!rows.length ? 'Vložte alespoň jeden řádek.' : '') ||
      issues.map((issue) => teamFieldError(issue.field)).join(' ');
    setError(problem);
    if (problem) return;
    append(rows);
    setText('');
  }
  return (
    <details className="mt-5 border-y border-border py-2">
      <summary className="min-h-11 cursor-pointer py-3 font-medium outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">
        Vložit ze spreadsheetu
      </summary>
      <p
        id="team-paste-help"
        className="my-3 max-w-2xl text-sm text-muted-foreground"
      >
        První sloupec název, druhý nepovinný popis. Bez záhlaví, sloupce
        oddělené tabulátorem. Nové řádky zkontrolujete přímo v tabulce. Uloží se
        až tlačítkem Uložit tabulku; stejná jména zůstanou samostatná.
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
    </details>
  );
}
