import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resultsQuerySchema, votingParamsSchema } from '@d21/contracts';
import { parseInput } from '../../validation';
import type { adminGuard } from '../auth/routes';
import type { ResultsService } from './service';

export async function registerResults(
  app: FastifyInstance,
  {
    service,
    guard,
    cookieName,
  }: {
    service: ResultsService;
    guard: ReturnType<typeof adminGuard>;
    cookieName: string;
  },
) {
  app.addHook('preHandler', guard);
  app.get('/results/export.xlsx', async (request, reply) => {
    const { eventId } = parseInput(resultsQuerySchema, request.query);
    const buffer = await service.exportWorkbook(
      request.cookies[cookieName],
      eventId,
    );
    return reply
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header(
        'Content-Disposition',
        `attachment; filename="d21-${eventId}.xlsx"`,
      )
      .header('X-Content-Type-Options', 'nosniff')
      .send(buffer);
  });
  app.get('/results/overview', (request) => {
    const { eventId } = parseInput(resultsQuerySchema, request.query);
    return service.overview(request.cookies[cookieName], eventId);
  });
  app.get('/results/votings/:votingId', (request) => {
    parseInput(z.strictObject({}), request.query);
    const { votingId } = parseInput(votingParamsSchema, request.params);
    return service.category(request.cookies[cookieName], votingId);
  });
}
