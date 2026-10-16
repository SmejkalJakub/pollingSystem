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
