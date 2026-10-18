import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

export function DashboardRefresh({
  resource,
}: {
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
      if (!resource.error) button.current?.focus();
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
        Obnovit data
      </Button>
      <span role="status" className="sr-only">
        {resource.loading
          ? 'Načítání aktuálního přehledu.'
          : resource.error
            ? ''
            : 'Přehled byl aktualizován.'}
      </span>
    </>
  );
}
