import Fastify from 'fastify';
import { AuthError, registerAuth } from './modules/auth/routes';
import type { AuthService } from './modules/auth/service';
import { healthResponseSchema, readinessResponseSchema } from '@d21/contracts';

type AppOptions = {
  checkDatabase: () => Promise<void>;
  logger?: boolean;
  auth?: { service: AuthService; origin: string };
};

export function buildApp({ checkDatabase, logger = false, auth }: AppOptions) {
  const app = Fastify({ logger, bodyLimit: 64 * 1024 });

  app.get('/health', () =>
    healthResponseSchema.parse({ status: 'ok', service: 'd21-api' }),
  );

  app.get('/ready', async (_request, reply) => {
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

  if (auth) app.register(registerAuth, auth);

  app.setNotFoundHandler((_request, reply) => {
    return reply
      .code(404)
      .send({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });

  app.setErrorHandler((error, request, reply) => {
    if (!(error instanceof AuthError)) request.log.error(error);
    const statusCode =
      error instanceof Error && 'statusCode' in error ? error.statusCode : 500;
    const status =
      typeof statusCode === 'number' &&
      statusCode >= 400 &&
      (statusCode < 500 || error instanceof AuthError)
        ? statusCode
        : 500;
    return reply.code(status).send({
      error: {
        code:
          error instanceof AuthError
            ? error.code
            : status === 429
              ? 'RATE_LIMITED'
              : status === 500
                ? 'INTERNAL_ERROR'
                : 'INVALID_REQUEST',
        message:
          error instanceof AuthError
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
