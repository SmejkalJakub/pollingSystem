import { useEffect, useRef } from 'react';
import { ResourceState } from '../admin/ResourceState';

export function ResultsState({
  resource,
}: {
  resource: {
    data?: unknown;
    loading: boolean;
    error?: unknown;
    reload: () => void;
  };
}) {
  const feedback = useRef<HTMLDivElement>(null);
  const recovering = useRef(false);
  useEffect(() => {
    if (resource.error) {
      recovering.current = true;
      feedback.current?.focus();
    } else if (recovering.current && resource.data) {
      recovering.current = false;
      document.getElementById('results-heading')?.focus();
    }
  }, [resource.error, resource.data]);
  return (
    <div
      ref={feedback}
      tabIndex={-1}
      className="outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <ResourceState resource={resource} />
    </div>
  );
}
