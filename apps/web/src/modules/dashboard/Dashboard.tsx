import { useState } from 'react';
import { EventHeading } from '../admin/EventNavigation';
import {
  dashboardOverviewSchema,
  type DashboardCategory,
} from '@d21/contracts';
import { DashboardRefresh } from './DashboardRefresh';
import { useResource } from '../admin/useResource';
import { DashboardState } from './DashboardState';
import { CategoryCard, Progress } from './CategoryCard';
import { problemLabels, progressLabels, timestamp } from './presentation';

function JurorOverview({ categories }: { categories: DashboardCategory[] }) {
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const byJuror = new Map<
    string,
    {
      id: string;
      name: string;
      group: string;
      tasks: {
        category: DashboardCategory;
        progress: DashboardCategory['jurors'][number]['progress'];
      }[];
    }
  >();
  for (const category of categories.filter((c) => c.status !== 'draft')) {
    for (const j of category.jurors) {
      const current = byJuror.get(j.id) ?? {
        id: j.id,
        name: j.displayName,
        group: category.groups.find((g) => g.id === j.groupId)?.code ?? '',
        tasks: [],
      };
      current.tasks.push({ category, progress: j.progress });
      byJuror.set(j.id, current);
    }
  }
  const visible = [...byJuror.values()]
    .filter(
      (j) =>
        (filter === 'all' || j.tasks.some((t) => t.progress !== 'submitted')) &&
        `${j.name} ${j.id}`
          .toLocaleLowerCase('cs')
          .includes(search.toLocaleLowerCase('cs')),
    )
    .sort(
      (a, b) => a.name.localeCompare(b.name, 'cs') || a.id.localeCompare(b.id),
    );
  return (
    <section className="mt-12" aria-labelledby="jurors-heading">
      <h2 id="jurors-heading" className="text-2xl font-semibold">
        Porotci a zbývající kategorie
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Pouze oprávnění ke spuštěným kategoriím. Rozbalte porotce pro detail;
        shodná jména rozlišuje ID.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Zobrazit
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'pending' | 'all')}
            className="mt-2 min-h-11 w-full rounded-sm border bg-card px-3 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <option value="pending">Čekající porotce</option>
            <option value="all">Všechny oprávněné porotce</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Hledat jméno nebo ID
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-sm border bg-card px-3 focus-visible:outline-2 focus-visible:outline-ring"
            type="search"
          />
        </label>
      </div>
      <p className="mt-4 text-sm text-muted-foreground" role="status">
        Zobrazeno porotců: {visible.length}
      </p>
      <div className="mt-3 divide-y divide-border border-y border-border">
        {visible.map((j) => (
          <details key={j.id} className="py-2">
            <summary className="min-h-11 cursor-pointer break-words py-3 text-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">
              <span className="font-medium">{j.name}</span> · {j.group} ·
              Odevzdáno{' '}
              {j.tasks.filter((t) => t.progress === 'submitted').length} /{' '}
              {j.tasks.length}
              <span className="mt-1 block break-all pl-4 font-mono text-xs text-muted-foreground">
                {j.id}
              </span>
            </summary>
            <ul className="space-y-2 pb-4 pl-4 text-sm">
              {j.tasks.map((t) => (
                <li
                  key={t.category.id}
                  className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                >
                  <a
                    className="wizard-link min-w-0 break-words"
                    href={`/admin/dashboard/votings/${t.category.id}`}
                  >
                    {t.category.name}
                  </a>
                  <span className="shrink-0 text-muted-foreground">
                    {progressLabels[t.progress]}
                    {t.category.status !== 'active' &&
                    t.progress !== 'submitted'
                      ? ' · Kategorie uzavřená'
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      {!visible.length && (
        <p className="mt-5 text-muted-foreground">
          {byJuror.size
            ? 'Tomuto filtru neodpovídá žádný porotce.'
            : 'Zatím nejsou spuštěné kategorie s oprávněnými porotci.'}
        </p>
      )}
    </section>
  );
}
export function Dashboard({
  eventId,
  onExpired,
}: {
  eventId: string;
  onExpired: () => void;
}) {
  const resource = useResource(
    `/dashboard/overview?eventId=${eventId}`,
    dashboardOverviewSchema,
    onExpired,
  );
  const data = resource.data;
  return (
    <>
      <DashboardState resource={resource} />
      {data && (
        <>
          <EventHeading event={data.event} section="progress" />
          <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <h2
              id="dashboard-heading"
              tabIndex={-1}
              className="outline-none min-w-0 break-words text-xl font-semibold tracking-tight sm:text-2xl"
            >
              Průběh hlasování
            </h2>
            <DashboardRefresh resource={resource} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Data k {timestamp(data.asOf)}. Obnovte přehled pro aktuální stav.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4">
            {[
              [
                'Odevzdané lístky',
                `${data.totals.submitted} / ${data.totals.expected}`,
              ],
              [
                'Dokončené kategorie',
                `${data.totals.completedCategories} / ${data.totals.categories}`,
              ],
              ['Čekající porotci', data.totals.pendingJurors],
              ['Kategorie ke kontrole', data.totals.problemCategories],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 bg-card p-4">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="mt-3 break-words font-mono text-2xl font-medium sm:text-3xl">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-6">
            <Progress
              {...data.totals}
              label="Celkový průběh spuštěných kategorií"
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Počítáme aktuálně odevzdané lístky vůči oprávněným dvojicím porotce
            a kategorie. Koncepty se nezapočítávají. Hotovo znamená odevzdání
            všech očekávaných lístků bez zjištěného problému; kategorii tím
            neuzavíráme.
          </p>
          <section
            className="mt-10 border-l-2 border-primary pl-5"
            aria-labelledby="attention-heading"
          >
            <h2 id="attention-heading" className="text-xl font-semibold">
              Ke kontrole
            </h2>
            {data.totals.problemCategories ? (
              <ul className="mt-3 space-y-4">
                {data.categories
                  .filter((c) => c.status !== 'draft' && c.problems.length)
                  .map((c) => (
                    <li key={c.id}>
                      <a
                        className="wizard-link break-words font-medium"
                        href={`/admin/dashboard/votings/${c.id}`}
                      >
                        {c.name}
                      </a>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {c.problems.map((p) => (
                          <li key={p}>{problemLabels[p]}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                V uložených datech spuštěných kategorií nebyl zjištěn problém.
              </p>
            )}
          </section>
          <section className="mt-12" aria-labelledby="categories-heading">
            <h2 id="categories-heading" className="text-2xl font-semibold">
              Kategorie ({data.categories.length})
            </h2>
            {data.categories.length ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {data.categories.map((c) => (
                  <CategoryCard key={c.id} category={c} />
                ))}
              </div>
            ) : (
              <p className="mt-5 text-muted-foreground">
                Zatím nejsou vytvořené kategorie. Připravte je v části Příprava
                → Kategorie.
              </p>
            )}
          </section>
          <JurorOverview categories={data.categories} />
        </>
      )}
    </>
  );
}
