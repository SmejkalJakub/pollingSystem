import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});

const environmentSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine(
      (value) => /^postgres(ql)?:\/\//.test(value),
      'Use a PostgreSQL URL',
    ),
  APP_ORIGIN: z
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.origin === value &&
        (url.protocol === 'https:' ||
          (url.protocol === 'http:' &&
            ['localhost', '127.0.0.1'].includes(url.hostname)))
      );
    }, 'Use an HTTPS origin, or local HTTP for development')
    .default('http://127.0.0.1:5173'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});

export function readEnvironment() {
  const result = environmentSchema.safeParse(process.env);
  if (!result.success) {
    // Never include environment values (which can contain credentials) in errors.
    throw new Error(
      `Invalid configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  }
  return result.data;
}
