import { Button } from '@/components/ui/button';
import { managementError } from './api';
export function ResourceState({
  resource,
}: {
  resource: {
    data?: unknown;
    loading?: boolean;
    error?: unknown;
    reload: () => void;
  };
}) {
  if (resource.error)
    return (
      <div className="mt-8 border border-border bg-card p-6">
        <p role="alert">{managementError(resource.error)}</p>
        <Button
          onClick={resource.reload}
          variant="outline"
          className="mt-4 min-h-11"
        >
          Zkusit znovu
        </Button>
      </div>
    );
  if (resource.loading || resource.data === undefined)
    return (
      <p role="status" className="mt-8 text-muted-foreground">
        Načítání…
      </p>
    );
  return null;
}
