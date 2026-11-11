import type { z } from 'zod';
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

type RequestOptions = {
  method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
};

export async function apiFetch(path: string, options: RequestOptions = {}) {
  const body =
    options.body === undefined ? undefined : JSON.stringify(options.body);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: options.signal,
      headers: options.method
        ? { 'Content-Type': 'application/json', 'X-D21-Request': '1' }
        : {},
      body,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(0, 'CONNECTION_FAILED');
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => undefined);
    const error = apiErrorSchema.safeParse(payload);
    throw new ApiError(
      response.status,
      error.success ? error.data.error.code : 'UNKNOWN',
    );
  }
  return response;
}

export async function authRequest(
  path: string,
  options: { password?: string; logout?: boolean; signal?: AbortSignal } = {},
) {
  const mutation = options.password !== undefined || options.logout;
  const response = await apiFetch(path, {
    signal: options.signal,
    method: mutation ? 'POST' : undefined,
    body: mutation ? { password: options.password } : undefined,
  });
  if (response.status === 204) return { authenticated: false } as const;
  return parseResponse(response, sessionResponseSchema);
}

async function parseResponse<T>(response: Response, schema: z.ZodType<T>) {
  try {
    return schema.parse(
      response.status === 204 ? undefined : await response.json(),
    );
  } catch {
    throw new ApiError(response.status, 'UNEXPECTED_RESPONSE');
  }
}

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options?: RequestOptions,
): Promise<T> {
  return parseResponse(await apiFetch(path, options), schema);
}

export function requestProblem(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'CONNECTION_FAILED':
        return 'Prohlížeč se nedokázal spojit se serverem. Zkontrolujte připojení a zkuste to znovu.';
      case 'UNEXPECTED_RESPONSE':
        return 'Server vrátil odpověď v neočekávaném formátu. Obnovte stránku. Pokud se chyba opakuje, kontaktujte správce.';
      case 'DEPENDENCY_UNAVAILABLE':
        return 'Služba potřebná k dokončení požadavku je nedostupná. Zkuste to za chvíli. Pokud potíže trvají, kontaktujte správce.';
      case 'FORBIDDEN_ORIGIN':
        return 'Server nepovolil požadavek z této adresy. Otevřete aplikaci na adrese od organizátora.';
      case 'AUTH_BUSY':
        return 'Server právě ověřuje příliš mnoho přihlášení. Počkejte chvíli a zkuste to znovu.';
    }
    switch (error.status) {
      case 400:
        return 'Server odmítl odeslané údaje. Zkontrolujte hodnoty a zkuste to znovu.';
      case 401:
        return 'Přihlášení vypršelo. Přihlaste se znovu.';
      case 403:
        return 'Pro tuto akci nemáte oprávnění. Kontaktujte organizátora.';
      case 404:
        return 'Záznam nebyl nalezen. Vraťte se do seznamu a ověřte, že je stále dostupný.';
      case 409:
        return 'Požadavek je v rozporu s aktuálním stavem dat. Obnovte přehled a zkontrolujte, co se změnilo.';
      case 413:
        return 'Odeslaná data jsou příliš velká. Zmenšete počet řádků a zkuste to po částech.';
      case 429:
        return 'Příliš mnoho požadavků v krátké době. Počkejte chvíli a zkuste to znovu.';
      case 502:
      case 504:
        return 'Server aplikace neodpověděl včas nebo je nedostupný. Zkuste to za chvíli.';
      case 503:
        return 'Server je dočasně nedostupný. Zkuste to za chvíli.';
    }
    if (error.status >= 500)
      return 'Na serveru došlo k chybě. Zkuste to znovu a při opakování kontaktujte správce.';
  }
  return 'Operaci se nepodařilo potvrdit. Zkontrolujte aktuální stav a při opakování kontaktujte správce.';
}
