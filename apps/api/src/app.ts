import type { ResultsService } from './modules/results/service';
import type { DashboardService } from './modules/dashboard/service';
import type { BallotAdminService } from './modules/ballots/admin';
import Fastify from 'fastify';
import staticFiles from '@fastify/static';
import { registerAuth } from './modules/auth/routes';
import { AppError } from './errors';
import type { AuthService } from './modules/auth/service';
import type { EventService } from './modules/events/service';
import type { VotingService } from './modules/votings/service';
import type { WizardService } from './modules/wizard/service';
import type { JurorAccessService } from './modules/auth/juror-access';
import { healthResponseSchema, readinessResponseSchema } from '@d21/contracts';

type AppOptions = {
  checkDatabase: () => Promise<void>;
  logger?: boolean;
  webRoot?: string;
  trustedProxy?: string[];
  auth?: {
    service: AuthService;
    origin: string;
    events?: EventService;
    votings?: VotingService;
    wizard?: WizardService;
    jurorAccess?: JurorAccessService;
    ballotAdmin?: BallotAdminService;
    dashboard?: DashboardService;
    results?: ResultsService;
  };
};

export function buildApp({
  checkDatabase,
  logger = false,
  auth,
  webRoot,
  trustedProxy = [],
}: AppOptions) {
  const app = Fastify({
    logger,
    bodyLimit: 64 * 1024,
    trustProxy: trustedProxy.length ? trustedProxy : false,
  });
  const apiPrefix = webRoot ? '/api' : '';

  app.get(`${apiPrefix}/health`, () =>
    healthResponseSchema.parse({ status: 'ok', service: 'd21-api' }),
  );

  app.get(`${apiPrefix}/ready`, async (_request, reply) => {
    try {
      await checkDatabase();
      return readinessResponseSchema.parse({
        status: 'ready',
        database: 'connected',
      });
    } catch {
      reply.code(503);
      return readinessResponseSchema.parse({
        status: 'unavailable',
        database: 'unavailable',
      });
    }
  });

  if (auth) app.register(registerAuth, { ...auth, prefix: apiPrefix });

  if (webRoot) {
    app.register(staticFiles, {
      root: webRoot,
      wildcard: false,
      cacheControl: false,
    });
    app.addHook('onSend', async (_request, reply) => {
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Referrer-Policy', 'no-referrer');
      reply.header('Cache-Control', 'no-store');
    });
  }

  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?')[0]!;
    if (
      webRoot &&
      ['GET', 'HEAD'].includes(request.method) &&
      !path.startsWith('/api') &&
      !path.startsWith('/assets/') &&
      request.headers.accept?.includes('text/html')
    ) {
      return reply.sendFile('index.html');
    }
    return reply
      .code(404)
      .send({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });

  app.setErrorHandler((error, request, reply) => {
    if (!(error instanceof AppError)) request.log.error(error);
    const dependencyUnavailable =
      !(error instanceof AppError) &&
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      [
        '55P03',
        '57014',
        '57P01',
        '08006',
        '53300',
        'ECONNREFUSED',
        'ETIMEDOUT',
      ].includes(String(error.code));
    const statusCode =
      error instanceof Error && 'statusCode' in error ? error.statusCode : 500;
    const status = dependencyUnavailable
      ? 503
      : typeof statusCode === 'number' &&
          statusCode >= 400 &&
          (statusCode < 500 || error instanceof AppError)
        ? statusCode
        : 500;
    return reply.code(status).send({
      error: {
        code: dependencyUnavailable
          ? 'DEPENDENCY_UNAVAILABLE'
          : error instanceof AppError
            ? error.code
            : status === 429
              ? 'RATE_LIMITED'
              : status === 500
                ? 'INTERNAL_ERROR'
                : 'INVALID_REQUEST',
        message: dependencyUnavailable
          ? 'The service is temporarily unavailable. Try again.'
          : error instanceof AppError
            ? error.message
            : status === 429
              ? 'Too many attempts. Try again shortly.'
              : status === 500
                ? 'An unexpected error occurred.'
                : 'The request could not be processed.',
      },
    });
  });

  return app;
}
