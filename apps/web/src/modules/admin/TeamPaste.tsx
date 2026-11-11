import { useEffect, useRef, useState } from 'react';
import type { TeamTableRow } from '@d21/contracts';
import { Button } from '@/components/ui/button';
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
    if (error) {
      feedback.current?.focus();
    }
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
    if (problem) {
      return;
    }
    append(rows);
    setText('');
  }
  return (
    <aside className="roster-paste-aside" aria-labelledby="team-paste-heading">
      <h2 id="team-paste-heading">Vložit více týmů najednou</h2>
      <p id="team-paste-help">
        Zkopírujte dva sloupce z Excelu (název, popis) a vložte je sem. Před
        uložením uvidíte náhled.
      </p>
      <label htmlFor="team-paste">Data z tabulky</label>
      <textarea
        id="team-paste"
        aria-describedby="team-paste-help"
        rows={6}
        placeholder={'Atlas\tPlánování směn…'}
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
        className="min-h-11"
        disabled={disabled || !text}
        onClick={add}
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
    </aside>
  );
}
