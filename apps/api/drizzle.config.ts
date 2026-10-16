import { defineConfig } from 'drizzle-kit';
import { readEnvironment } from './src/config';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: { url: readEnvironment().DATABASE_URL },
  strict: true,
});
