import type { ReactNode } from 'react';

export function AppHeader({
  section,
  actions,
}: {
  section?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="app-header">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a
          href={section === 'Administrace' ? '/admin/events' : '/'}
          className="flex min-h-11 items-center gap-2 font-semibold outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={
            section === 'Administrace'
              ? 'D21 Hlasování — eventy'
              : 'D21 Hlasování — úvod'
          }
        >
          <span className="brand-mark">D21</span>
          Hlasování
        </a>
        {actions ??
          (section && (
            <span className="text-sm text-muted-foreground">{section}</span>
          ))}
      </div>
    </header>
  );
}
