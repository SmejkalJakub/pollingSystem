import { juryGroupLabel } from '@d21/contracts';
import type { DashboardCategory } from '@d21/contracts';
import { lifecycleLabels, stateLabels } from './presentation';
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
      <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="font-mono">
          {submitted} / {expected}
        </span>
      </div>
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
export function CategoryCard({ category: c }: { category: DashboardCategory }) {
  return (
    <article className="min-w-0 border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="eyebrow">
          {c.kind === 'selection' ? 'Selekce' : 'Finále'}
        </span>
        <span
          className={
            c.state === 'problem'
              ? 'text-destructive'
              : c.state === 'done'
                ? 'text-ring'
                : ''
          }
        >
          {stateLabels[c.state]}
        </span>
      </div>
      <h3 className="mt-4 break-words text-xl font-semibold">
        <a className="wizard-link" href={`/admin/dashboard/votings/${c.id}`}>
          {c.name}
        </a>
      </h3>
      <p className="mt-2 break-words text-sm text-muted-foreground">
        {lifecycleLabels[c.status]} ·{' '}
        {c.groups
          .map((g) => `${juryGroupLabel(g.code)} — ${g.name}`)
          .join(', ') || 'Bez oprávněných částí poroty'}
      </p>
      <div className="mt-6">
        <Progress
          submitted={c.counts.submitted}
          expected={c.counts.expected}
          label="Odevzdané lístky"
        />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        {c.status === 'draft'
          ? 'Koncept se nezapočítává do celkového průběhu.'
          : `Čeká ${c.counts.pending} · Neplatné návrhy ${c.counts.invalid} · Uzamčené ${c.counts.locked}`}
      </p>
    </article>
  );
}
