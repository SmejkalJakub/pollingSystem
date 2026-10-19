import type { FastifyInstance } from 'fastify';
import {
  eventParamsSchema,
  groupParamsSchema,
  jurorParamsSchema,
  juryGroupInputSchema,
  juryGroupPatchSchema,
  jurorInputSchema,
  jurorPatchSchema,
  jurorSchema,
  jurorTableInputSchema,
  jurorTableSaveSchema,
  votingActionSchema,
} from '@d21/contracts';
import { parseInput } from '../../validation';
import type { createJuryService } from './service';

// Inherits the events module's admin guard and the authentication origin/cookie scope.
export async function registerJurors(
  app: FastifyInstance,
  {
    service,
    cookieName,
  }: {
    service: (
      token: string | undefined,
    ) => ReturnType<typeof createJuryService>;
    cookieName: string;
  },
) {
  app.get('/events/:eventId/jurors/table', (request) => {
    parseInput(votingActionSchema, request.query);
    return service(request.cookies[cookieName]).table(
      parseInput(eventParamsSchema, request.params).eventId,
    );
  });
  app.put('/events/:eventId/jurors/table', async (request) => {
    parseInput(votingActionSchema, request.query);
    return jurorTableSaveSchema.parse(
      await service(request.cookies[cookieName]).saveTable(
        parseInput(eventParamsSchema, request.params).eventId,
        parseInput(jurorTableInputSchema, request.body),
      ),
    );
  });
  app.get('/events/:eventId/roster', async (request) =>
    service(request.cookies[cookieName]).roster(
      parseInput(eventParamsSchema, request.params).eventId,
    ),
  );
  app.get(
    '/events/:eventId/jury-groups',
    async (request) =>
      (
        await service(request.cookies[cookieName]).roster(
          parseInput(eventParamsSchema, request.params).eventId,
        )
      ).groups,
  );
  app.get('/events/:eventId/jurors', async (request) => {
    const { jurors } = await service(request.cookies[cookieName]).roster(
      parseInput(eventParamsSchema, request.params).eventId,
    );
    // Keep access metadata confined to the roster response.
    return jurors.map((juror) => jurorSchema.strip().parse(juror));
  });
  app.post('/events/:eventId/jury-groups', async (request, reply) => {
    const { eventId } = parseInput(eventParamsSchema, request.params);
    return reply
      .code(201)
      .send(
        await service(request.cookies[cookieName]).createGroup(
          eventId,
          parseInput(juryGroupInputSchema, request.body),
        ),
      );
  });
  app.patch('/events/:eventId/jury-groups/:groupId', async (request) => {
    const { eventId, groupId } = parseInput(groupParamsSchema, request.params);
    return service(request.cookies[cookieName]).renameGroup(
      eventId,
      groupId,
      parseInput(juryGroupPatchSchema, request.body).name,
    );
  });
  app.post('/events/:eventId/jurors', async (request, reply) => {
    const { eventId } = parseInput(eventParamsSchema, request.params);
    return reply
      .code(201)
      .send(
        await service(request.cookies[cookieName]).createJuror(
          eventId,
          parseInput(jurorInputSchema, request.body),
        ),
      );
  });
  app.patch('/events/:eventId/jurors/:jurorId', async (request) => {
    const { eventId, jurorId } = parseInput(jurorParamsSchema, request.params);
    return service(request.cookies[cookieName]).updateJuror(
      eventId,
      jurorId,
      parseInput(jurorPatchSchema, request.body),
    );
  });
  app.delete('/events/:eventId/jurors/:jurorId', async (request, reply) => {
    const { eventId, jurorId } = parseInput(jurorParamsSchema, request.params);
    await service(request.cookies[cookieName]).removeJuror(eventId, jurorId);
    return reply.code(204).send();
  });
}
