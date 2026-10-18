# Implementation plan

Updated 2026-10-18. Status values: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `DONE`.

Phases 0–11 are DONE. Phase 11 results API/UI, approved Q06 rules, final source/database/browser validation, review, documentation and cleanup are complete. Phase 12 is DONE after final source/PostgreSQL/browser validation, review, documentation and cleanup. Phase 13 is IN_PROGRESS in the current user-started session. The user excludes deadlines and alerts and approves XLSX results/participation exports plus hardening/auditing existing admin actions. Multiple Conventional Commits/push are now explicitly authorized for the free test deployment.

The [original brief, section 18](../wiki/master-implementation-prompt.md) defines the full scope and acceptance criteria for every phase. The table below is a navigation summary, not a replacement for those criteria. All phases also require applicable typecheck/lint/tests, review, accurate documentation, and handoff.

| Phase                                  | Status      | Scope                                                                                                                                                             | Dependencies / decision gates                                                                           | Main acceptance criteria                                                                                                                                |
| -------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Discovery, Architecture & Planning | DONE        | Workspace audit, module/database/API proposals, uncertainties, roadmap and handoff.                                                                               | Architecture approval Q01.                                                                              | Approved plan, documented stack/boundaries, open questions, four implementation documents, Phase 1 handoff.                                             |
| 1 — Foundation & Database              | DONE        | Web/API workspaces, Tailwind/shadcn, PostgreSQL/Drizzle/migrations, shared contracts, tooling and local setup.                                                    | Phase 0 DONE; Q02/Q04 schema implications and Q09 team identity reviewed before fixing affected schema. | Local startup, web-to-API health call, repeatable migrations, integrity constraints, UI tooling, passing checks, documented setup. No product UI.       |
| 2 — Authentication & Sessions          | DONE        | Admin login/logout, sessions, protected endpoints, shared admin/guarantor access, juror-access preparation, login UI.                                             | Phase 1; Q03 auth/provisioning.                                                                         | Tested login/logout, rejection of unauthorized access, consistent sessions and approved permissions.                                                    |
| 3 — Event & Jury Management            | DONE        | Events, jury groups, jurors, event/group membership and admin screens.                                                                                            | Phase 2; Q05 membership rules, Q10 size enforcement.                                                    | Event list/detail/edit, juror management, correct T/V assignment and rejection of invalid relationships; verified API/UI.                               |
| 4 — Voting Configuration & Teams       | DONE        | Voting/items/teams, D21 configuration, allowed groups, statuses, activation and closure.                                                                          | Phase 3; Q02, Q05, Q07, Q09, Q10 as applicable.                                                         | Selection/final configuration works; invalid activation rejected; explicit limits stored; T/V checks and tests. No ballot submission.                   |
| 5 — Juror Entry & Wizard Foundation    | DONE        | Identity/session, welcome, authorized steps, routing, progress and navigation.                                                                                    | Phase 4; approved Q03 juror identity.                                                                   | Correct event/category access for T/V; protected steps; usable mobile/desktop navigation. No complete voting engine.                                    |
| 6 — Voting Interaction & D21 Engine    | DONE        | Pure rules, plus/minus toggle/replacement/removal, limits, category UI and backend validation.                                                                    | Phase 5; confirmed Q02 with examples.                                                                   | Tested interactions/edge cases match methodology; server rejects invalid ballots; responsive UI. No multi-category final submit.                        |
| 7 — Ballot Drafts & Persistence        | DONE        | Save, resume, invalid drafts, persistence feedback and errors.                                                                                                    | Phase 6; Q04 independent categories and revision conflict policy confirmed.                             | Correct juror/voting ownership, database restoration, invalid draft excluded from submission, tested workflow.                                          |
| 8 — Submission & Locking               | DONE        | Authoritative validation, atomic storage, submitted state, retries, concurrency and locking.                                                                      | Phase 7; Q04 submission, Q08 locking.                                                                   | Valid submit succeeds; invalid and duplicate requests cannot corrupt data; submitted votes protected; PostgreSQL integration tests.                     |
| 9 — Multi-Category Wizard & Review     | DONE        | Authorized ordered steps, editing/review, full validation, final submit and confirmation.                                                                         | Phase 8; confirmed Q04.                                                                                 | T/V see only allowed steps; accurate review; safe final workflow; integration tests.                                                                    |
| 10 — Operational Dashboard             | DONE        | Actual-data KPIs, category cards, progress, juror detail, pending votes and attention states.                                                                     | Phase 9; time/threshold alerts deferred under Q10.                                                      | Correct eligible/submitted counts and problems; tested aggregates; responsive screens with real data.                                                   |
| 11 — Results & Ranking                 | DONE        | Plus/minus totals, score, ranking, multiple winners, ties, provisional/final results and API/UI.                                                                  | Phase 10; confirmed Q02 and Q06.                                                                        | Correct tested category totals, ranking, multiwinner cutoff, ties and provisional/final distinction.                                                    |
| 12 — Operational Hardening             | DONE        | Existing lifecycle/admin safety, audit, authorization/data integrity, retryable errors and XLSX results/participation exports. Deadlines/alerts excluded by user. | Phase 11; Q07/Q10 excluded; Q11 Phase 12 scope confirmed.                                               | Invalid transitions blocked, atomic audit/interventions, same-event integrity, protected consistent exports, critical error/concurrency/browser checks. |
| 13 — E2E & Production Readiness        | IN_PROGRESS | End-to-end admin/T/V voting/results, mobile/accessibility, containers, production setup and deployment docs.                                                      | Phase 12; Q11 hosting/operations.                                                                       | Critical E2E passes, repeatable startup/migrations, production setup, no blockers, complete documentation and review.                                   |

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

Historical Phase 2 plan: add additive credential/session/juror-access storage, operator password commands, shared auth contracts, guarded API routes, basic login/logout UI, meaningful auth tests, review and documentation. Juror wizard entry remains Phase 5. Phase 3 CRUD and voting engine work were outside that earlier session’s scope.

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

Historical Phase 2 handoff: Phase 3 required a new user-started session and Q05/Q10 decisions; both were supplied before Phase 3 implementation.

## Phase 2 routing follow-up — 2026-10-16

User-requested adjustment: `/` is the juror landing; shared-password administration is available only at `/admin/login`, with no public navigation link. Unknown paths must not display admin login. This is a small Phase 2 UI correction, not the start of Phase 3 or the Phase 5 wizard.

Acceptance: juror content on the root page, direct/refreshable admin login, working home navigation, page titles, responsive layout, unchanged API authentication, checks and updated handoff.

## Phase 3 session plan — 2026-10-16

Implement shared event/roster contracts, guarded event and jury APIs, sticky roster freezing with an additive migration, real-data admin screens, integration and browser validation, source review and handoff. Preserve existing authentication, configuration and applied migrations. No event/group deletion or archive; membership removal only before freeze and subject to existing RESTRICT references. Voting activation and its size validation remain Phase 4.

Git inspection found initial commit `0dafa82`; the working tree was clean at session start. Historical no-commit notes above describe earlier sessions. No commit is authorized in Phase 3.

## Phase 3 acceptance checklist

- [x] Shared runtime contracts and guarded event list/create/detail/edit API.
- [x] Event-scoped T/V group and juror management with correct same-event relationships.
- [x] Approved Q05 roster freeze and Q10 setup behavior; limited membership removal without history cascades.
- [x] Real-data event/jury administration screens, loading/empty/error states and accessible form controls.
- [x] Expanded PostgreSQL suite passes: 42 tests, including migration upgrade and concurrency checks.
- [x] Browser create/read/edit/group assignment, search, removal confirmation/cancel, authorization recovery, keyboard and responsive scenarios verified. Removal success is covered by PostgreSQL API integration tests.
- [x] Final `npm run check` and source/authorization/event-isolation review.
- [x] Accurate results/limitations and four-document handoff, including conditional Phase 4 scope.
- [x] PostgreSQL availability restored; database/browser validation completed and final acceptance recorded. Test services and generated browser database cleaned up.

Historical Phase 3 stopping point: Phase 3 is DONE; the required new user authorization for Phase 4 has now been received. No commit is authorized.

## Phase 4 session plan and acceptance — 2026-10-16

Inspect actual files/history/services and preserve uncommitted Phase 3 work. Ask for Q02 methodology/examples, remaining Q05 lifecycle and Q09 team/history decisions before affected implementation. Implement unaffected draft preparation, validate it against disposable PostgreSQL/browser services, review source and update the handoff. Continue dependent work only after explicit decisions. Recommendations are not approvals.

- [x] Inspect required documentation, source, scripts, migration history, Git and running services.
- [x] Protected voting draft create/list/detail/edit, strict shared contracts, selection/final labels and real-data responsive administration UI.
- [x] Preserve event-first locks, sticky freeze marker, existing schema/RESTRICT references and original migrations.
- [x] Validate implemented slice with `npm run check`, 87 PostgreSQL tests, migration repeatability/no drift, browser/keyboard/responsive/error recovery checks and source review.
- [x] Q02 Phase 4 configuration confirmed: explicit administrator-entered limits, no automatic rounding; selection chooses advancing teams, no reversed elimination mode. One negative requires two positives actually cast; interaction engine remains Phase 6.
- [x] Q09 resolved: shared event teams, cross-category descriptive corrections, same-event unique voting entries and draft-only entry editing; no removal/archive.
- [x] Configure draft T/V permissions with runtime validation, same-event references, atomic replacement and started/ballot-history edit rejection.
- [x] Implement active → closed with explicit UI confirmation, idempotent server operation and preserved ballot/configuration history.
- [x] Admin reopening of closed/archived voting without readiness checks, with history/sticky lock preserved and active retries idempotent. Draft reopening is rejected.
- [x] Freeze voting configuration/entries/permissions after first activation; shared team descriptive corrections remain allowed. First activation implemented. No deadlines introduced; Q07 remains a later gate.
- [x] Enforce equal 5/7/9 T/V groups and all approved configuration within event-first activation transactions; invalid activation rolls back without freezing setup.
- [x] Verify completed Phase 4 API/UI, invalid activation, event isolation, concurrency and additive migrations as needed; complete all phase acceptance criteria.

Phase 4 is DONE as of 2026-10-17. Phase 5 requires a new user-started session; do not continue automatically. Source review and all required validation are recorded in progress.md.

## Phase 5 session plan — 2026-10-17

User authorized Phase 5 only. Preserve uncommitted Phase 3/4 work, applied migrations, credentials and data. Implement admin-generated manually delivered reusable links without expiry; retain 12-hour sessions, link regeneration/revocation ending that juror’s sessions, current-membership authorization, welcome/ordered steps and responsive navigation. Show authorized active/closed/archived steps, hide drafts; order selection then final, creation time and ID. No voting interactions or ballot writes.

- [x] Inspect documentation, source, Git, migrations and services; baseline check and 87 PostgreSQL tests pass.
- [x] Obtain link lifecycle/delivery and unavailable-category decisions.
- [x] Implement and validate admin issuance/revocation and public entry/session recovery.
- [x] Implement server-authorized welcome/steps and protected deterministic navigation.
- [x] Verify real-backend T/V isolation, session/link lifecycle, keyboard and responsive states.
- [x] Run final checks/PostgreSQL tests, review security/integrity/scope and update handoff.

Phase 6 requires a new explicitly authorized session. No commit.

Phase 5 acceptance is complete: final checks, 109 PostgreSQL tests, browser/security/integrity review and cleanup passed. See progress.md for evidence and limitations. Stop here; Phase 6 must start in a new user-authorized session.

## Historical Phase 6 session plan — 2026-10-17

User explicitly authorized Phase 6 only. Implement the approved pure D21 engine, category controls and authoritative validation without ballot persistence or submission. Preserve prior work, immutable migrations, development credentials/data and event-first authorization.

- [x] Inspect source, required documentation, Git and services; baseline checks and 109 PostgreSQL tests pass.
- [x] Confirm invalid-edit behavior: retain edits reducing negative eligibility and explain the invalid state until corrected.
- [x] Implement pure immutable toggle/replacement/removal, stored maxima, negative disable/actual-cast ratio, optional usage and strict structural contracts.
- [x] Implement server-derived validation under the existing shared-event/session/group boundary; no ballot writes.
- [x] Implement desktop table/mobile grid, sticky counters, keyboard controls, selected markers, validation and retry feedback.
- [x] Verify real-backend interactions, caps, disabled negatives, stale closure, expiry, connection failure/retry and temporary-state reset.
- [x] Complete final checks/review, update all handoff documents and clean up owned verification services/database.

Final `npm run check` PASS (41 fast tests/typechecks/lint/format/builds), `npm run test:db` PASS (122 tests), browser checks and review complete. Phase 6 is DONE; no Phase 7 work or commit.

Stop after Phase 6. Phase 7 needs a new explicitly authorized session and Q04 decisions before affected persistence/submission contracts. No commit.

## Phase 7 session plan — 2026-10-17

User continuation authorizes Phase 7 only. Q04: independent per-category submission, allowing later return for remaining categories; closed/archived categories preserve drafts and reject saving/submission until reopened. Submission remains Phase 8. Multiple tabs must not collide: use expected revisions and explicit conflict recovery, retaining local edits.

- Inspect existing source/docs/Git/services; preserve all prior changes, applied migrations, credentials and development data.
- Add strict draft contracts and event-first transactional save/restore with current session/group/status/rule checks; retain structurally valid domain-invalid drafts as drafts.
- Add explicit save, restored choices, meaningful progress and stale-revision recovery; never silently overwrite local edits during revalidation.
- Validate PostgreSQL ownership, rollback, concurrency, closure/revocation/expiry, submitted-record preservation and browser desktop/mobile recovery.
- Review source, run checks, document actual results and prepare Phase 8 handoff. Stop after Phase 7; no commit.

## Phase 7 acceptance — DONE 2026-10-17

- [x] Strict owner-derived draft GET/PUT and current-group/status/item/rule authorization in an event-first write transaction.
- [x] Atomic replacement, revision increment, stale-save rejection, rollback and submitted/cancelled-record preservation.
- [x] Database restoration across refresh/navigation/logout/re-entry; independent category drafts including explicit empty and invalid drafts.
- [x] Derived not_started/in_progress/invalid_draft and existing submitted/locked progress, separate from availability and ballot lifecycle.
- [x] Explicit save/pending/success/failure, retained local edits, latest-version comparison and recovery, closed/reopened availability refresh.
- [x] Final check (41 fast tests/typechecks/lint/format/builds), 140 PostgreSQL tests, real-backend desktop/mobile/keyboard/error/security checks, migration repeat/no drift, source review and cleanup.
- [x] All four implementation documents and relevant wiki/README pages updated. No migration, external dependency, submission implementation or commit.

Stop after Phase 7. Phase 8 — Submission & Locking requires a new user-started session and Q08 decisions. Independent category submission must permit finishing the remaining categories later; a closed category cannot block writes to other open categories.

## Phase 8 session plan — 2026-10-17

User continuation authorizes Phase 8 only and approves administrator-only unlocking using the existing shared administration identity. Unlock returns retained choices to draft, preserves the original submission and unlock in history, and allows replacement by juror resubmission. Closed/archived categories still require reopening for juror writes. No commit.

Implement category submit with strict entries/expected revision, fresh authoritative validation, atomic entries/state/timestamp/history and safe matching retries. Increment revisions for submit/unlock so stale actions cannot affect later submissions. Add protected admin ballot listing/unlock confirmation and juror confirmation/recovery. Preserve independent categories, prior work, migrations and credentials/data. Validate real PostgreSQL failure/concurrency/authorization and browser workflows; review, update documentation/handoff and stop before Phase 9.

## Phase 8 acceptance — DONE 2026-10-17

- [x] Independent category submission with strict owner-derived authorization, fresh D21 validation and atomic entries/state/timestamp/history.
- [x] Matching retries and concurrent requests cannot duplicate submissions; monotonic revisions protect newer drafts/submissions/unlocks.
- [x] Submitted/cancelled records reject juror edits. Only administration can unlock submitted records; original choices/history survive and resubmission replaces the current submission.
- [x] Juror confirmation, read-only restoration, stale-tab comparison, explicit retry and administrator confirmation/cancel; other categories remain accessible.
- [x] Final source checks: typechecks/lint/format, 41 fast tests, builds; PostgreSQL 167/167; browser desktop/phone/landscape, keyboard, actual outage, stale closure/reopen and expiry checks.
- [x] Source review, migration repeat/no drift/unchanged hashes, documentation and owned test-service/database cleanup.

Stop after Phase 8. Phase 9 needs a new user-started session. No review/final-submit, dashboard/results, deadlines, independent administrative lock/reset/delete or commit was added.

## Phase 9 session plan — 2026-10-17

Implement authorized saved-data review, positive/negative choices and validity, return to edit, explicit category selection/confirmation, independent transactional final submission and per-category confirmation/recovery. Preserve submitted/unavailable/unselected categories and revision checks. Validate authorization, concurrent changes/retries/unlock/closure/rollback in PostgreSQL, then real-backend desktop/phone/keyboard/error workflows; review and update all handoff documents. Stop after Phase 9.

Baseline check PASS (41 fast tests), PostgreSQL 167/167 PASS after sandbox local-access rerun. No migration/dependency added. PostgreSQL 186/186, browser workflows, migration no-drift/hashes and cleanup pass. Final source check PASS: four typechecks, lint/format, 41 fast tests and both builds.

## Phase 9 acceptance

- [x] T/V owner-scoped ordered saved review, actual signs/team choices/validity and safe return-to-edit.
- [x] Explicit saved-category selection including labelled empty drafts, named/count confirmation and independent authoritative submission.
- [x] Per-category conflicts/retries/partial outcomes preserve earlier submissions and later-return drafts; no silent overwrite/resubmit/unlock.
- [x] Refreshable current confirmation, explicit newer-data loading, authorization clearing and phone/keyboard/error recovery.
- [x] PostgreSQL 186/186, real-backend browser checks, migration repeat/no drift/unchanged SQL, source review and owned-resource cleanup.
- [x] Final source verification after presentation cleanup/documentation: `npm run check` PASS; final documentation formatting/diff hygiene checked.

Stop after Phase 9. Phase 10 requires a new explicitly started session and Q10 decisions before affected alerts. No commit.

## Phase 10 session plan and acceptance — 2026-10-18

User explicitly authorized Phase 10 and deferral of time/threshold alerts. Implement real-data event/category projections, current eligible/submitted counts, category and juror drill-down, pending/factual problems and responsive administration UI. Preserve earlier work/data/migrations; stop before Phase 11 and do not commit.

- [x] Read continuity docs and inspect actual Git/source/services; baseline check and 186 PostgreSQL tests pass after local-access rerun.
- [x] Shared strict metadata-only contracts, guarded overview/category APIs, batched event-locked reads and post-wait session rechecks.
- [x] Correct eligible/current-submitted counts, independent category and group totals, distinct pending jurors, no audit-history inflation, zero/draft/unlock handling and factual problems.
- [x] Real-data administration screens, category cards, searchable/expandable juror details, refresh, empty/loading/error/session states and responsive controls.
- [x] Initial 200 PostgreSQL tests and browser desktop/phone/landscape, keyboard, actual outage/recovery/unlock/submission/expiry checks.
- [x] Final source check PASS (41 fast tests, four typechecks/lint/format/builds), PostgreSQL 200/200 PASS, review/documentation and generated-resource cleanup complete. Development data/credentials digest unchanged.

Phase 10 is DONE; final source/database checks, review, documentation and cleanup are complete. Q10 threshold/time alerts remain deferred. No results/ranking/ties/deadlines/destructive policy or commit. Phase 11 requires a new user-started session and Q06 decisions.

## Phase 11 session plan — 2026-10-18

User continuation authorizes Phase 11 only. Q06 approved: score = positives minus negatives, descending competition ranks with equal scores sharing rank; a tie crossing the configured cutoff remains unresolved and only teams wholly above it are selected. Results are final only for closed/archived categories with positive eligibility, all eligible submissions, no factual data problems and no unresolved cutoff tie; otherwise provisional. No tie-resolution workflow, publication, deadline, export or commit.

- Preserve uncommitted earlier phases, development data/credentials and immutable migrations.
- Implement pure ranking and cutoff detection, current eligible submitted-only server aggregates, strict results contracts and event-locked guarded read APIs.
- Add event/category results screens using current labels, explicit refresh/time, shared administration recovery, responsive rankings and textual tie/finality explanations.
- Validate pure edge cases, PostgreSQL history/retries/unlock/replacement/eligibility/lock waits, real-browser keyboard/responsive/error/expiry flows and source checks.
- Review, update continuity/wiki documentation, clean up owned test resources and stop after Phase 11.

## Phase 11 acceptance — DONE 2026-10-18

- [x] Q06 score/shared-rank/multiwinner cutoff/finality decisions obtained before affected implementation.
- [x] Strict shared aggregate contracts, guarded read APIs and current eligible submitted-only totals under the shared event/session lock boundary.
- [x] Pure score/rank/cutoff detection, zero/negative values, correct whole-group selection and no invented tie-break.
- [x] Derived provisional/final reasons, current shared labels and responsive real-data admin overview/detail, refresh/retry/session clearing.
- [x] 48 fast tests and intermediate source checks; final expanded PostgreSQL 216/216; real-backend browser desktop/phone/landscape/keyboard/outage/unlock/replacement/expiry.
- [x] Source self-review, migration repeat/no drift/unchanged hashes, generated resource cleanup and development data/config digest verification.
- [x] Final post-review source check PASS (four typechecks/lint/format, 48 fast tests, both builds) and completion handoff.

Stop after Phase 11. Phase 12 needs a new user-started session and Q07/Q10/Q11 decisions for affected scope; no Phase 13 or commit.

## Phase 12 session plan — 2026-10-18

User authorizes Phase 12. Q07 deadlines and Q10 alerts are explicitly unnecessary; the deadline acceptance criterion is superseded by this decision, not an unrun pass. Q11 scope is XLSX results + participation + export time and existing admin interventions only (close/reopen, unlock, regenerate/revoke access). No additional reset/delete/cancel/archive/publication policy or commit. Hosting/backups remain Phase 13 decisions.

- Preserve all uncommitted prior phases, development data/credentials and immutable migrations.
- Recheck older administrative authorization inside event-first transactions after lock waits; serialize event descriptive updates with snapshots.
- Atomically audit actual voting lifecycle and juror-access changes using shared admin identity, preserve existing submission/unlock history and idempotent no-op behavior.
- Export current results and participation from one shared event-locked snapshot, with provisional/final/tie/problem labels, duplicate-name IDs, readable XLSX formatting and literal text cells. No individual choices, history or credentials.
- Add an accessible event export action with pending/error/retry/session handling. Validate source, PostgreSQL concurrency/rollback/export contents, browser workflows and migration integrity; review, update documentation and hand off before Phase 13.

## Phase 12 acceptance — DONE 2026-10-18

- [x] Q07 deadlines/Q10 alerts explicitly excluded and Q11 existing interventions/XLSX contents confirmed before implementation.
- [x] Shared transaction authorization after locks/before commit, event metadata snapshot serialization and safe existing lifecycle/revision/freeze behavior.
- [x] Atomic current lifecycle/link audit with no secrets, unchanged submission/unlock snapshots and idempotent no-op behavior.
- [x] Protected consistent XLSX category/results/participation snapshot, UTC time, privacy, literal strings and provisional/final/tie/problem semantics.
- [x] Accessible browser export/pending/error/retry/expiry, keyboard focus and phone/landscape validation.
- [x] Final post-review source check PASS (52 fast tests/typechecks/lint/format/builds), PostgreSQL 246/246, migration integrity/no drift, cleanup/development-data preservation, documentation and handoff.

Deadline enforcement is not applicable by explicit user decision; never mark an unimplemented deadline check as passing. Stop before Phase 13; no commit.

## Phase 13 session plan — 2026-10-18

User continues from the Phase 12 handoff, requests local Linux hosting and a live colleague-testing instance, and approves Render + a separate Supabase database. The later budget clarification requires Free plans only for minor testing; no paid resources/add-ons/upgrades. No automatic test-data deletion; the user owns accounts/backups/restores. The user subsequently confirms both owning accounts and explicitly authorizes multiple short Conventional Commits/push for the tested package, without co-author trailers. Other projects must remain unchanged.

- [x] Inspect continuity documents, actual Git/source/services and preserve earlier work/data/migrations; baseline source and 246 PostgreSQL checks pass.
- [x] Repair built workspace imports; compile standalone server/migration/operator commands and preserve migration SQL.
- [x] Add one same-origin built web/API service, explicit validated proxy trust, Docker/isolated Linux Compose, and Render configuration.
- [x] Add repeatable built-app admin/T/V/D21/draft/review/dashboard/results/XLSX/unlock E2E plus accessibility, responsive, network/auth recovery checks.
- [x] Validate container startup, repeated migrations, hidden-password operator, real container HTTP voting and complete backup/restore row equality.
- [x] Finish source/browser review and document final 56 fast/246 PostgreSQL/6 browser passes, local container/restore evidence, limitations and the earlier isolated uncertain response; cleanup is recorded in progress/handoff.
- [x] Connect confirmed owning accounts, verify $0/free quotas/no Render card and obtain explicit commit/push/free-test provisioning authorization. Create only the separate Supabase test project; apply/repeat migrations with verified TLS and restricted backend access.
- [x] Provision only the new free Render service; push three Conventional Commits. Verify hosted PostgreSQL TLS, disabled Data API/GraphQL, migration repeat and clear security advisors; add portable trigger search-path hardening without editing the original four migrations.
- [ ] Deploy the corrected executable startup script, configure readiness, and verify live origin/cookies, proxy/throttling, voting/XLSX and remote backup/restore before inviting colleagues.

Phase 13 remains IN_PROGRESS until the live hosting gates and requested testing URL are handled. Local validation does not establish managed-provider readiness. Continue this same phase; no next phase. Authorized commits/push must use multiple short Conventional Commits without co-author trailers.
