import { useEffect, useState } from 'react';
import type { z } from 'zod';
import { ApiError } from '@/lib/api';
import { adminRequest } from './api';

export function useResource<T>(
  path: string,
  schema: z.ZodType<T>,
  onExpired: () => void,
) {
  const [state, setState] = useState<{
    data?: T;
    error?: unknown;
    loading: boolean;
  }>({ loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    adminRequest(path, schema, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) onExpired();
        else setState({ error, loading: false });
      });
    return () => controller.abort();
  }, [path, schema, revision, onExpired]);
  return {
    ...state,
    reload() {
      setState((current) => ({ data: current.data, loading: true }));
      setRevision((value) => value + 1);
    },
  };
}
