# API module boundaries

Phase 2 implements `auth/` alongside infrastructure routes. It owns shared-password authentication, PostgreSQL sessions, operator commands and authorization guards. Register future admin modules inside its protected cookie/origin scope and apply `adminGuard`. See [authentication](../../../../docs/wiki/authentication.md). Add remaining modules in their assigned phases:

Current implementation includes Phase 3 `events/` and `jurors/`, plus Phase 4 `votings/` and `teams/` for voting configuration, allowed groups, shared teams/entries, activation, closure and admin reopening. Explicit D21 configuration and validated first activation are complete; see [voting configuration](../../../../docs/wiki/voting-configuration.md).

- `auth`: admin and juror identity, server sessions, authorization context (Phase 2).
- `events`, `jurors`: event lifecycle, jury groups, membership (Phase 3).
- `votings`: configuration, allowed groups, items and lifecycle (Phase 4).
- `wizard`: authenticated welcome and read-only authorized category projections and authoritative validation (Phases 5–6).
- `ballots`: owner-scoped draft persistence, independent submission/history and administrator-only unlock (Phases 7–8). Review/final action remains Phase 9.
- `dashboard`, `results`: read-only projections over authoritative data (Phases 10–11).

Keep substantial domain behavior out of HTTP handlers. Share public schemas through `@d21/contracts`. Do not import web components into the API or expose database records as public contracts automatically.

Phase 5 adds `auth/juror-access.ts` for reusable organizer links without expiry, session redemption/revocation and `wizard/` for current membership authorization. See [juror entry](../../../../docs/wiki/juror-wizard.md). No ballot writes or D21 engine.

Phase 6 implements shared pure D21 validation/transitions and temporary category controls. The wizard validation endpoint inherits existing event/session/current-group checks and writes no ballot data. Persistence/submission remain later phases; see the juror-wizard wiki.

Phase 7 adds `ballots/service.ts`, draft GET/PUT and batched saved progress. Saves reuse current wizard authorization within an exclusive event-first transaction, enforce expected revision and preserve submitted/cancelled history. No submission endpoint or migration.

Phase 8 adds authoritative independent submission, safe revision/entry-matching retries, submittedAt and transactional history snapshots. `ballots/admin.ts` and `routes.ts` provide guarded listing/unlock, rechecking the shared-admin session after event-lock waits. Unlock preserves choices/history and increments revision; juror resubmission replaces current submitted data. No new migration/dependency; review/final-submit remains Phase 9. Earlier phase descriptions above describe their historical scope. See [submission](../../../../docs/wiki/ballot-submission.md).

Phase 9 wizard review batches current authorized owner snapshots/items under a shared event lock; final submission runs each selected exact saved version through the existing ballot submit in its own event-first write transaction. Per-category conflicts return outcomes; auth/infrastructure failure stops later work without undoing earlier commits. No new persistence state.

Phase 10 `dashboard/` projects actual eligible/current-submitted participation, group/juror states and factual problems under shared event locks and post-wait admin-session checks. Entry reads are internal for validity only; no choices/history are returned. Read-only, batched by event, no migration/dependency. See the operational-dashboard wiki. Results remain Phase 11.

Phase 11 `results/` adds current eligible submitted-only vote totals and pure shared-domain ranking/cutoff detection. It calls `dashboard/readDashboardSnapshot` only after taking the event lock and authenticating, then computes aggregates in that same transaction. Strict aggregate-only responses omit juror identities/choices/history. Shared-admin guarded overview/detail are read-only; no migration/dependency/result-write endpoint. See [results](../../../../docs/wiki/results-ranking.md).

## Phase 12 — 2026-10-18

Phase 12 adds `auth/admin-transaction.ts` for shared in-transaction authorization, actual lifecycle/link audit in existing audit_logs, sanitized retryable dependency errors, and `results/workbook.ts` plus guarded XLSX download. Results and participation reuse one event-locked projection; ZIP generation releases the lock and rechecks authorization. Existing intervention/history/rule/freeze semantics are preserved. No deadline/alert/new intervention or migration.

## Simplification Stage 4 — 2026-10-18

`jurors/table.ts` shares the public roster projection with the legacy service and adds strict GET/PUT `/events/:eventId/jurors/table`. Versioned snapshots include precise stored timestamps, groups and sticky freeze state; access metadata alone does not invalidate a version. Saves use existing administration/event transaction locks, collect field errors, preserve IDs, reject omission/foreign identities, create only missing T/V groups on unfrozen events and perform exact desired-state no-write retries. Frozen name corrections remain allowed. No link/session/ballot/history writes or migration/dependency. Legacy roster/list response shapes and alphabetical ordering remain compatible.

Stage 5 combines one category's draft metadata, explicit rules, permissions and entries under strict setup snapshot/save contracts. `votings/setup.ts` owns guarded event-first atomic persistence, exact no-write replay and precise conflicts. Web `VotingSetup`, `VotingSetupFields`, `VotingSetupComparison` and `voting-setup-utils` own retained form values, linked errors and explicit comparison. Existing lifecycle/ballot/history rules remain separate; no migration or dependency. See the [Stage 5 guide](../../../../docs/wiki/simplification-stage-5.md).
