import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  wizardStepParamsSchema,
  ballotValidationInputSchema,
  ballotDraftInputSchema,
  ballotSubmitInputSchema,
  wizardFinalSubmitInputSchema,
} from '@d21/contracts';
import { parseInput } from '../../validation';
import type { WizardService } from './service';

export async function registerWizard(
  app: FastifyInstance,
  { service, cookieName }: { service: WizardService; cookieName: string },
) {
  app.addHook('preHandler', async (request) => {
    parseInput(z.strictObject({}), request.query);
  });
  app.get('/wizard/current', (request) =>
    service.current(request.cookies[cookieName]),
  );
  app.get('/wizard/review', (request) =>
    service.review(request.cookies[cookieName]),
  );
  app.post('/wizard/final-submit', (request) => {
    const input = parseInput(wizardFinalSubmitInputSchema, request.body);
    return service.finalSubmit(request.cookies[cookieName], input);
  });
  app.get(
    '/wizard/steps',
    async (request) =>
      (await service.current(request.cookies[cookieName])).steps,
  );
  app.post('/wizard/steps/:stepId/validate', (request) => {
    const { stepId } = parseInput(wizardStepParamsSchema, request.params);
    const { entries } = parseInput(ballotValidationInputSchema, request.body);
    return service.validate(request.cookies[cookieName], stepId, entries);
  });
  app.post('/wizard/steps/:stepId/submit', (request) => {
    const { stepId } = parseInput(wizardStepParamsSchema, request.params);
    const input = parseInput(ballotSubmitInputSchema, request.body);
    return service.submit(request.cookies[cookieName], stepId, input);
  });
  app.get('/wizard/steps/:stepId/ballot-draft', async (request) => {
    const { stepId } = parseInput(wizardStepParamsSchema, request.params);
    return (await service.step(request.cookies[cookieName], stepId)).ballot;
  });
  app.put('/wizard/steps/:stepId/ballot-draft', (request) => {
    const { stepId } = parseInput(wizardStepParamsSchema, request.params);
    const draft = parseInput(ballotDraftInputSchema, request.body);
    return service.saveDraft(request.cookies[cookieName], stepId, draft);
  });
  app.get('/wizard/steps/:stepId', (request) => {
    const { stepId } = parseInput(wizardStepParamsSchema, request.params);
    return service.step(request.cookies[cookieName], stepId);
  });
}
