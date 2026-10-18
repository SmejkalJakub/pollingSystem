# Phase 0 architecture proposal

Status: **APPROVED as the Phase 1 architecture baseline** by the user’s “Great, continue” on 2026-10-16. This approval does not resolve the separately listed product/security questions. Implementation state is tracked in ../implementation/progress.md.

## Stack and structure

The requested stack suits the small, transaction-heavy application. Keep one web app, one API application, and one PostgreSQL database. No microservices, realtime infrastructure, or additional state framework is currently justified.

Propose React + TypeScript + Vite, Tailwind CSS, shadcn/ui, Fastify + TypeScript, PostgreSQL, Drizzle ORM, and Zod for shared validation. Exact supported package/runtime versions and compatible integration details must be checked during Phase 1; none have been installed or verified here.

Use npm workspaces as a lightweight proposal, avoiding an additional build orchestrator:

```text
apps/
  web/src/
    modules/{auth,admin,voting-wizard,results,dashboard}/
    components/ui/
    lib/
  api/src/
    modules/{auth,events,jurors,votings,ballots,results,dashboard}/
    db/{schema,migrations}/
packages/
  contracts/src/
  voting-domain/src/
docs/{wiki,implementation}/
```

Contracts contain portable request/response schemas and inferred TypeScript types, not database models or secrets. The voting-domain package contains pure, tested ballot transitions and validation after D21 rules are confirmed. The browser may use those rules for feedback; the API remains authoritative.

Route handlers validate and authorize requests, then delegate substantial behavior to small domain functions. Keep queries explicit and avoid repetitive controller/service/repository layers for trivial CRUD. Frontend modules own their screens and local form state. Shared UI owns visual primitives, not voting rules. Fetch server data through a small typed API boundary; choose additional server-state tooling only if justified by actual implementation needs.

## Database model

Proposed identifiers are opaque UUIDs; use PostgreSQL timestamps with time zones. Preserve the brief's separate state models: Voting = `draft | active | closed | archived`; Ballot = `draft | submitted | cancelled`; juror progress = `not_started | in_progress | submitted | invalid_draft | locked`. Transition permissions and the meaning of administrative locks still require the open lifecycle decisions. Do not merge progress labels into ballot storage states.

| Entity             | Proposed fields and responsibility                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Event              | id, name, description, timestamps; owns an independent competition.                                                                                          |
| JuryGroup          | id, eventId, code, name; unique `(eventId, code)`; initially T and V.                                                                                        |
| User               | id, account identifier, credentials under the approved admin auth model; admin/guarantor distinction kept small.                                             |
| EventJuror         | id, eventId, juryGroupId, displayName; secure access data depends on the identity decision. Names are not unique identifiers.                                |
| Voting             | id, eventId, name, instructions, round kind, status, selected-place count, explicit plus/minus limits, negative-vote flag, display order, optional deadline. |
| VotingAllowedGroup | eventId, votingId, juryGroupId; unique voting/group pair.                                                                                                    |
| VotingItem         | id, eventId, votingId, name, description, display order; local item in a voting. Shared event-level team identity is an open design question.                |
| Ballot             | id, eventId, votingId, jurorId, lifecycle state, draft revision, timestamps and submittedAt. Unique `(votingId, jurorId)`.                                   |
| BallotEntry        | eventId, votingId, ballotId, votingItemId, voteValue; unique `(ballotId, votingItemId)` and `CHECK voteValue IN (-1, 1)`. No row means no vote.              |
| AuditLog           | eventId, actor reference/type, action, target, timestamp, minimal change context. Avoid credentials and ballot contents in routine logs.                     |
| Session            | Server-side session record; expiry and actor reference. Exact identity and credential design awaits approval.                                                |

Use composite foreign keys where needed to bind groups, jurors, votings, ballots, and entries to the same event and voting. For example, an entry must reference both its ballot and item through matching voting IDs. A ballot's juror and voting must belong to the same event.

The authorized jury-group relationship is checked on the server on every relevant operation. Restrict or validate later group reassignment so it cannot silently invalidate ballots. Cross-row constraints, such as equal jury sizes and permitted group membership, belong in transactionally enforced domain operations rather than an inappropriate row CHECK constraint.

Persist drafts without treating domain-invalid drafts as submitted votes; structural validity, ownership, and referential integrity still apply. Keep validation details/derived validity distinct from submitted/locked lifecycle semantics until the workflow is approved.

Final submission must serialize with voting closure and any permitted configuration change, recheck status and authorization inside the transaction, enforce uniqueness, and save ballot plus entries atomically. Define replay behavior and stale draft protection explicitly. Multi-category atomicity depends on the pending submission decision. Submitted records are excluded from edit operations except through a separately approved administrative process.

Deletion, cascading behavior, active-configuration edits, and shared team identity must be resolved before related migrations or destructive endpoints are finalized.

## API boundaries

Retain the brief's baseline paths; no API version prefix is proposed. Expose the API under the same origin as the web app to simplify browser sessions.

| Owner            | Baseline routes                                                                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| auth             | `POST /auth/admin/login`, `POST /auth/juror/start`, `GET /auth/session`, `POST /auth/logout`                                                                                                                          |
| events / jurors  | `GET, POST /events`; `GET, PATCH /events/:eventId`; `GET, POST /events/:eventId/jurors`; `PATCH /events/:eventId/jurors/:jurorId`                                                                                     |
| votings          | `GET, POST /events/:eventId/votings`; `GET, PATCH /votings/:votingId`; `POST /votings/:votingId/items`; `PATCH /votings/:votingId/items/:itemId`; `POST /votings/:votingId/activate`; `POST /votings/:votingId/close` |
| ballots / wizard | `GET /wizard/current`, `/wizard/steps`, `/wizard/steps/:stepId`, `/wizard/review`; `PUT /wizard/steps/:stepId/ballot-draft`; `POST /wizard/steps/:stepId/submit`, `/wizard/final-submit`                              |
| dashboard        | `GET /dashboard/overview?eventId=...`, `GET /dashboard/votings/:votingId`                                                                                                                                             |
| results          | `GET /results/overview?eventId=...`, `GET /results/votings/:votingId`                                                                                                                                                 |

Proposed additions for explicit jury-group management: `GET, POST /events/:eventId/jury-groups` and `PATCH /events/:eventId/jury-groups/:groupId`. The brief requires the feature but omits its routes. Removal/archive and shared-team endpoints require lifecycle decisions before implementation.

Use Zod schemas for inputs and public outputs. Do not accept browser-supplied juror ownership or group claims as authority. Return structured errors with stable codes and field errors; distinguish invalid input, unauthenticated access, forbidden actions, missing resources, and lifecycle/revision conflicts. Define wizard step IDs and ordering from authorized server data.

Phase 2 confirmed and implemented PostgreSQL sessions, protected HttpOnly/SameSite cookies, origin protection and login throttling. The user chose one shared administration password without email or individual accounts, and unique organizer-issued event/juror links. Sessions expire absolutely after 12 hours; local operator commands replace the password or revoke administration sessions. Juror entry/issuance remains future work. See [authentication](authentication.md) for the actual implementation; earlier database/API tables above remain the original proposal.

Dashboard counts derive from eligible jurors and actually submitted ballots per category. Invalid drafts are visible as problems and excluded from result totals. Results are calculated on the server from submitted entries; winner cutoff and ties follow the confirmed policy. Polling is adequate initially.

## Validation strategy

Propose TypeScript checks, ESLint, production builds, Vitest for pure rules and components, Fastify request-injection API tests, integration tests against PostgreSQL for constraints and concurrent submissions, and Playwright for critical E2E flows. The packages and commands will be introduced in Phase 1.

Phase 0 requires documentation review and source/link checks only. UI implementation later must include loading, empty, error, keyboard, touch, and mobile behavior, following the [design reference](design-reference.md).

## Phase 4 implemented extension — 2026-10-17

Phase 4 is complete. Shared event teams with same-event voting entries use additive migration 0003. Explicit administrator-entered limits and validated first activation use existing voting columns; event-first transactions share roster-freeze locks. Configuration freezes after first activation, while approved admin reopening preserves history without readiness checks. See [voting configuration](voting-configuration.md) for actual routes/validation; earlier proposal-only routes above are not implementation claims.

## Phase 5 implemented extension — 2026-10-17

`auth/juror-access.ts` owns event/juror link issuance, revocation and session redemption. `wizard/` owns read-only welcome/authorized category projections, separately from future `ballots/` writes. Both register inside existing cookie/origin scope. The API derives identities from hashed secrets/sessions and current membership. Event-first writes and shared-event reads serialize with existing roster/voting locks. No migration or new dependency is needed. Shared contracts cover all new public responses; a shared typed web transport serves admin/wizard modules.

`voting-wizard/` provides root entry, `/wizard` and UUID step routes using normal browser navigation for direct links, refresh and history. Position is URL state, not persisted voting progress. Closed/archived authorized steps remain visible; drafts remain hidden. Details and exact decisions: [juror entry and wizard](juror-wizard.md). No ballot/D21 engine was added.

## Phase 6 implemented extension — 2026-10-17

`@d21/voting-domain` contains pure D21 validation/transitions using approved contract configuration/ratio. Both API and web import it through explicit workspace dependencies. `wizard/service` reuses its existing event-locked projection/session authorization for a validation-only POST; it writes nothing. Request entries carry only item identity/sign, while current context comes from the database. A prior validation result never authorizes later persistence/submission.

`CategoryVoting` owns local temporary choices, counters, invalid-state explanation and explicit server-check feedback. The user chose retaining edits that reduce negative eligibility until corrected; no automatic removal. Browser navigation/refresh resets choices. No new store/router/external dependency or migration. Phase 7 remains gated by Q04 persistence/submission contract decisions.

## Phase 7 implementation — 2026-10-17

`ballots/service.ts` owns owner-scoped snapshot projection and transactional draft replacement. `wizard/service.ts` runs reads/validation under a shared event lock and saves under an exclusive event lock, resolving current session/group/authorized categories inside the same transaction. It passes only server-derived context into ballot operations. Snapshot reads are batched across authorized categories. Stored ballot lifecycle stays draft/submitted/cancelled; progress and validity are derived, not additional persisted states. Existing tables/revision columns suffice; no migration or external dependency.

The user chooses independent category submission (Phase 8), preserving other categories for later return. Draft revision null means absent; integer revisions prevent silent stale-tab overwrite. Full entry replacement and revision increment roll back together. Submitted/cancelled records are never overwritten. Closed categories retain readable drafts and reject writes until reopened. `useBallotDraft` owns local edits/base snapshot/conflict recovery; `DraftPersistence` presents save/restore/comparison feedback; `CategoryVoting` retains pure D21 interaction. Successful revalidation never silently replaces local edits, and transient refresh failure preserves the editor. No draft save is submission.

## Phase 8 implementation — 2026-10-17

Existing event-first transaction and ballot revision boundaries now include category submission and administrator-only unlocking. Submission reuses authoritative context/rules and stores entries/state/submittedAt/revision/history atomically; matching no-write confirmation retries are safe. Unlock rechecks shared-admin authorization after event-lock waits, preserves choices/history and increments revision before returning a draft. Current submitted data stays in ballots/entries; historical snapshots live in existing audit_logs and must not be counted as extra ballots. Storing vote choices there is an explicit history exception, not routine HTTP logging. No new table, migration or dependency. Contracts expose submittedAt and strict submit/unlock inputs; web reuses draft conflict/recovery and adds focused confirmations. [Detailed contract](ballot-submission.md). Phase 9 review/final action remains separate.

## Phase 9 implementation — 2026-10-17

Wizard review reuses current event/session/group projections under a shared event lock and batches authorized owner ballots/items. Final submission selects saved revisions/choices and invokes the existing Phase 8 write in a separate exclusive event-first transaction per category. Normal category failures return individual outcomes; global session/infrastructure loss stops later operations without rolling back earlier independent commits. Browser workflow state/confirmed retries stay local to `useReviewSubmission`; category presentation is separate. `/wizard/confirmation` is refreshable from current ballots, without a new event-completion state. No dependency, table or migration. [Approved contract/recovery](multi-category-review.md).

## Phase 10 implementation — 2026-10-18

`dashboard/` adds shared-admin metadata-only overview/category projections under the existing shared event lock, with post-wait session/statement-time expiry rechecks. Event-batched queries derive eligibility/current submitted participation and saved validity without reading audit history or exposing choices. The web dashboard reuses existing session recovery/transport and semantic tokens; explicit refresh exposes its snapshot time. No migration/dependency/realtime infrastructure. [Counting and API contract](operational-dashboard.md). Results/ties remain Phase 11.

## Phase 11 implementation — 2026-10-18

`results/` aggregates only current eligible submitted entries under a shared parent-event lock. It reuses the exported locked dashboard projection for participation/validity, then reads batched category configuration and item totals in the same transaction. Pure `voting-domain/results.ts` computes scores, competition ranks and cutoff ties; the browser presents server results only. Shared strict contracts expose aggregate team/category data without juror choices/history. Existing admin guards and post-wait session checks apply. No dependency, migration, persistent result state or tie-resolution write. [Full contract](results-ranking.md).

## Phase 12 — 2026-10-18

`auth/admin-transaction.ts` centralizes request-bound shared-admin checks within event locks and at transaction completion. Older admin services now bind the request cookie explicitly; event descriptive updates serialize with snapshot reads. Existing audit_logs records actual lifecycle/link changes atomically. Results reuses one locked dashboard projection for the three-sheet XLSX export, releases the lock before ZIP generation and rechecks authorization before returning it. Server-only ExcelJS with compatible patched UUID override; no schema/migration. [Operational contract](operational-hardening.md).

## Phase 13 — complete within approved scope, 2026-10-18

Opt-in built hosting adds `webRoot` to the existing application factory, serving static assets/SPA routes and registering the same API under `/api`; development retains its Vite proxy and root API. `@fastify/static` handles built assets. Proxy trust is off unless validated IP/CIDR ranges are configured; security origin/cookie/link decisions remain independent of forwarded host/protocol. API builds bundle both workspace packages and emit flat server/migrate/operator entry points with immutable migration copies. One non-root Docker image supports isolated local Linux Compose and the approved Render service with a separate Supabase PostgreSQL project. Playwright/axe test the built application with generated local databases. Provider Data API/GraphQL remain disabled. Verified TLS, explicit conservative proxy trust, authenticated live workflows, controlled database-access failure/recovery, service redeploy/session retention and populated hosted-data restore into an isolated Linux app are verified. Five migrations include additive 0004 fixing the invoker roster trigger search path; the original four SQL files remain unchanged. Shared peer-IP throttling, free quotas and untested managed-provider disaster recovery remain documented pilot limits. [Deployment details](deployment.md).

## Simplification Stage 1 — 2026-10-18

[Stage 1](simplification-stage-1.md) supersedes historical juror session expiry and one-time-only link display. Nullable expiry represents untimed juror sessions while dated administration expiry remains enforced. Additive 0005 upgrades only valid, unrevoked juror sessions and adds authenticated ciphertext beside authentication hashes. `auth/link-vault.ts` uses an externally supplied versioned key ring; the existing event/admin authorization boundary protects read-only retrieval. Roster responses expose only access metadata. Direct copy/fallback UI reuses existing tokens/controls. No voting/history semantics or subsequent-stage workspace/table behavior changes.

## Simplification Stage 2 — 2026-10-18

`admin/EventNavigation.tsx` supplies a shared event heading and contextual page links to preparation, progress and results, reused by event/category screens. Preparation query parameters select the existing management components and load only the chosen collection. Category setup reads the existing event resource for its name; progress/results reuse event metadata from their existing snapshots. UI state, validation, confirmations, auth and all backend/domain/storage boundaries remain unchanged. No new API, router dependency, schema or migration. [Workspace guide](simplification-stage-2.md).

## Simplification Stage 3 — 2026-10-18

Teams gain strict snapshot/table-save contracts and GET/PUT `/events/:eventId/teams/table` under existing event locks and administration rechecks. A precise timestamp/content fingerprint detects concurrent edits, including legacy team API writes. Stable client-generated IDs and read-only exact desired-state replay protect uncertain retries without a receipt table or migration. Missing existing IDs never delete. `TeamTable` owns pending edits/save/comparison, `TeamRows` renders accessible fields, and `TeamPaste` previews parsed tab-separated text. No storage/dependency/voting rule change. [Contract and limits](simplification-stage-3.md).
