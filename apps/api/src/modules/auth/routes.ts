import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { adminAccessResponseSchema, adminLoginSchema } from '@d21/contracts';
import type { AuthService } from './service';
import { SESSION_SECONDS } from './service';
import { PasswordBusyError } from './crypto';

export class AuthError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

type AuthOptions = { service: AuthService; origin: string };
export async function registerAuth(
  app: FastifyInstance,
  { service, origin }: AuthOptions,
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
        expires: new Date(result.session.expiresAt),
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
