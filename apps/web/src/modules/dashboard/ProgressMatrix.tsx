import {
  juryGroupLabel,
  type DashboardCategory,
  type JurorProgress,
  type Roster,
} from '@d21/contracts';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { JurorControls } from '../admin/JurorControls';
import { progressLabels } from './presentation';

const cellLabels: Record<JurorProgress, string> = {
  ...progressLabels,
  submitted: '✓ Odevzdáno',
  in_progress: 'Rozpracováno',
  invalid_draft: '! Neplatný návrh',
  not_started: 'Bez návrhu',
};

export function ProgressMatrix({
  eventId,
  categories,
  roster,
  disabled,
  reload,
  onExpired,
  categoryId,
}: {
  eventId: string;
  categories: DashboardCategory[];
  roster?: Roster;
  disabled: boolean;
  reload: () => void;
  onExpired: () => void;
  categoryId: string | null;
}) {
  const [filter, setFilter] = useState<'pending' | 'all' | 'T' | 'V'>(
    'pending',
  );
  const [openPanel, setOpenPanel] = useState<string>();
  const columns = categories.filter((category) => category.status === 'active');
  const scope = columns.find((category) => category.id === categoryId);
  const jurors = new Map<
    string,
    { id: string; name: string; code?: 'T' | 'V' }
  >();
  for (const juror of roster?.jurors ?? []) {
    jurors.set(juror.id, {
      id: juror.id,
      name: juror.displayName,
      code: roster?.groups.find((group) => group.id === juror.juryGroupId)
        ?.code,
    });
  }
  const cells = columns.map((category) => {
    for (const juror of category.jurors) {
      jurors.set(juror.id, {
        id: juror.id,
        name: juror.displayName,
        code: category.groups.find((group) => group.id === juror.groupId)?.code,
      });
    }
    return new Map(category.jurors.map((juror) => [juror.id, juror.progress]));
  });
  const pending = new Set(
    (scope ? [scope] : columns).flatMap((category) =>
      category.jurors
        .filter((juror) => juror.progress !== 'submitted')
        .map((juror) => juror.id),
    ),
  );
  const rosterById = new Map(roster?.jurors.map((juror) => [juror.id, juror]));
  const nameCounts = new Map<string, number>();
  for (const { name } of jurors.values()) {
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  const visible = [...jurors.values()]
    .filter(
      (juror) =>
        filter === 'all' ||
        (filter === 'pending' ? pending.has(juror.id) : juror.code === filter),
    )
    .sort(
      (a, b) => a.name.localeCompare(b.name, 'cs') || a.id.localeCompare(b.id),
    );
  const filters = [
    ['pending', `Čekající (${pending.size})`],
    ['all', `Všichni (${jurors.size})`],
    ['T', 'Technická'],
    ['V', 'Veřejná'],
  ] as const;
  return (
    <section className="min-w-0" aria-label="Porotci podle kategorií">
      {scope && (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
          <span>Čekající v kategorii {scope.name}</span>
          <a
            className="wizard-link"
            href={`/admin/events/${eventId}/dashboard`}
          >
            Zrušit výběr kategorie
          </a>
        </div>
      )}
      <div
        role="group"
        aria-label="Filtrovat porotce"
        className="mb-3 flex flex-wrap gap-2"
      >
        {filters.map(([value, label]) => (
          <Button
            key={value}
            variant="outline"
            className="operations-filter"
            aria-pressed={filter === value}
            disabled={Boolean(openPanel)}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {!columns.length && (
        <p className="mb-3 text-sm text-muted-foreground">
          Žádná kategorie není otevřená.
        </p>
      )}
      {visible.length > 0 ? (
        <div
          className="operations-scroll"
          tabIndex={0}
          role="region"
          aria-label="Matice průběhu"
        >
          <table className="operations-table text-sm">
            <caption>
              Porotci × otevřené kategorie. Řádek obsahuje vše potřebné k
              urgování porotce.
            </caption>
            <thead>
              <tr>
                <th scope="col">Porotce</th>
                {columns.map((category) => (
                  <th key={category.id} scope="col" className="min-w-36">
                    <a
                      className="operations-head-link break-words"
                      href={`/admin/dashboard/votings/${category.id}`}
                    >
                      {category.name}
                    </a>{' '}
                    <span className="operations-head-count whitespace-nowrap">
                      · {category.counts.submitted}/{category.counts.expected}
                    </span>
                  </th>
                ))}
                <th scope="col" className="operations-actions min-w-44">
                  Akce
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((juror) => {
                const member = rosterById.get(juror.id);
                const menuLinks = columns.flatMap((category, index) => {
                  const progress = cells[index]?.get(juror.id);
                  if (!progress) {
                    return [];
                  }
                  const links = [
                    {
                      href: `/admin/results/votings/${category.id}`,
                      label: `Zobrazit hlasy · ${category.name}`,
                    },
                  ];
                  if (progress === 'submitted') {
                    links.push({
                      href: `/admin/dashboard/votings/${category.id}?unlock=${juror.id}`,
                      label: `Odemknout odevzdaný lístek… · ${category.name}`,
                    });
                  }
                  return links;
                });
                return (
                  <tr key={juror.id}>
                    <th scope="row" className="font-semibold">
                      {juror.name}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {juryGroupLabel(juror.code)}
                        {(nameCounts.get(juror.name) ?? 0) > 1 &&
                          ` · ID ${juror.id.slice(0, 8)}`}
                      </span>
                    </th>
                    {columns.map((category, index) => {
                      const status = cells[index]?.get(juror.id);
                      return (
                        <td key={category.id}>
                          {status ? (
                            <span
                              className="operations-pill"
                              data-progress={status}
                            >
                              {cellLabels[status]}
                            </span>
                          ) : (
                            <span className="text-[13px] text-muted-foreground">
                              — nehlasuje
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="operations-actions">
                      {member && roster ? (
                        <JurorControls
                          juror={member}
                          locked={roster.locked}
                          allowRemoval={false}
                          menuLinks={menuLinks}
                          disabled={
                            disabled ||
                            Boolean(openPanel && openPanel !== juror.id)
                          }
                          copyDisabled={disabled || Boolean(openPanel)}
                          reload={reload}
                          onExpired={onExpired}
                          onPanelChange={(open) =>
                            setOpenPanel(open ? juror.id : undefined)
                          }
                        />
                      ) : (
                        menuLinks.map((link) => (
                          <a
                            key={link.href}
                            className="wizard-link block"
                            href={link.href}
                          >
                            {link.label}
                          </a>
                        ))
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          Tomuto filtru neodpovídá žádný porotce.
        </p>
      )}
    </section>
  );
}
