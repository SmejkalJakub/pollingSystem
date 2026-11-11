import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

function refreshStatus(loading: boolean, failed: boolean) {
  if (loading) {
    return 'Načítání aktuálního přehledu.';
  }
  if (failed) {
    return '';
  }
  return 'Přehled byl aktualizován.';
}

export function DashboardRefresh({
  resource,
  label = 'Obnovit data',
}: {
  label?: string;
  resource: {
    loading: boolean;
    error?: unknown;
    reload: () => void;
  };
}) {
  const button = useRef<HTMLButtonElement>(null);
  const requested = useRef(false);
  useEffect(() => {
    if (requested.current && !resource.loading) {
      requested.current = false;
      if (!resource.error) {
        button.current?.focus();
      }
    }
  }, [resource.loading, resource.error]);
  return (
    <>
      <Button
        ref={button}
        className="min-h-11 self-start"
        variant="outline"
        disabled={resource.loading}
        onClick={() => {
          requested.current = true;
          resource.reload();
        }}
      >
        {label}
      </Button>
      <span role="status" className="sr-only">
        {refreshStatus(resource.loading, Boolean(resource.error))}
      </span>
    </>
  );
}
