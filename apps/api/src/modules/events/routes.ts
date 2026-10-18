import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import {
  eventInputSchema,
  eventParamsSchema,
  eventPatchSchema,
} from '@d21/contracts';
import { parseInput } from '../../validation';
import type { EventService } from './service';
import { registerJurors } from '../jurors/routes';

export async function registerEvents(
  app: FastifyInstance,
  options: {
    service: EventService;
    guard: preHandlerHookHandler;
    cookieName: string;
  },
) {
  app.addHook('preHandler', options.guard);
  await app.register(registerJurors, {
    service: (token: string | undefined) => options.service(token).jury,
    cookieName: options.cookieName,
  });
  app.get('/events', (request) =>
    options.service(request.cookies[options.cookieName]).list(),
  );
  app.post('/events', async (request, reply) => {
    const result = await options
      .service(request.cookies[options.cookieName])
      .create(parseInput(eventInputSchema, request.body));
    return reply.code(201).send(result);
  });
  app.get('/events/:eventId', async (request) => {
    const { eventId } = parseInput(eventParamsSchema, request.params);
    return options.service(request.cookies[options.cookieName]).get(eventId);
  });
  app.patch('/events/:eventId', async (request) => {
    const { eventId } = parseInput(eventParamsSchema, request.params);
    return options
      .service(request.cookies[options.cookieName])
      .update(eventId, parseInput(eventPatchSchema, request.body));
  });
}
