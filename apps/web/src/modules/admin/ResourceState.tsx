import { Button } from '@/components/ui/button';
import { managementError } from './api';
export function ResourceState({
  resource,
  errorTitle,
}: {
  errorTitle: string;
  resource: {
    data?: unknown;
    loading?: boolean;
    error?: unknown;
    reload: () => void;
  };
}) {
  if (resource.error)
    return (
      <div className="feedback-error mt-6">
        <div role="alert">
          <p className="feedback-error-title">{errorTitle}</p>
          <p>{managementError(resource.error)}</p>
        </div>
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
