# Implementation plan

Updated 2026-10-16. Status values: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `DONE`.

Current scope is Phase 2 — Authentication & Sessions, started through the handoff in this new session. Q03 authentication and session choices were explicitly confirmed on 2026-10-16. Phases 0 and 1 are DONE; Phase 2 is DONE. Phase 3 remains NOT_STARTED and requires a new user-started session.

The [original brief, section 18](../wiki/master-implementation-prompt.md) defines the full scope and acceptance criteria for every phase. The table below is a navigation summary, not a replacement for those criteria. All phases also require applicable typecheck/lint/tests, review, accurate documentation, and handoff.

| Phase                                  | Status      | Scope                                                                                                                 | Dependencies / decision gates                                                                           | Main acceptance criteria                                                                                                                          |
| -------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Discovery, Architecture & Planning | DONE        | Workspace audit, module/database/API proposals, uncertainties, roadmap and handoff.                                   | Architecture approval Q01.                                                                              | Approved plan, documented stack/boundaries, open questions, four implementation documents, Phase 1 handoff.                                       |
| 1 — Foundation & Database              | DONE        | Web/API workspaces, Tailwind/shadcn, PostgreSQL/Drizzle/migrations, shared contracts, tooling and local setup.        | Phase 0 DONE; Q02/Q04 schema implications and Q09 team identity reviewed before fixing affected schema. | Local startup, web-to-API health call, repeatable migrations, integrity constraints, UI tooling, passing checks, documented setup. No product UI. |
| 2 — Authentication & Sessions          | DONE        | Admin login/logout, sessions, protected endpoints, shared admin/guarantor access, juror-access preparation, login UI. | Phase 1; Q03 auth/provisioning.                                                                         | Tested login/logout, rejection of unauthorized access, consistent sessions and approved permissions.                                              |
| 3 — Event & Jury Management            | NOT_STARTED | Events, jury groups, jurors, event/group membership and admin screens.                                                | Phase 2; Q05 membership rules, Q10 size enforcement.                                                    | Event list/detail/edit, juror management, correct T/V assignment and rejection of invalid relationships; verified API/UI.                         |
| 4 — Voting Configuration & Teams       | NOT_STARTED | Voting/items/teams, D21 configuration, allowed groups, statuses, activation and closure.                              | Phase 3; Q02, Q05, Q07, Q09, Q10 as applicable.                                                         | Selection/final configuration works; invalid activation rejected; explicit limits stored; T/V checks and tests. No ballot submission.             |
| 5 — Juror Entry & Wizard Foundation    | NOT_STARTED | Identity/session, welcome, authorized steps, routing, progress and navigation.                                        | Phase 4; approved Q03 juror identity.                                                                   | Correct event/category access for T/V; protected steps; usable mobile/desktop navigation. No complete voting engine.                              |
| 6 — Voting Interaction & D21 Engine    | NOT_STARTED | Pure rules, plus/minus toggle/replacement/removal, limits, category UI and backend validation.                        | Phase 5; confirmed Q02 with examples.                                                                   | Tested interactions/edge cases match methodology; server rejects invalid ballots; responsive UI. No multi-category final submit.                  |
| 7 — Ballot Drafts & Persistence        | NOT_STARTED | Save, resume, invalid drafts, persistence feedback and errors.                                                        | Phase 6; Q04 draft/submission contract.                                                                 | Correct juror/voting ownership, database restoration, invalid draft excluded from submission, tested workflow.                                    |
| 8 — Submission & Locking               | NOT_STARTED | Authoritative validation, atomic storage, submitted state, retries, concurrency and locking.                          | Phase 7; Q04 submission, Q08 locking.                                                                   | Valid submit succeeds; invalid and duplicate requests cannot corrupt data; submitted votes protected; PostgreSQL integration tests.               |
| 9 — Multi-Category Wizard & Review     | NOT_STARTED | Authorized ordered steps, editing/review, full validation, final submit and confirmation.                             | Phase 8; confirmed Q04.                                                                                 | T/V see only allowed steps; accurate review; safe final workflow; integration tests.                                                              |
| 10 — Operational Dashboard             | NOT_STARTED | Actual-data KPIs, category cards, progress, juror detail, pending votes and attention states.                         | Phase 9; Q10 alert thresholds.                                                                          | Correct eligible/submitted counts and problems; tested aggregates; responsive screens with real data.                                             |
| 11 — Results & Ranking                 | NOT_STARTED | Plus/minus totals, score, ranking, multiple winners, ties, provisional/final results and API/UI.                      | Phase 10; confirmed Q02 and Q06.                                                                        | Correct tested category totals, ranking, multiwinner cutoff, ties and provisional/final distinction.                                              |
| 12 — Operational Hardening             | NOT_STARTED | Deadlines, lifecycle safety, audit, authorization/data integrity, errors, approved exports.                           | Phase 11; Q05, Q07, Q08, Q11.                                                                           | Server-enforced transitions/deadlines, useful audit, tenant isolation, safe intervention and critical error tests. Split into sessions if needed. |
| 13 — E2E & Production Readiness        | NOT_STARTED | End-to-end admin/T/V voting/results, mobile/accessibility, containers, production setup and deployment docs.          | Phase 12; Q11 hosting/operations.                                                                       | Critical E2E passes, repeatable startup/migrations, production setup, no blockers, complete documentation and review.                             |

## Phase 0 acceptance checklist

- [x] Inspect the workspace and relevant inherited instructions; record that no code or Git history exists.
- [x] Document the proposed technologies, module boundaries, database, and API.
- [x] Record unresolved decisions without inventing voting or security policy.
- [x] Preserve the user's full specification and preview in the project wiki.
- [x] Create plan, progress, decisions, and next-session documentation.
- [x] Prepare Phase 1 scope, acceptance criteria, and handoff.
- [x] Architecture approved by the user’s “Great, continue” on 2026-10-16. Open product decisions remain unresolved.

## Required scenario mapping

The brief's section 19 scenario numbers map to phases as follows: 1 → Phase 3; 2–3 → Phase 4; 4–5 → Phases 5 and 9; 6–8 → Phase 6; 9 → Phase 7; 10 → Phase 8; 11 → Phase 10; 12–14 → Phase 11; 15 → Phases 8 and 12; 16–17 → Phases 8 and 12. Phase 13 validates the integrated critical workflows.

## Scope control

Before each phase, compare actual code with the documents, resolve decisions needed for that phase, and write a short scope plan. A phase with unmet completion criteria stays IN_PROGRESS or BLOCKED. Finalize documentation after actual validation; never infer passing checks from planned commands.

## Phase 1 acceptance checklist

- [x] Frontend and API run locally with documented commands.
- [x] The frontend calls health/readiness endpoints and confirms PostgreSQL connectivity.
- [x] The initial migration applies and can be rerun; regeneration reports no schema drift.
- [x] Ten core tables have composite event/voting boundaries and critical constraints.
- [x] Tailwind v4, semantic tokens, and a shadcn Button work in the minimal screen.
- [x] Shared Zod contracts validate runtime data and all four workspaces typecheck.
- [x] Lint, formatting, 6 API/contract tests, 14 PostgreSQL tests, and both builds pass.
- [x] Desktop/mobile, retry, keyboard focus, real database outage, and recovery checked in the browser.
- [x] Code self-review and documentation/handoff completed; no known Phase 1 blockers remain.

Phase 2 plan: add additive credential/session/juror-access storage, operator password commands, shared auth contracts, guarded API routes, basic login/logout UI, meaningful auth tests, review and documentation. Juror wizard entry remains Phase 5. No Phase 3 event CRUD or voting engine work is authorized.

## Phase 2 acceptance checklist

- [x] Approved shared-password administration login/logout with no email or individual accounts.
- [x] Database-backed 12-hour absolute sessions, cookie protection, expiry/revocation and operator commands.
- [x] Protected admin route rejects missing/invalid sessions and juror actors; admin/guarantor share permissions.
- [x] Additive credential/session/juror-secret schema and shared runtime contracts.
- [x] Juror backend preparation preserves duplicate-name/event isolation without implementing the wizard.
- [x] Accessible basic login UI with loading/error/retry, focus, restoration and mobile layout.
- [x] 12 fast tests and 26 PostgreSQL checks; typecheck, lint, formatting and builds pass.
- [x] Actual migration application and no-drift regeneration verified; operator commands and browser flows checked.
- [x] Source/migration self-review and documentation/handoff complete. No known Phase 2 blockers.

Next: Phase 3 in a new user-started session, with Q05/Q10 decisions before affected implementation.

## Phase 2 routing follow-up — 2026-10-16

User-requested adjustment: `/` is the juror landing; shared-password administration is available only at `/admin/login`, with no public navigation link. Unknown paths must not display admin login. This is a small Phase 2 UI correction, not the start of Phase 3 or the Phase 5 wizard.

Acceptance: juror content on the root page, direct/refreshable admin login, working home navigation, page titles, responsive layout, unchanged API authentication, checks and updated handoff.
