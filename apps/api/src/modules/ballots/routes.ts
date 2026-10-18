import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  adminBallotParamsSchema,
  ballotUnlockInputSchema,
  votingParamsSchema,
} from '@d21/contracts';
import { parseInput } from '../../validation';
import type { adminGuard } from '../auth/routes';
import type { BallotAdminService } from './admin';

export async function registerBallotAdmin(
  app: FastifyInstance,
  {
    service,
    guard,
    cookieName,
  }: {
    service: BallotAdminService;
    guard: ReturnType<typeof adminGuard>;
    cookieName: string;
  },
) {
  app.addHook('preHandler', guard);
  app.addHook('preHandler', async (request) => {
    parseInput(z.strictObject({}), request.query);
  });
  app.get('/votings/:votingId/ballots', (request) => {
    const { votingId } = parseInput(votingParamsSchema, request.params);
    return service.list(request.cookies[cookieName], votingId);
  });
  app.post('/votings/:votingId/ballots/:ballotId/unlock', (request) => {
    const { votingId, ballotId } = parseInput(
      adminBallotParamsSchema,
      request.params,
    );
    const { expectedRevision } = parseInput(
      ballotUnlockInputSchema,
      request.body,
    );
    return service.unlock(
      request.cookies[cookieName],
      votingId,
      ballotId,
      expectedRevision,
    );
  });
}
