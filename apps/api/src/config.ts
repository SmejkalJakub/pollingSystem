import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});

const postgresUrl = z
  .url()
  .refine((value) => /^postgres(ql)?:\/\//.test(value), 'Use a PostgreSQL URL');

const environmentSchema = z.object({
  DATABASE_URL: postgresUrl,
  MIGRATION_DATABASE_URL: postgresUrl.optional(),
  JUROR_LINK_KEYS: z.string().optional(),
  JUROR_LINK_ACTIVE_KEY_ID: z.string().optional(),
  APP_ORIGIN: z
    .url()
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          url.origin === value &&
          (url.protocol === 'https:' ||
            (url.protocol === 'http:' &&
              ['localhost', '127.0.0.1'].includes(url.hostname)))
        );
      } catch {
        return false;
      }
    }, 'Use an HTTPS origin, or local HTTP for development')
    .default('http://127.0.0.1:5173'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  SERVE_WEB: z.enum(['true', 'false']).default('false'),
  TRUSTED_PROXY_CIDRS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.union([z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()]))),
});

export function readEnvironment(values: NodeJS.ProcessEnv = process.env) {
  const result = environmentSchema.safeParse(values);
  if (!result.success) {
    // Never include environment values (which can contain credentials) in errors.
    throw new Error(
      `Invalid configuration: ${[...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`,
    );
  }
  return result.data;
}
