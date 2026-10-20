# Implementation plan

## Automatic-links release — DEPLOYED, 2026-10-20

The user explicitly approved commit/push after requesting deployment. Commit `3f36f8364ed82eeeec01ba8435dbb3a1e95320f2` (**feat: automate juror links and clarify jury labels**) is pushed to main and deployed to the existing [Free test app](https://d21-voting-test.onrender.com), Render deploy `dep-dbbhqagm7kps73f1svr0`, confirmed **live at 07:51:03 UTC**. This publishes automatic encrypted first links, direct Copy/removal of the Osobní přístup panel and the preserved Technická/Veřejná label correction. No subsequent implementation phase is started.

**Live verification:** readiness/database connected 200, HTML administration login 200, unauthorized `/api/events` 401; all no-store. The served JavaScript `/assets/index-BY-bgUz7.js` matches the tested release build byte-for-byte. No error/fatal runtime logs were returned for the deployment window checked. The same service `srv-dbac88eq1p3s73b4jqm0` remains Free/Frankfurt, one instance, automatic deployment off, with unchanged origin/database/key/password/proxy settings and no paid/other-project changes. The initial Docker build passes; the final pre-publication rebuild reused all tested application layers. Publication scan passes across 214 files; all nine protected configuration/external-key/SQL fingerprints still match.

**Data and backups:** every pre-existing row matches its pre-release hash across all **15 public/drizzle tables** after deployment. Counts remain 8 events, 51 memberships, 91 ballots, 189 ballot entries, 199 audit records, 34 access rows, 53 sessions and six migration records. No hosted validation event, credential, ballot or session was created during release verification. Fresh private custom-format public/drizzle archives have validated manifests, 0600 files under the existing ignored 0700 directory:

- Pre: `backups/d21-polling-test-20261020T074723Z-pre-automatic-links.dump`, 83,032 bytes, SHA-256 `51adca087b2670a0eda27f900d922b23c15737a2d758eeaa33ce7c55ce923d4b`.
- Post: `backups/d21-polling-test-20261020T075204Z-post-automatic-links.dump`, 83,032 bytes, SHA-256 `e3d430ba885ca0904fca7fef2c2189f8f9c8e0c05a679aea8dbb1016c9280149`.

Both new archives and all older backups are retained; neither new archive was restored. The separately retained external key ring is unchanged. The earlier isolated Linux restore remains historical evidence, not a new restore test. No new schema/migration or application data cleanup was introduced; startup reused the existing six-migration history.

**Authenticated limitation:** the administration session expired overnight under the existing 12-hour policy. The user was asked to sign in while deployment proceeded; the refreshed live page still shows login. Authenticated hosted save/copy and session-retention checks were therefore **not rerun for this release**. No password reset, global revocation or synthetic administrative session was used. Those flows are covered by the already passing disposable local checks; live verification can continue after user sign-in. Do not describe previous releases' authenticated tests as new evidence.

**Validation and handoff:** the completed implementation's source check (77 fast tests, workspace/E2E typechecks, lint, formatting and both builds), PostgreSQL 306/306, full browser 21/21 and final affected access 3/3 after identity-description refinement remain valid historical local evidence; broad suites were not rerun solely for this source-unchanged release. Release documentation formatting/diff hygiene passes. All four implementation documents, README and relevant wiki reflect publication. A documentation-only release-report commit may follow the application source on main; auto-deploy remains off, so it needs no new application deployment. Task-owned temporary release helpers/fingerprints/credential files are removed after verification, while private archives/keys remain retained.

**Boundary:** membership-removal redesign and event/voting-finish cleanup remain deferred; retain current freezes/RESTRICT/history protection. No bulk distribution, unrelated feature, new voting/identity rule, paid resource or other-project change. No hosted authenticated workflow/load/multi-instance/full screen-reader/native-device/all-browser/new restore claim. A subsequent feature requires a new explicitly user-started session.

## Historical automatic-links release preparation — 2026-10-19

The user authorizes direct deployment after implementation, then asks to continue. This authorizes deployment of the completed automatic-links work and preserved Technická/Veřejná correction to the existing test app; no new feature phase. Repository `AGENTS.md` separately requires explicit commit authorization, so commit/push approval is requested for `feat: automate juror links and clarify jury labels`. No commit, push or deployment has occurred yet. Render requires published Git source; the current local and remote main are both `940608c`.

Release preparation PASS: local Linux Docker build `d21-voting:automatic-juror-links`; publication scan across 214 existing non-ignored files with no hosted credential/external key values; existing administrator session after refresh; exact existing Render Free/Frankfurt target and manual-deploy settings. Current live application remains `4995a2d` / `dep-dbat50dg1s2s73dec4a0` on `srv-dbac88eq1p3s73b4jqm0`, confirmed in the previously approved Jakub's workspace `tea-d91qrvhkh4rs73aqgbh0`. No service, plan, configuration, password or key changes.

Fresh private pre-release archive: `backups/d21-polling-test-20261019T152320Z-pre-automatic-links.dump`, **83,032 bytes**, SHA-256 `9fd969950643ea1866207bedf18a8057160d6c61157ed6b1a16265baefd0bf95`; mode 0600 under the existing ignored 0700 backup directory, custom-format public/drizzle manifest validated. It includes six migrations and a current 15-table row-fingerprint baseline (8 events, 51 memberships, 91 ballots, 189 entries, 199 audit records, 34 access rows and 53 sessions). Original records will be compared after deployment and narrowly labelled validation. This archive has not been restored; earlier isolated restore evidence remains historical. Existing archives/external key ring and nine protected configuration/SQL files are retained. Backup uses the same existing test database with verified TLS; no provider setting/schema/data mutation.

Application validation remains the completed phase's 77 fast tests/typechecks/lint/format/builds, full PostgreSQL 306/306, browser 21/21 and final affected access 3/3 after identity-description refinement; these broad suites were not rerun merely for release preparation. The first Docker build request was not executed because automatic approval review temporarily hit an account usage limit; after the user's continuation, the normal approval path succeeded and the build passed. Initial sandbox-only documentation fetches failed DNS; allowed direct official Markdown retrieval succeeded. Current Render deploy/health-check and Supabase changelog/backup guidance were read. No requirement or security assertion was weakened.

Next action after explicit Git approval: publish the tested release, manually deploy the exact published source on this same service, verify terminal live status/readiness/protected routes/current session and automatic first-link behavior without exposing secrets, compare every original hosted row, retain a private post-release archive, and update the release record. No automatic cleanup, paid resource, key rotation or other-project change is authorized. Until approval, leave the tested source local and the live app unchanged.

## Automatic juror links — DONE locally, 2026-10-19

The user-authorized bounded session is complete. Normal workflow: explicit juror save creates its first encrypted reusable link, then **Kopírovat odkaz** directly. `JurorAccess` and the **Osobní přístup** entry/panel/initial-generation flow are removed. [Complete workflow/API/transition](../wiki/automatic-juror-links.md).

- [x] Atomic table saving and supported individual creation, with existing external keys and secret-free public responses/audit.
- [x] Stable-ID retries retain credentials and sessions; missing key/storage/audit/auth failures leave no partial writes.
- [x] Existing encrypted/legacy links and history survive; revoked access is labelled and never revived by saving. Existing explicit confirmed exceptional replacement/restoration/revocation remains directly on the row.
- [x] Reads/previews/cancellation issue nothing; clipboard fallback, current authorization after lock waits, freezes and voting rules remain authoritative.
- [x] Source checks PASS (77 fast tests/typechecks/lint/format/builds); full local PostgreSQL **306/306**; full browser **21/21**, plus final affected access **3/3** after identity-description refinement.
- [x] Source/visual/keyboard/Axe review, development/configuration/migration preservation, fixture cleanup and documentation/handoff complete. See [actual sequence, failures and limits](progress.md).

No new schema/migration/dependency. No membership-removal redesign, cascading/soft deletion, finishing-time cleanup, bulk distribution, unrelated feature or subsequent phase. Work remains local/uncommitted on main after `940608c`, preserving the prior 28-file Technická/Veřejná correction and its documented validation. Hosted source remains `4995a2d` / `dep-dbat50dg1s2s73dec4a0`, auto-deploy off; no commit/push/deploy/cloud/live/credential/key/paid/other-project action. Further work requires a new explicitly user-started session. Suggested future commit only if authorized: `feat: create juror links automatically on save`.

## Historical authorization — automatic juror links, 2026-10-19

The user requests automatic link generation so each juror can be copied directly, and complete removal of the **Osobní přístup** flow. On 2026-10-19 the user explicitly instructs: “do it in a next session please and lets not worry about the removal now that will be handled by the event or voting finishing”. A new implementation chat is authorized for this bounded access phase. Membership-removal redesign is deferred: retain existing restrictive behavior, do not block this work on that question, and do not add soft deletion, cascades, access/history deletion or new automatic cleanup. Event/voting finishing and any later cleanup are outside this phase; the user's statement is future direction, not evidence that completion currently revokes access or removes data. The authorizing chat performed inspection and handoff only; implementation/validation belongs to the new chat.

Proposed bounded scope for that phase: create an encrypted, copyable personal link as part of successful explicit juror creation/table saving; make direct **Kopírovat odkaz** the normal action; remove `JurorAccess` and its panel/entry/issuance-confirmation flow. Reuse external keys, current event-first transactions, authorization and audit boundaries. Stable-ID retries must reuse the same link and never rotate access or revoke sessions on ordinary saves/copies. Failed validation, conflict, database/key/auth failure must commit neither partial roster changes nor partial credentials. Reads, previews and cancelled edits must not generate credentials. Preserve every existing active link/session, ballot/history and freeze rule; intentionally revoked access must not be silently revived. Legacy hash-only secrets cannot be recovered: decide an explicit transition before implementing their affected UI, without invalidating working links implicitly. Determine direct exceptional revoke/replacement controls without restoring the removed panel.

Actual inspected implementation: `jurors/table.ts` currently creates memberships only; `jurors/service.ts` also has the legacy create path. `auth/juror-access.ts` issuance currently rotates all links and revokes every juror session, so it must not be called unchanged for automatic creation or retries. Its protected copy path is read-only. `JurorControls` opens `JurorAccess`; `CopyJurorLink` is disabled for none/legacy. `juror_access`, sessions and audit use restrictive membership references; do not add cascades or delete access/history to bypass removal constraints. Relevant contracts and existing PostgreSQL/browser access, Jurors, workflow and recovery tests must be updated and run in disposable fixtures. No bulk distribution, unrelated category/duplication/readiness or new voting/identity rule is authorized by this request.

The prior Technická/Veřejná label correction remains completed locally and uncommitted, with its passing checks recorded below. Preserve its 28-file working tree; the earlier label commit/deploy approval request has not been answered. Existing live source remains `4995a2d`, main documentation tip `940608c`, automatic deployment off. No commit/push/deploy is authorized for new work yet. Preserve local/hosted configuration, external keys and all private backups.

## Jury label correction — DONE locally, 2026-10-19

The user requests replacing displayed T and V with **Technická** and **Veřejná**. This is a terminology correction to completed functionality, not a subsequent implementation stage. Shared presentation mapping covers administration, permission/comparison controls, the juror wizard, progress, results and XLSX. Jury selection has more room for the full labels. Spreadsheet paste accepts the exact new names as well as legacy T/V; both map to unchanged codes before existing validation. Stored/API codes, group UUIDs, editable descriptive group names, voting rules and all existing data remain unchanged. No schema/migration/dependency or hosted mutation.

Source `npm run check` PASS (77 fast tests, typechecks, lint, formatting and both builds). Existing PostgreSQL export/operations checks PASS 30/30 in a disposable local database. Targeted existing Jurors/category/full voting browser checks PASS 9/9 without retries across desktop, phone and landscape/reduced motion, including keyboard/Axe/no-overflow, both jury memberships, voting, results and XLSX. The full 21-case suite was not rerun. Desktop/phone/landscape Jurors screenshots are retained outside the checkout as `jury-labels-{desktop,phone,landscape}.png`; source review confirms code/identity preservation. Publication is not performed: the earlier explicit commit/push authorization covered the prepared Stages 4–5 release, not this later correction. Keep the existing deployment and private backups/keys intact. No next feature stage is started.

## Stages 4–5 release — DONE, 2026-10-19

Stages 4–5 are deployed to the existing [free test application](https://d21-voting-test.onrender.com), application source `4995a2dca12019045af01fb054bf724876fdd071`, Render deploy `dep-dbat50dg1s2s73dec4a0`, confirmed **live** at 08:20:34 UTC. The user explicitly approved private pre/post backups, then commit/push to main and deployment. Conventional Commit `feat: simplify juror and category preparation` was pushed. This release starts no new implementation stage. The same Render Free/Frankfurt service and Supabase Free test project remain in use; auto-deployment remains off, with no credentials/key rotation, paid resource or other-project change. Documentation-only release reporting may follow the application commit on main and does not require redeployment.

**Release checks:** local Linux Docker image build PASS; publication scan PASS across 213 non-ignored files with no hosted database credential or external link-key values found. Render built the exact published source and readiness returned 200/database connected; HTML admin login returned 200 and unauthenticated `GET /api/events` returned 401, all no-store. Initial probe used a nonexistent `/api/admin/events` route and omitted the HTML Accept header; its 404s were probe mistakes, corrected using actual routing. Existing admin session survived deployment. Runtime startup/readiness logs and authenticated Jurors/Teams/category screens PASS. Source/database/browser validation remains recorded under Stage 5 below; those broad suites were not rerun against hosting.

**Hosted workflow:** retained labelled event `fbcc9ba7-e3ae-44fe-b520-8544e66a8834` (**Ověření nasazení Stages 4–5 — 2026-10-19**), one test juror `3579a860-fc35-4a11-8719-fc3b77d40976`, automatically created missing T/V groups, one team `93d476a8-d78f-4c5f-919d-1631ad41444b`, and draft category `799abf48-d6ba-4eaf-a38e-eb25a6f44795`. One combined category save persisted name/instructions/final type, explicit rule tuple 1/2/0/no negatives, T permission and the team entry/order 0; navigation and reload confirmed persistence. No category activation, personal credential generation or voting. Final hosted screenshot was visually reviewed outside the checkout at `/Users/jakubsmejkal/.codex/visualizations/2026/10/18/01a150cd-c280-7880-aad1-712eee8294c6/stages45-live-category.jpg`.

**Preservation/backups:** exact row-hash comparison across all 15 public/drizzle tables confirmed every original row unchanged both after deployment and after the labelled checks. Original six events, 91 ballots, 189 ballot entries, 199 audit records, 34 access records, 53 sessions and six migration records survive. Only the labelled test setup adds rows (now seven events, 48 memberships, 12 groups, 52 teams, 15 categories, 121 entries, 22 allowed-group rows). Pre archive `backups/d21-polling-test-20261019T081831Z-pre-stages45.dump` is 82,019 bytes, SHA-256 `7e439c3216bb1b81d561af03d88ea2c59f7c7c0c1f65e1ceed432ea03fee8dac`; post archive `backups/d21-polling-test-20261019T082317Z-post-stages45.dump` is 82,752 bytes, SHA-256 `44053d768466b1be5396382fe532495e85a0f929d0dc4924a09bd27b98eb3b0d`. Both private custom-format archives have validated manifests, 0600 files under ignored 0700 directory. These new archives were not restored; the earlier isolated Linux restore remains historical evidence. Automatic review initially blocked exporting sensitive database rows; explicit owner approval resolved the block. Two initial empty export attempts failed on service-file quoting, corrected before publication; only those empty owned artifacts were removed. Existing backups are retained. Root `.env`, ignored hosted configuration, external key ring and all six original SQL files match their private pre-release hashes (nine files). No schema/migration/dependency or key change. Owned temporary release helpers and fingerprints are removed after verification; backup archives and the final screenshot are retained.

**Remaining direction:** original Phases 0–13 and Simplification Stages 1–5 are complete. Possible next bounded stages are bulk personal-link copying/distribution, duplication/bulk preparation, category tables/import and readiness/preflight tools. Exact scope and affected product decisions require a new explicitly user-started session; no next phase is started. Future physical Linux hosting needs the actual machine/origin and a user request. Full native-device/screen-reader/all-browser/load/multi-instance/native spreadsheet and managed-Supabase restore checks remain limitations. Deadlines/alerts remain excluded. Earlier local-only/no-publication statements below are historical stage-completion boundaries, superseded only by this separately approved release.

## Simplification Stage 5 — DONE locally, 2026-10-19

User continuation adopts the concrete recommended scope after inspection: one combined create/edit form per category, atomic saving, retained field errors, stable IDs/exact retries and explicit stale comparison. Preserve incomplete drafts and existing entry IDs, with no removal, inferred limits or automatic credentials. Lifecycle actions stay separate. All work stays local; preserve uncommitted Stage 4 on main after `21aae5c`.

- [x] Read programme/continuity/reference and actual Git/source; establish the bounded scope and resolve combined-save/retry behavior through the user's continuation.
- [x] Strict setup snapshot/save contracts and guarded event-first all-or-nothing persistence; no-write exact replay and precise fingerprint conflicts; preserve legacy incomplete data, entry identities and domain/history rules.
- [x] Combined create/edit form, labelled fields/T-V controls/entries, retained errors/values, explicit comparison/discard, separate lifecycle confirmation and keyboard recovery.
- [x] Source checks PASS (77 fast tests/typechecks/lint/format/builds), full PostgreSQL 297/297 plus final focused category 17/17, full fixed-build browser 21/21 plus final category 3/3 after the blank-order correction; source/visual/Axe/keyboard/44px/no-overflow review.
- [x] Exact development/configuration/all-six-SQL preservation, unchanged initial source outside the Stage 5 allowlist, no schema drift, zero generated DBs/fixture APIs, owned helper cleanup and all four documents.

Bulk personal-link copying, duplication, category tables/import and new readiness tools remain later work. Stop after Stage 5. No commit/push/deploy/cloud/live operation.

## Simplification Stage 4 — DONE locally, 2026-10-18

User explicitly starts this new session for the Jurors table and automatic T/V groups. Scope: inline names/assignments, spreadsheet preview, one atomic save, retained field errors, explicit stale comparison and stable-ID retries. Missing groups are created only by successful explicit table saves on unfrozen events; preserve existing names/IDs and every freeze/access/history/voting rule. No publication or later-stage work.

- [x] Read continuity/reference and actual source/Git; inspect group creation, membership and sticky-freeze constraints.
- [x] Implement strict guarded atomic table API, automatic missing groups and no-write exact replay without migration/dependency.
- [x] Implement editable rows, preview/errors/comparison and existing personal access/removal/group rename controls.
- [x] Final source checks (73 fast tests/typechecks/lint/format/builds), PostgreSQL 280/280, final fixed-build browser 18/18 without retries, keyboard/Axe/44px/no-overflow and source/visual review.
- [x] Exact development public-table/configuration/all-six-SQL preservation; 14 tables/no schema drift; zero generated databases/no fixture API servers, owned helper cleanup and all four handoff documents.

**Deployment update, 2026-10-18: DONE.** Stages 1–3 are live on the existing [free test service](https://d21-voting-test.onrender.com), source `a79338c`, Render deploy `dep-dbaimoeq1p3s73bqt4sg`. Six migrations, hosted preservation, authenticated workspace/Teams and test-link revocation checks pass. Clipboard success was announced twice; the browser connector returned an empty clipboard, so live copied-text equality is unverified (local automated copying/fallback passed). Earlier local-only statements below describe historical stage boundaries. User explicitly approves a new Stage 4 chat for the Jurors table, including automatic T/V groups. That release session did not implement Stage 4; current local completion is recorded above.

Updated 2026-10-18. Status values: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `DONE`.

**Simplification Stage 3: DONE and deployed.** Teams-only editable names/descriptions/new rows, tab-separated spreadsheet preview, one atomic table save, retained inline errors, explicit stale-edit comparison and safe retries without duplicate additions. Duplicate names stay distinct; no deletion. Source checks (68 fast tests), PostgreSQL 265/265, full fixed-build browser 15/15, source/visual/accessibility review, preservation/cleanup and documentation/handoff are complete. The separately authorized release above is complete. Stage 4 subsequently completed locally in its approved new chat (see above); broader category/bulk work remains later.

**Simplification Stage 2: DONE.** Compact event workspace with Preparation, Voting progress and Results; focused juror/team/category preparation; existing Stage 1 and voting behavior preserved. Local only, without commit, push, deployment or live/cloud changes. Source/PostgreSQL/browser validation, source review, documentation and handoff are complete. Stage 3 adds Teams-only table work; broader later-stage work remains unimplemented.

**Simplification Stage 1: DONE.** Prior local untimed juror sessions, safe migration/transition, encrypted repeatable personal-link retrieval and direct roster copying remain preserved. Read the Stage 1 key/transition guide before operating this version.

Historical programme completion: Phases 0–11 are DONE. Phase 11 results API/UI, approved Q06 rules, final source/database/browser validation, review, documentation and cleanup are complete. Phase 12 is DONE after final source/PostgreSQL/browser validation, review, documentation and cleanup. Phase 13 is DONE after local and live end-to-end validation, controlled recovery, review and documentation. The user excludes deadlines and alerts and approves XLSX results/participation exports plus hardening/auditing existing admin actions. Historical Phase 13 authorized Conventional Commits/push for its free test deployment; Stage 1 does not inherit that authorization.

The [original brief, section 18](../wiki/master-implementation-prompt.md) defines the full scope and acceptance criteria for every phase. The table below is a navigation summary, not a replacement for those criteria. All phases also require applicable typecheck/lint/tests, review, accurate documentation, and handoff.

| Phase                                  | Status | Scope                                                                                                                                                             | Dependencies / decision gates                                                                           | Main acceptance criteria                                                                                                                                |
| -------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Discovery, Architecture & Planning | DONE   | Workspace audit, module/database/API proposals, uncertainties, roadmap and handoff.                                                                               | Architecture approval Q01.                                                                              | Approved plan, documented stack/boundaries, open questions, four implementation documents, Phase 1 handoff.                                             |
| 1 — Foundation & Database              | DONE   | Web/API workspaces, Tailwind/shadcn, PostgreSQL/Drizzle/migrations, shared contracts, tooling and local setup.                                                    | Phase 0 DONE; Q02/Q04 schema implications and Q09 team identity reviewed before fixing affected schema. | Local startup, web-to-API health call, repeatable migrations, integrity constraints, UI tooling, passing checks, documented setup. No product UI.       |
| 2 — Authentication & Sessions          | DONE   | Admin login/logout, sessions, protected endpoints, shared admin/guarantor access, juror-access preparation, login UI.                                             | Phase 1; Q03 auth/provisioning.                                                                         | Tested login/logout, rejection of unauthorized access, consistent sessions and approved permissions.                                                    |
| 3 — Event & Jury Management            | DONE   | Events, jury groups, jurors, event/group membership and admin screens.                                                                                            | Phase 2; Q05 membership rules, Q10 size enforcement.                                                    | Event list/detail/edit, juror management, correct T/V assignment and rejection of invalid relationships; verified API/UI.                               |
| 4 — Voting Configuration & Teams       | DONE   | Voting/items/teams, D21 configuration, allowed groups, statuses, activation and closure.                                                                          | Phase 3; Q02, Q05, Q07, Q09, Q10 as applicable.                                                         | Selection/final configuration works; invalid activation rejected; explicit limits stored; T/V checks and tests. No ballot submission.                   |
| 5 — Juror Entry & Wizard Foundation    | DONE   | Identity/session, welcome, authorized steps, routing, progress and navigation.                                                                                    | Phase 4; approved Q03 juror identity.                                                                   | Correct event/category access for T/V; protected steps; usable mobile/desktop navigation. No complete voting engine.                                    |
| 6 — Voting Interaction & D21 Engine    | DONE   | Pure rules, plus/minus toggle/replacement/removal, limits, category UI and backend validation.                                                                    | Phase 5; confirmed Q02 with examples.                                                                   | Tested interactions/edge cases match methodology; server rejects invalid ballots; responsive UI. No multi-category final submit.                        |
| 7 — Ballot Drafts & Persistence        | DONE   | Save, resume, invalid drafts, persistence feedback and errors.                                                                                                    | Phase 6; Q04 independent categories and revision conflict policy confirmed.                             | Correct juror/voting ownership, database restoration, invalid draft excluded from submission, tested workflow.                                          |
| 8 — Submission & Locking               | DONE   | Authoritative validation, atomic storage, submitted state, retries, concurrency and locking.                                                                      | Phase 7; Q04 submission, Q08 locking.                                                                   | Valid submit succeeds; invalid and duplicate requests cannot corrupt data; submitted votes protected; PostgreSQL integration tests.                     |
| 9 — Multi-Category Wizard & Review     | DONE   | Authorized ordered steps, editing/review, full validation, final submit and confirmation.                                                                         | Phase 8; confirmed Q04.                                                                                 | T/V see only allowed steps; accurate review; safe final workflow; integration tests.                                                                    |
| 10 — Operational Dashboard             | DONE   | Actual-data KPIs, category cards, progress, juror detail, pending votes and attention states.                                                                     | Phase 9; time/threshold alerts deferred under Q10.                                                      | Correct eligible/submitted counts and problems; tested aggregates; responsive screens with real data.                                                   |
| 11 — Results & Ranking                 | DONE   | Plus/minus totals, score, ranking, multiple winners, ties, provisional/final results and API/UI.                                                                  | Phase 10; confirmed Q02 and Q06.                                                                        | Correct tested category totals, ranking, multiwinner cutoff, ties and provisional/final distinction.                                                    |
| 12 — Operational Hardening             | DONE   | Existing lifecycle/admin safety, audit, authorization/data integrity, retryable errors and XLSX results/participation exports. Deadlines/alerts excluded by user. | Phase 11; Q07/Q10 excluded; Q11 Phase 12 scope confirmed.                                               | Invalid transitions blocked, atomic audit/interventions, same-event integrity, protected consistent exports, critical error/concurrency/browser checks. |
| 13 — E2E & Production Readiness        | DONE   | End-to-end admin/T/V voting/results, mobile/accessibility, containers, production setup and deployment docs.                                                      | Phase 12; Q11 hosting/operations.                                                                       | Critical E2E passes, repeatable startup/migrations, production setup, no blockers, complete documentation and review.                                   |

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
- [x] Deploy the corrected startup script on Render Free; verify live readiness, HTTPS browser entry, origin guards, logout cookie flags, no-store/privacy headers and a private hosted-data dump restored into a generated local DB with exact 15-table equality.
- [x] Use the user-configured credential with explicit testing authorization; complete all six live browser cases, actual T/V/D21/review/dashboard/results/XLSX/unlock/replacement, targeted session loss and link-revocation checks.
- [x] Verify independent admin sessions and spoofed-header throttling; keep conservative proxy trust disabled and document the shared peer-IP bucket.
- [x] Verify a controlled hosted-database interruption returns sanitized 503 and restores sessions/results; redeploy the test service and verify retained sessions/results/XLSX and five migration records.
- [x] Back up populated hosted data after test-link cleanup, restore all 15 tables exactly, and verify login/final results/XLSX in an isolated Linux application container. Preserve the existing user event and local credentials/migrations; remove owned helpers/restore DB/container.
- [x] Complete technical review and final documentation/handoff within the unpaid testing and portable-Linux scope. No new product rules or paid resources.

Phase 13 is DONE within the approved free colleague-testing and portable Linux hosting scope. The live address and recovery evidence are recorded in progress and deployment documentation. No automatic next phase. Native Linux x86, load/multi-instance work, full screen-reader/native spreadsheet audits and a restore into managed Supabase remain explicit limitations, not passing claims. Provisioning the future physical Linux host requires its actual machine/origin and a user request. Authorized commits/push use short Conventional Commits without co-author trailers.

## Simplification Stage 1 — 2026-10-18

- [x] Inspect AGENTS/README/all implementation docs/relevant wiki, actual source and clean Git on main at 38112f4.
- [x] Untimed juror sessions/contracts/cookies/UI, unchanged admin expiry, current authorization/logout/revocation/closure semantics and safe existing-session transition.
- [x] Additive 0005 with ballot/history/credential preservation; immutable earlier SQL and migration repeat/no drift.
- [x] Secure encrypted repeatable retrieval with external versioned keys, safe missing-key failure/rollback, preserved legacy hash-only entry and explicit replacement.
- [x] Direct roster Copy, accessible success/fallback/keyboard behavior, explicit absent/legacy labels and retained consequential confirmations.
- [x] Meaningful initial source/PostgreSQL/desktop-browser validation and source self-review.
- [x] Final corrected source check (60 fast tests/typechecks/lint/format/builds), PostgreSQL 252/252 with two workers, full desktop/phone/landscape browser 9/9, preservation/cleanup, review, documentation and completion handoff.

Stop after Stage 1; no subsequent-stage implementation or publication.

## Simplification Stage 2 — 2026-10-18

- [x] Read continuity documentation/reference and inspect actual source, Git and local services; preserve uncommitted Stage 1.
- [x] Shared event heading and Preparation / Voting progress / Results navigation across event and category screens, existing URLs retained.
- [x] Focused Porotci / Týmy / Kategorie preparation using refreshable query links, compact header/spacing and disclosed event metadata.
- [x] Preserve Stage 1 copying/access, existing forms/confirmations, endpoints, rules, locks, revisions, history and results/export semantics.
- [x] Source checks (60 fast tests, typechecks, lint, format, builds), PostgreSQL 252/252, built-app desktop/phone/landscape browser 12/12 and schema no drift.
- [x] Source/visual/accessibility review, development data/configuration/migration preservation, generated-resource cleanup, documentation and handoff.

Stop after Stage 2. Later tables/batch/category/bulk/readiness work needs a new user-started session with exact scope. No commit/push/deploy.

## Simplification Stage 3 — 2026-10-18

- [x] Read required continuity/reference documents, inspect actual Git/source, preserve all uncommitted Stage 1/2 work and obtain exact scope/save-semantics approval before affected implementation.
- [x] Teams-only inline editable rows and spreadsheet preview; labelled fields, retained errors/values, explicit save, comparison and cancellation, 44px controls and phone reflow.
- [x] Strict same-event/admin guarded table API, event-first atomic save with post-lock/completion authorization, precise snapshot conflicts, stable UUID additions and no-write exact replay.
- [x] No deletion/name merging, unchanged shared-team descriptive propagation and preserved snapshots/ballots/history/freezes/access/domain rules. No schema/migration/dependency change.
- [x] Final source check (68 fast tests/typechecks/lint/format/builds), PostgreSQL 265/265, final fixed-build browser 15/15 without retries, Axe/keyboard/no-overflow/44px and source/visual review.
- [x] No schema drift, unchanged development public-table/configuration/all-six-SQL fingerprints, earlier source preservation, zero generated databases, fixture/helper cleanup, all four implementation docs plus README/wiki/module updates and handoff.

Stage 3 is DONE locally. Stop here. Jurors/categories tables, automatic T/V, combined category setup, bulk assignment/copy/duplication and readiness remain later direction with scope to be approved in a new user-started session. No commit/push/deploy/cloud/live operation.
