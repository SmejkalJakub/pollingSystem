import { createAuthService } from './modules/auth/service';
import { buildApp } from './app';
import { readEnvironment } from './config';
import { createDatabase } from './db/client';

const environment = readEnvironment();
const { pool } = createDatabase(environment.DATABASE_URL);
const app = buildApp({
  logger: true,
  auth: { service: createAuthService(pool), origin: environment.APP_ORIGIN },
  checkDatabase: async () => {
    await pool.query('select 1');
  },
});

pool.on('error', (error) =>
  app.log.error(error, 'Unexpected idle database connection error'),
);
app.addHook('onClose', async () => {
  await pool.end();
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.close().catch((error: unknown) => {
      app.log.error(error);
      process.exitCode = 1;
    });
  });
}

try {
  await app.listen({ host: environment.API_HOST, port: environment.API_PORT });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
