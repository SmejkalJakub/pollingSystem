import { Button } from '@/components/ui/button';
import type { DashboardCategory } from '@d21/contracts';
import { lifecycleLabels } from './presentation';
import { VotingLifecycleActions } from '../admin/VotingLifecycleActions';
export function Progress({
  submitted,
  expected,
  label,
}: {
  submitted: number;
  expected: number;
  label: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] text-muted-foreground">
        {label}{' '}
        <strong className="text-foreground tabular-nums">
          {submitted} / {expected}
        </strong>
      </p>
      {expected > 0 ? (
        <progress
          aria-label={label}
          value={submitted}
          max={expected}
          className="dashboard-progress h-2 w-full"
        />
      ) : (
        <p className="text-sm text-muted-foreground">Bez oprávněných porotců</p>
      )}
    </div>
  );
}
export function CategoryCard({
  category: c,
  onExpired,
  onChanged,
  disabled,
}: {
  category: DashboardCategory;
  onExpired: () => void;
  onChanged: () => void;
  disabled: boolean;
}) {
  return (
    <article aria-label={c.name} className="operations-open-card">
      <div>
        <h2>
          <a
            className="operations-head-link"
            href={`/admin/dashboard/votings/${c.id}`}
          >
            {c.name}
          </a>
        </h2>
        <p>
          {lifecycleLabels[c.status]} · {c.counts.submitted} z{' '}
          {c.counts.expected} odevzdáno
        </p>
      </div>
      <Button asChild variant="outline" className="min-h-11">
        <a href={`/admin/results/votings/${c.id}`}>
          {c.status === 'active' ? 'Průběžné výsledky' : 'Výsledky'}
        </a>
      </Button>
      <VotingLifecycleActions
        voting={c}
        onExpired={onExpired}
        onChanged={onChanged}
        disabled={disabled}
        closeConfirmation
        closeLabel="Uzavřít hlasování…"
      />
    </article>
  );
}
