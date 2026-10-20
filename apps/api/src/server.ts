import { createResultsService } from './modules/results/service';
import { createDashboardService } from './modules/dashboard/service';
import { createBallotAdminService } from './modules/ballots/admin';
import { createAuthService } from './modules/auth/service';
import { buildApp } from './app';
import { readEnvironment } from './config';
import { createDatabase } from './db/client';
import { createEventService } from './modules/events/service';
import { createVotingService } from './modules/votings/service';
import { createWizardService } from './modules/wizard/service';
import { createLinkVault } from './modules/auth/link-vault';
import { createJurorAccessService } from './modules/auth/juror-access';
import { fileURLToPath } from 'node:url';

const environment = readEnvironment();
const { pool } = createDatabase(environment.DATABASE_URL);
const auth = createAuthService(pool);
const linkVault = createLinkVault(
  environment.JUROR_LINK_KEYS,
  environment.JUROR_LINK_ACTIVE_KEY_ID,
);
const app = buildApp({
  logger: true,
  webRoot:
    environment.SERVE_WEB === 'true'
      ? fileURLToPath(new URL('../../web/dist', import.meta.url))
      : undefined,
  trustedProxy: environment.TRUSTED_PROXY_CIDRS,
  auth: {
    service: auth,
    origin: environment.APP_ORIGIN,
    events: createEventService(pool, auth, linkVault),
    votings: createVotingService(pool, auth),
    wizard: createWizardService(pool, auth),
    ballotAdmin: createBallotAdminService(pool, auth),
    dashboard: createDashboardService(pool, auth),
    results: createResultsService(pool, auth),
    jurorAccess: createJurorAccessService(pool, auth, linkVault),
  },
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
