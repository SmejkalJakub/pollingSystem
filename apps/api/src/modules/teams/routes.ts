import type { FastifyInstance } from 'fastify';
import {
  eventParamsSchema,
  teamParamsSchema,
  teamInputSchema,
  teamPatchSchema,
  teamTableInputSchema,
  teamTableSaveSchema,
  votingActionSchema,
} from '@d21/contracts';
import { parseInput } from '../../validation';
import type { TeamService } from './service';
// Registered only inside registerVotings, inheriting its adminGuard and auth scope.
export async function registerTeams(
  app: FastifyInstance,
  {
    service,
    cookieName,
  }: {
    service: (token: string | undefined) => TeamService;
    cookieName: string;
  },
) {
  app.get('/events/:eventId/teams/table', (request) => {
    parseInput(votingActionSchema, request.query);
    return service(request.cookies[cookieName]).table(
      parseInput(eventParamsSchema, request.params).eventId,
    );
  });
  app.put('/events/:eventId/teams/table', async (request) => {
    parseInput(votingActionSchema, request.query);
    return teamTableSaveSchema.parse(
      await service(request.cookies[cookieName]).saveTable(
        parseInput(eventParamsSchema, request.params).eventId,
        parseInput(teamTableInputSchema, request.body),
      ),
    );
  });
  app.get('/events/:eventId/teams', (request) =>
    service(request.cookies[cookieName]).list(
      parseInput(eventParamsSchema, request.params).eventId,
    ),
  );
  app.post('/events/:eventId/teams', async (request, reply) => {
    const { eventId } = parseInput(eventParamsSchema, request.params);
    return reply
      .code(201)
      .send(
        await service(request.cookies[cookieName]).create(
          eventId,
          parseInput(teamInputSchema, request.body),
        ),
      );
  });
  app.patch('/events/:eventId/teams/:teamId', (request) => {
    const { eventId, teamId } = parseInput(teamParamsSchema, request.params);
    return service(request.cookies[cookieName]).update(
      eventId,
      teamId,
      parseInput(teamPatchSchema, request.body),
    );
  });
}
