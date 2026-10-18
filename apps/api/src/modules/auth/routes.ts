import { registerResults } from '../results/routes';
import type { ResultsService } from '../results/service';
import { registerDashboard } from '../dashboard/routes';
import type { DashboardService } from '../dashboard/service';
import { registerBallotAdmin } from '../ballots/routes';
import type { BallotAdminService } from '../ballots/admin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import {
  adminAccessResponseSchema,
  adminLoginSchema,
  jurorStartSchema,
  jurorStartResponseSchema,
  jurorParamsSchema,
  jurorLinkSchema,
} from '@d21/contracts';
import { z } from 'zod';
import { parseInput } from '../../validation';
import type { JurorAccessService } from './juror-access';
import type { AuthService } from './service';
import { SESSION_SECONDS } from './service';
import { PasswordBusyError } from './crypto';
import { registerEvents } from '../events/routes';
import type { EventService } from '../events/service';
import { registerVotings } from '../votings/routes';
import type { VotingService } from '../votings/service';
import { registerWizard } from '../wizard/routes';
import type { WizardService } from '../wizard/service';

import { AppError as AuthError } from '../../errors';
export { AppError as AuthError } from '../../errors';

type AuthOptions = {
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
export async function registerAuth(
  app: FastifyInstance,
  {
    service,
    origin,
    events,
    votings,
    wizard,
    jurorAccess,
    ballotAdmin,
    dashboard,
    results,
  }: AuthOptions,
) {
  const secure = new URL(origin).protocol === 'https:';
  const cookieName = secure ? '__Host-d21-session' : 'd21-session';
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'strict' as const,
    secure,
  };
  await app.register(cookie);
  await app.register(rateLimit, {
    global: false,
    max: 10,
    timeWindow: '1 minute',
    cache: 5000,
  });

  // Applied to this encapsulated API scope and any future modules registered here.
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('Referrer-Policy', 'no-referrer');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      if (
        request.headers['x-d21-request'] !== '1' ||
        (request.headers.origin !== undefined &&
          request.headers.origin !== origin) ||
        request.headers['sec-fetch-site'] === 'cross-site'
      ) {
        throw new AuthError(
          403,
          'FORBIDDEN_ORIGIN',
          'The request origin is not allowed.',
        );
      }
    }
  });

  app.post(
    '/auth/admin/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const input = adminLoginSchema.safeParse(request.body);
      if (!input.success)
        throw new AuthError(
          400,
          'INVALID_REQUEST',
          'Enter a password of at most 256 characters.',
        );
      let result;
      try {
        result = await service.login(
          input.data.password,
          request.cookies[cookieName],
        );
      } catch (error) {
        if (error instanceof PasswordBusyError)
          throw new AuthError(
            503,
            'AUTH_BUSY',
            'Sign-in is busy. Try again shortly.',
          );
        throw error;
      }
      if (!result)
        throw new AuthError(
          401,
          'INVALID_CREDENTIALS',
          'The password is incorrect.',
        );
      reply.setCookie(cookieName, result.token, {
        ...cookieOptions,
        maxAge: SESSION_SECONDS,
        expires: new Date(result.session.expiresAt!),
      });
      return result.session;
    },
  );

  app.get('/auth/session', async (request, reply) => {
    const session = await service.readSession(request.cookies[cookieName]);
    if (!session && request.cookies[cookieName])
      reply.clearCookie(cookieName, cookieOptions);
    return session ?? { authenticated: false };
  });

  app.post('/auth/logout', async (request, reply) => {
    await service.logout(request.cookies[cookieName]);
    reply.clearCookie(cookieName, cookieOptions);
    return reply.code(204).send();
  });

  const requireAdmin = adminGuard(service, cookieName);
  if (jurorAccess && wizard) {
    app.post(
      '/auth/juror/start',
      { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
      async (request, reply) => {
        const input = parseInput(jurorStartSchema, request.body);
        const result = await jurorAccess.start(
          input.eventId,
          input.token,
          request.cookies[cookieName],
        );
        const welcome = await wizard.current(result.token);
        // A browser-session cookie imposes no application-selected retention timeout.
        reply.setCookie(cookieName, result.token, cookieOptions);
        return jurorStartResponseSchema.parse({
          session: result.session,
          wizard: welcome,
        });
      },
    );
    app.get(
      '/events/:eventId/jurors/:jurorId/access',
      { preHandler: requireAdmin },
      (request) => {
        const { eventId, jurorId } = parseInput(
          jurorParamsSchema,
          request.params,
        );
        return jurorAccess.status(
          request.cookies[cookieName],
          eventId,
          jurorId,
        );
      },
    );
    app.post(
      '/events/:eventId/jurors/:jurorId/access',
      { preHandler: requireAdmin },
      async (request) => {
        const { eventId, jurorId } = parseInput(
          jurorParamsSchema,
          request.params,
        );
        parseInput(z.strictObject({}), request.body);
        const token = await jurorAccess.issue(
          request.cookies[cookieName],
          eventId,
          jurorId,
        );
        // Fragments are not sent in HTTP URLs, server access logs or referrers.
        return jurorLinkSchema.parse({
          url: `${origin}/#event=${eventId}&key=${token}`,
        });
      },
    );
    app.post(
      '/events/:eventId/jurors/:jurorId/access/copy',
      { preHandler: requireAdmin },
      async (request) => {
        const { eventId, jurorId } = parseInput(
          jurorParamsSchema,
          request.params,
        );
        parseInput(z.strictObject({}), request.body);
        parseInput(z.strictObject({}), request.query);
        const token = await jurorAccess.copy(
          request.cookies[cookieName],
          eventId,
          jurorId,
        );
        return jurorLinkSchema.parse({
          url: `${origin}/#event=${eventId}&key=${token}`,
        });
      },
    );
    app.post(
      '/events/:eventId/jurors/:jurorId/access/revoke',
      { preHandler: requireAdmin },
      async (request, reply) => {
        const { eventId, jurorId } = parseInput(
          jurorParamsSchema,
          request.params,
        );
        parseInput(z.strictObject({}), request.body);
        await jurorAccess.revoke(request.cookies[cookieName], eventId, jurorId);
        return reply.code(204).send();
      },
    );
  }
  if (results)
    await app.register(registerResults, {
      service: results,
      guard: requireAdmin,
      cookieName,
    });
  if (dashboard)
    await app.register(registerDashboard, {
      service: dashboard,
      guard: requireAdmin,
      cookieName,
    });
  if (ballotAdmin)
    await app.register(registerBallotAdmin, {
      service: ballotAdmin,
      guard: requireAdmin,
      cookieName,
    });
  if (wizard)
    await app.register(registerWizard, { service: wizard, cookieName });
  if (votings)
    await app.register(registerVotings, {
      service: votings,
      guard: requireAdmin,
      cookieName,
    });
  if (events)
    await app.register(registerEvents, {
      service: events,
      guard: requireAdmin,
      cookieName,
    });
  app.get('/admin/access', { preHandler: requireAdmin }, async (request) => {
    const session = await service.readSession(request.cookies[cookieName]);
    // A revocation between the guard and read must never become an internal error.
    if (!session || session.principal.kind !== 'admin')
      throw new AuthError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    return adminAccessResponseSchema.parse({
      principal: session.principal,
      permissions: ['administer'],
    });
  });
}

// Reuse this server-side guard on Phase 3+ administrative modules.
export function adminGuard(service: AuthService, cookieName: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await service.readSession(request.cookies[cookieName]);
    if (!session) {
      reply.clearCookie(cookieName, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: cookieName.startsWith('__Host-'),
      });
      throw new AuthError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    }
    if (session.principal.kind !== 'admin')
      throw new AuthError(
        403,
        'FORBIDDEN',
        'Administrative access is required.',
      );
  };
}
