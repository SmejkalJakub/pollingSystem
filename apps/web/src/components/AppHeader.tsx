import type { ReactNode } from 'react';

export function AppHeader({
  section,
  actions,
}: {
  section?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6">
        <a
          href="/"
          className="flex min-h-11 items-center gap-2 font-semibold outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="D21 Hlasování — úvod"
        >
          <span className="bg-primary px-2 py-1 text-sm text-primary-foreground">
            D21
          </span>
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
