import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dashboardQuerySchema, votingParamsSchema } from '@d21/contracts';
import { parseInput } from '../../validation';
import type { adminGuard } from '../auth/routes';
import type { DashboardService } from './service';

export async function registerDashboard(
  app: FastifyInstance,
  {
    service,
    guard,
    cookieName,
  }: {
    service: DashboardService;
    guard: ReturnType<typeof adminGuard>;
    cookieName: string;
  },
) {
  app.addHook('preHandler', guard);
  app.get('/dashboard/overview', (request) => {
    const { eventId } = parseInput(dashboardQuerySchema, request.query);
    return service.overview(request.cookies[cookieName], eventId);
  });
  app.get('/dashboard/votings/:votingId', (request) => {
    parseInput(z.strictObject({}), request.query);
    const { votingId } = parseInput(votingParamsSchema, request.params);
    return service.category(request.cookies[cookieName], votingId);
  });
}
