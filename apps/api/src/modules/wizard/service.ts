import type { Pool } from 'pg';
import { validateBallot } from '@d21/voting-domain';
import {
  wizardCurrentSchema,
  wizardStepDetailSchema,
  wizardStepsSchema,
  votingItemListSchema,
  ballotValidationSchema,
  ballotDraftSchema,
  wizardReviewSchema,
  wizardFinalSubmitSchema,
  type BallotDraftInput,
  type BallotEntry,
  type WizardFinalSubmitInput,
  type WizardFinalSubmit,
} from '@d21/contracts';
import type { AuthService } from '../auth/service';
import { AppError } from '../../errors';
import { notFound, withEventLock } from '../events/locking';
import { readBallots, saveDraft, submitBallot } from '../ballots/service';

type WizardOperation =
  | { kind: 'validate'; entries: BallotEntry[] }
  | { kind: 'saveDraft' | 'submit' | 'submitSaved'; input: BallotDraftInput };

const unauthenticated = () =>
  new AppError(401, 'UNAUTHENTICATED', 'Use your personal link to continue.');
export function createWizardService(pool: Pool, auth: AuthService) {
  async function run(
    token: string | undefined,
    stepId?: string,
    operation?: WizardOperation,
    review = false,
  ) {
    const session = await auth.readSession(token);
    if (!session) throw unauthenticated();
    if (session.principal.kind !== 'juror')
      throw new AppError(403, 'JUROR_REQUIRED', 'A juror session is required.');
    const { eventId } = session.principal;
    return withEventLock(
      pool,
      eventId,
      async (client) => {
        // Recheck after waiting for the event lock, using this transaction's connection.
        const current = await auth.readSession(token, client);
        if (
          !current ||
          current.principal.kind !== 'juror' ||
          current.principal.eventId !== eventId
        )
          throw unauthenticated();
        const result = await client.query(
          `SELECT e.id,e.name,e.description,e.created_at,e.updated_at,
         g.id AS group_id,g.code,g.name AS group_name
         FROM event_jurors j JOIN events e ON e.id=j.event_id
         JOIN jury_groups g ON g.event_id=j.event_id AND g.id=j.jury_group_id
         WHERE j.event_id=$1 AND j.id=$2`,
          [eventId, current.principal.id],
        );
        const row = result.rows[0];
        if (!row) throw unauthenticated();
        const categories = await client.query(
          `SELECT v.id,v.name,v.instructions,v.kind,v.status,
         v.selected_places AS "selectedPlaces",v.max_plus_votes AS "maxPlusVotes",
         v.max_minus_votes AS "maxMinusVotes",v.allow_negative_votes AS "allowNegativeVotes"
         FROM votings v JOIN voting_allowed_groups a ON a.voting_id=v.id AND a.event_id=v.event_id
         WHERE v.event_id=$1 AND a.jury_group_id=$2 AND v.status<>'draft'
         ORDER BY CASE WHEN v.kind='selection' THEN 0 ELSE 1 END,v.created_at,v.id`,
          [eventId, row.group_id],
        );
        const steps = wizardStepsSchema.parse(categories.rows);
        const saved = await readBallots(
          client,
          eventId,
          current.principal.id,
          steps,
        );
        for (const step of steps)
          step.progress = saved.get(step.id)?.progress ?? 'not_started';
        const welcome = wizardCurrentSchema.parse({
          principal: current.principal,
          expiresAt: current.expiresAt,
          event: {
            id: row.id,
            name: row.name,
            description: row.description,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString(),
          },
          group: {
            id: row.group_id,
            eventId,
            code: row.code,
            name: row.group_name,
          },
          steps,
        });
        if (review) {
          const items = await client.query(
            `SELECT i.id,i.event_id AS "eventId",i.voting_id AS "votingId",i.team_id AS "teamId",
             coalesce(t.name,i.name) AS name,coalesce(t.description,i.description) AS description,
             i.display_order AS "displayOrder" FROM voting_items i
             LEFT JOIN teams t ON t.id=i.team_id AND t.event_id=i.event_id
             WHERE i.event_id=$1 AND i.voting_id=ANY($2::uuid[]) ORDER BY i.display_order,i.id`,
            [eventId, steps.map((step) => step.id)],
          );
          const allItems = votingItemListSchema.parse(items.rows);
          return {
            current: welcome,
            review: wizardReviewSchema.parse({
              current: welcome,
              categories: steps.map((step) => ({
                step,
                items: allItems.filter((item) => item.votingId === step.id),
                ballot: saved.get(step.id) ?? null,
              })),
            }),
          };
        }
        if (!stepId) return { current: welcome };
        const step = steps.find((value) => value.id === stepId);
        // Same response for a forbidden, draft, foreign-event or missing step.
        if (!step) throw notFound();
        const items = await client.query(
          `SELECT i.id,i.event_id AS "eventId",i.voting_id AS "votingId",i.team_id AS "teamId",
         coalesce(t.name,i.name) AS name,coalesce(t.description,i.description) AS description,
         i.display_order AS "displayOrder" FROM voting_items i
         LEFT JOIN teams t ON t.id=i.team_id AND t.event_id=i.event_id
         WHERE i.event_id=$1 AND i.voting_id=$2 ORDER BY i.display_order,i.id`,
          [eventId, stepId],
        );
        const itemList = votingItemListSchema.parse(items.rows);
        if (operation?.kind === 'submitSaved') {
          const ballot = saved.get(stepId);
          // A review cannot manufacture an empty ballot or submit unreviewed changes.
          // Submitted snapshots proceed to the existing exact-replay check only.
          if (
            !ballot ||
            (ballot.status === 'draft' &&
              (ballot.revision !== operation.input.expectedRevision ||
                ballot.entries.length !== operation.input.entries.length ||
                !ballot.entries.every((entry) =>
                  operation.input.entries.some(
                    (other) =>
                      entry.votingItemId === other.votingItemId &&
                      entry.voteValue === other.voteValue,
                  ),
                )))
          )
            throw new AppError(
              409,
              'DRAFT_CONFLICT',
              'Review the current saved draft before submitting.',
            );
        }
        if (
          operation?.kind === 'saveDraft' ||
          operation?.kind === 'submit' ||
          operation?.kind === 'submitSaved'
        )
          return {
            current: welcome,
            ballot: await (
              operation.kind === 'saveDraft' ? saveDraft : submitBallot
            )(
              client,
              eventId,
              current.principal.id,
              step,
              itemList.map((item) => item.id),
              operation.input,
            ),
          };
        if (operation?.kind === 'validate')
          return {
            current: welcome,
            validation: ballotValidationSchema.parse(
              validateBallot(
                step,
                itemList.map((item) => item.id),
                operation.entries,
              ),
            ),
          };
        return {
          current: welcome,
          detail: wizardStepDetailSchema.parse({
            current: welcome,
            step,
            items: itemList,
            ballot: saved.get(stepId) ?? null,
          }),
        };
      },
      !operation || operation.kind === 'validate',
    );
  }
  return {
    async review(token: string | undefined) {
      return wizardReviewSchema.parse(
        (await run(token, undefined, undefined, true)).review,
      );
    },
    async finalSubmit(
      token: string | undefined,
      input: WizardFinalSubmitInput,
    ) {
      const results: WizardFinalSubmit['results'] = [];
      // Each category commits separately. Reauthorize after each lock wait; never
      // turn an unavailable category into an event-wide submission barrier.
      for (const category of input.categories) {
        try {
          const result = await run(token, category.stepId, {
            kind: 'submitSaved',
            input: category,
          });
          results.push({
            stepId: category.stepId,
            outcome: 'submitted',
            ballot: ballotDraftSchema.parse(result.ballot),
          });
        } catch (error) {
          // Authorization loss or an infrastructure failure makes the whole HTTP
          // result uncertain. Earlier commits survive and exact retries are safe.
          if (
            !(error instanceof AppError) ||
            ![400, 404, 409].includes(error.statusCode)
          )
            throw error;
          results.push({
            stepId: category.stepId,
            outcome: 'rejected',
            code: error.code,
            status: error.statusCode,
          });
        }
      }
      return wizardFinalSubmitSchema.parse({ results });
    },
    async submit(
      token: string | undefined,
      stepId: string,
      input: BallotDraftInput,
    ) {
      return ballotDraftSchema.parse(
        (await run(token, stepId, { kind: 'submit', input })).ballot,
      );
    },
    async current(token: string | undefined) {
      return (await run(token)).current;
    },
    async validate(
      token: string | undefined,
      stepId: string,
      entries: BallotEntry[],
    ) {
      return ballotValidationSchema.parse(
        (await run(token, stepId, { kind: 'validate', entries })).validation,
      );
    },
    async step(token: string | undefined, stepId: string) {
      return wizardStepDetailSchema.parse((await run(token, stepId)).detail);
    },
    async saveDraft(
      token: string | undefined,
      stepId: string,
      draft: BallotDraftInput,
    ) {
      return ballotDraftSchema.parse(
        (await run(token, stepId, { kind: 'saveDraft', input: draft })).ballot,
      );
    },
  };
}
export type WizardService = ReturnType<typeof createWizardService>;
