import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import {
  eventParamsSchema,
  votingParamsSchema,
  votingDraftInputSchema,
  votingDraftPatchSchema,
  votingGroupsInputSchema,
  votingItemInputSchema,
  votingItemPatchSchema,
  votingItemParamsSchema,
  votingActionSchema,
  votingConfigurationSchema,
} from '@d21/contracts';
import { parseInput } from '../../validation';
import type { VotingService } from './service';
import { registerTeams } from '../teams/routes';

export async function registerVotings(
  app: FastifyInstance,
  options: {
    service: VotingService;
    guard: preHandlerHookHandler;
    cookieName: string;
  },
) {
  app.addHook('preHandler', options.guard);
  await app.register(registerTeams, {
    service: (token: string | undefined) => options.service(token).teams,
    cookieName: options.cookieName,
  });
  app.put('/votings/:votingId/configuration', (request) => {
    const { votingId } = parseInput(votingParamsSchema, request.params);
    return options
      .service(request.cookies[options.cookieName])
      .configure(votingId, parseInput(votingConfigurationSchema, request.body));
  });
  app.post('/votings/:votingId/activate', (request) => {
    const { votingId } = parseInput(votingParamsSchema, request.params);
    parseInput(votingActionSchema, request.body ?? {});
    return options
      .service(request.cookies[options.cookieName])
      .activate(votingId);
  });
  app.post('/votings/:votingId/reopen', (request) => {
    const { votingId } = parseInput(votingParamsSchema, request.params);
    parseInput(votingActionSchema, request.body ?? {});
    return options
      .service(request.cookies[options.cookieName])
      .reopen(votingId);
  });
  app.post('/votings/:votingId/close', (request) => {
    const { votingId } = parseInput(votingParamsSchema, request.params);
    parseInput(votingActionSchema, request.body ?? {});
    return options.service(request.cookies[options.cookieName]).close(votingId);
  });
  app.get('/events/:eventId/votings', (request) => {
    const { eventId } = parseInput(eventParamsSchema, request.params);
    return options.service(request.cookies[options.cookieName]).list(eventId);
  });
  app.post('/events/:eventId/votings', async (request, reply) => {
    const { eventId } = parseInput(eventParamsSchema, request.params);
    const result = await options
      .service(request.cookies[options.cookieName])
      .create(eventId, parseInput(votingDraftInputSchema, request.body));
    return reply.code(201).send(result);
  });
  app.get('/votings/:votingId', (request) => {
    const { votingId } = parseInput(votingParamsSchema, request.params);
    return options.service(request.cookies[options.cookieName]).get(votingId);
  });
  app.patch('/votings/:votingId', (request) => {
    const { votingId } = parseInput(votingParamsSchema, request.params);
    return options
      .service(request.cookies[options.cookieName])
      .update(votingId, parseInput(votingDraftPatchSchema, request.body));
  });
  app.get('/votings/:votingId/allowed-groups', (request) => {
    const { votingId } = parseInput(votingParamsSchema, request.params);
    return options
      .service(request.cookies[options.cookieName])
      .groups(votingId);
  });
  app.put('/votings/:votingId/allowed-groups', (request) => {
    const { votingId } = parseInput(votingParamsSchema, request.params);
    return options
      .service(request.cookies[options.cookieName])
      .setGroups(votingId, parseInput(votingGroupsInputSchema, request.body));
  });
  app.get('/votings/:votingId/items', (request) =>
    options
      .service(request.cookies[options.cookieName])
      .items(parseInput(votingParamsSchema, request.params).votingId),
  );
  app.post('/votings/:votingId/items', async (request, reply) => {
    const { votingId } = parseInput(votingParamsSchema, request.params);
    return reply
      .code(201)
      .send(
        await options
          .service(request.cookies[options.cookieName])
          .addItem(votingId, parseInput(votingItemInputSchema, request.body)),
      );
  });
  app.patch('/votings/:votingId/items/:itemId', (request) => {
    const { votingId, itemId } = parseInput(
      votingItemParamsSchema,
      request.params,
    );
    return options
      .service(request.cookies[options.cookieName])
      .updateItem(
        votingId,
        itemId,
        parseInput(votingItemPatchSchema, request.body),
      );
  });
}
