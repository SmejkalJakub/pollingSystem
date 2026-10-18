import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from './client';
import { readEnvironment } from '../config';

const environment = readEnvironment();
const { db, pool } = createDatabase(
  environment.MIGRATION_DATABASE_URL ?? environment.DATABASE_URL,
);
try {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)),
  });
  console.log('Database migrations applied.');
} finally {
  await pool.end();
}
