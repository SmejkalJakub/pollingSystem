import {
  healthResponseSchema,
  readinessResponseSchema,
  sessionResponseSchema,
  apiErrorSchema,
} from '@d21/contracts';

export async function checkServices(signal?: AbortSignal) {
  const [healthResponse, readinessResponse] = await Promise.all([
    fetch('/api/health', { signal }),
    fetch('/api/ready', { signal }),
  ]);
  if (!healthResponse.ok) throw new Error('API is unavailable.');
  const health = healthResponseSchema.parse(await healthResponse.json());
  // A 503 is an expected, typed readiness state, not a network error.
  if (!readinessResponse.ok && readinessResponse.status !== 503)
    throw new Error('Readiness check failed.');
  const readiness = readinessResponseSchema.parse(
    await readinessResponse.json(),
  );
  return { health, readiness };
}

// Cookies stay in the browser; never put a session token in JS storage.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export async function authRequest(
  path: string,
  options: { password?: string; logout?: boolean; signal?: AbortSignal } = {},
) {
  const mutating = options.password !== undefined || options.logout;
  const response = await fetch(`/api${path}`, {
    method: mutating ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal,
    headers: mutating
      ? { 'Content-Type': 'application/json', 'X-D21-Request': '1' }
      : {},
    body:
      options.password !== undefined
        ? JSON.stringify({ password: options.password })
        : options.logout
          ? '{}'
          : undefined,
  });
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(await response.json());
    throw new ApiError(
      response.status,
      error.success ? error.data.error.code : 'UNKNOWN',
    );
  }
  if (response.status === 204) return { authenticated: false } as const;
  return sessionResponseSchema.parse(await response.json());
}
