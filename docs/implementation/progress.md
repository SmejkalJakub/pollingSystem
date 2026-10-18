# Progress

Updated 2026-10-18.

## Actual state — Phase 13 in progress

**Phases 0–12: DONE. Phase 13: IN_PROGRESS.** The user approved local Linux hosting plus Render and a separate Supabase colleague-testing database, with no automatic data deletion and owner-managed accounts/backups/restores. The local package and validation are complete. The named accounts and multiple Conventional Commits/push are explicitly authorized. The separate Supabase project and Render Free service are live at `https://d21-voting-test.onrender.com`. Private admin password setup and authenticated live verification remain open. No paid resources are authorized. Preserve development credentials/data.

## Current unpaid-testing amendment — 2026-10-18

User requires unpaid minor colleague testing before obtaining the local Linux server. Render + separate Supabase remains the approved target, now **Free + Free only**; the earlier paid plan proposal is superseded. Updated `render.yaml` to `plan: free`, replaced the paid pre-deploy hook with migrate-then-start, and documented local container-based password setup because Free has no remote shell. No paid resource/add-on/upgrade is authorized. Confirm $0 quotas/no overage billing before provisioning. Provider cold-start/inactivity limits are documented in the deployment guide. The subsequent authorized provisioning record below supersedes the initial configuration-only stopping point.

## Authorized free provisioning — 2026-10-18

- User confirms Supabase “SmejkalJakub's Org” and Render “Jakub's workspace”; explicitly forbids changing other projects. User authorizes commit/push with more than one short Conventional Commit and no co-author trailers.
- Supabase Free project quote is $0/month. Created only `d21-polling-test`, ref `ieqmrqctivjiljzyyucn`, Frankfurt, active/healthy. Existing Story Teller/Stribograd metadata was inspected only; no SQL/configuration writes there. Render Hobby dashboard shows no payment card, $0 charges and unused 750-hour/5-GB/500-minute quotas. No shared billing changes.
- Disabled the new project's Data API before application migrations; removed pg_graphql. Added dedicated non-superuser `d21_app`, restricted its default grants, and generated its password privately. Only a SCRAM verifier entered provider migration history. Private ignored mode-0600 `deploy/.env.test` retains its connection, separate from development `.env`.
- Initial role setup rolled back because postgres could not change another role's defaults; verified rollback, then set defaults through the app role itself. Initial migration rejected schema creation despite pre-created schema; granted CREATE on this database and reran successfully. No immutable migration changed. The compiled migrator applied and repeated successfully over the IPv4 session pooler; no provider-role table grants remain.
- Certificate verification initially rejected the provider CA. Downloaded the public certificate linked by the dashboard, included it in the image and configured Node's extra CA before process startup. Verified encrypted connection as `d21_app`; no verification bypass. Node 22.13 `--env-file` alone did not activate extra trust, so local commands set the non-secret CA path before launching Node.
- Latest `npm run check` PASS: 56 fast tests, all workspace/E2E typechecks, lint, formatting and both builds. Render public draft-2020-12 JSON schema PASS after quoting `'off'` (PyYAML 1.1 otherwise coerced it to false). Docker's added certificate layer still requires final image/provider verification. No new application behavior changed in this continuation.
- Render service, live browser/security/backup checks and final phase acceptance remain pending. Earlier local cleanup statements below describe the pre-provisioning stopping point.

## First cloud deploy and reviewed correction — 2026-10-18

- Pushed three authorized Conventional Commits to `origin/main`: `d7b0d76` (rules/contracts/ranking), `ea6a92e` (API/web/E2E), `b60d3b5` (portable hosting/docs). No co-author trailers. Ignored credentials were excluded.
- Created only Render `d21-voting-test` (`srv-dbac88eq1p3s73b4jqm0`), Free, Frankfurt, auto-deploy off, source this repository/main, URL `https://d21-voting-test.onrender.com`. Initial image build passed; deploy `dep-dbac88uq1p3s73b4jrrg` failed at startup because Render passed the inline shell command with incompatible quoting. No successful first live deployment is claimed.
- Replaced the inline command with executable `deploy/start-test.sh`, copied with mode 755. The script exits on failed migration and execs the server to preserve shutdown handling. Updated Blueprint passes Render's public schema. Final Linux ARM64 image build PASS; exact script against the new Supabase database returns ready/connected on an owned loopback container.
- Supabase security advisor identified mutable search_path on the existing invoker-only roster trigger. Generated additive Drizzle migration `0004_freeze_roster_search_path.sql` pins `public, pg_temp`; SQL 0000–0003 remain unchanged. There are now **five** migrations and still 14 tables. An integration assertion verifies the fixed path and invoker security. Initial DB rerun had one legacy upgrade-fixture count assertion expecting four; updated it to five, then all **246/246 PASS**. Built-app browser **6/6 PASS** with five migration records; source check remains 56 fast tests/typechecks/lint/format/builds PASS, with subsequent fixture/script formatting checked separately.
- Final-image startup applied migration 0004 to only the new test project. Supabase security advisors now return no findings. Public-key HTTP checks for events/admin_access/ballots and GraphQL all return 503/PGRST002 with no data, consistent with disabled Data API; SQL confirms no provider-role table grants and no pg_graphql extension.
- Requested private operator password setup from the user; no password is requested in chat. Corrected Render deployment, live authentication/voting/backup and final handoff remain pending.

## Live free instance and final stopping point — 2026-10-18

- Follow-up `901c63b` (`fix: harden database and test startup`) was committed/pushed without trailers. Render Docker command and HTTP readiness settings were updated on only `srv-dbac88eq1p3s73b4jqm0`, matching the checked-in Blueprint. Manual deploy `dep-dbacbn6q1p3s73b4uqj0` is **live**, exact source `901c63b`, Free/Frankfurt/auto-deploy off. Provider logs show successful migration and PID-1 server startup. Recent error-level logs are empty.
- Live HTTPS checks PASS: root HTML; browser-style direct `/admin/login` HTML and actual browser login screen; `/api/ready` ready/database connected; unauthenticated event access 401; API/missing assets JSON 404; no-store, no-referrer and nosniff headers; wrong-origin actual admin-login/logout endpoints 403; allowed-origin logout 204 with Secure/HttpOnly/SameSite=Strict host-only cookie flags. Initial generic HTTP probe omitted HTML Accept and used the wrong login path; corrected probe and real browser pass. No authentication success is inferred from logout-cookie checks.
- New Supabase SSL enforcement visibly enabled. Data API/GraphQL HTTP checks return no app data; 14 tables/five migration records/no API-role table grants/no pg_graphql verified. Security advisors clear. Read-only inventory confirms existing Story Teller remains suspended/inactive and Stribograd remains healthy; no existing project received SQL or configuration writes.
- Saved private `backups/d21-polling-test-20261018.dump` (mode 0600; directory 0700). PostgreSQL 17 custom dump of the hosted app's public/drizzle schemas restored into a generated local DB with exact sorted row equality across all **15 tables**, including five migration records. Generated restore DB absence verified. This is a pre-colleague snapshot with no admin password/events/ballots yet, not a managed Supabase restore or future-data backup. Owner-managed manual backup cadence before/after testing and before deployment is documented. Temporary service credentials removed; the dump remains ignored/private by the approved retention policy.
- Owned final-image validation container was stopped/removed; original development PostgreSQL unchanged. Live screenshot `phase13-live-login.jpg` is outside the repository in this session's visualization directory. The live admin browser tab is retained for the user.
- Final post-correction `npm run check` PASS again: 56 fast tests, all workspace/E2E typechecks, lint, formatting and builds. Generated browser/restore database count is 0; original SQL 0000–0003 match the reviewed pre-hardening commit. Final owned helper removed; Git/diff hygiene checked.
- **Pending user input:** choose the shared admin password privately with the hidden operator targeting ignored `deploy/.env.test`; an asynchronous prompt supplies the exact command and requests only “done”, never the password. No credential seeded. Until then, authenticated live login/T/V/draft/submit/results/XLSX/restart checks are unrun. Proxy trust remains disabled; separate-client rate limiting and a restore back into managed Supabase are not claimed. Phase 13 stays IN_PROGRESS; the free deployment is live but colleague use still requires password setup and final authenticated verification.

## Phase 13 implementation and review

- Corrected a real production-build issue: the API previously imported workspace TypeScript at runtime. Both workspace packages are now bundled, with flat compiled server/migrate/operator entry points and unchanged migration copies. Production commands need no TypeScript loader. Optional `MIGRATION_DATABASE_URL` separates a direct migration target from the pooled runtime URL.
- Added opt-in combined static/SPA hosting with the same protected API under `/api`; development retains Vite/root API. Direct admin/wizard links work; unknown API/assets and non-GET pages remain JSON 404s. No-store, no-referrer and nosniff apply to the combined service. Existing identity, D21, event locks, sessions, submission/replay/unlock/history, results and XLSX rules remain unchanged.
- Proxy trust defaults off and requires validated IP/CIDR configuration. Existing explicit APP_ORIGIN still controls origin guards, secure cookies and link generation. No provider proxy range or distributed throttle is invented.
- Added a Node 22/npm 11.6.2 multi-stage non-root Docker image, separate Linux Compose database/volume with migration-success startup gating, ignored environment example, manual-deploy Render Blueprint and [deployment/backup/live-check guide](../wiki/deployment.md). Review added nested-environment and dump exclusions to Docker/Git and documented disabling Supabase Data API/GraphQL before migrations, since application authorization is not a Supabase RLS policy.
- Added dev-only Playwright/axe, typed browser fixtures/config and integrated admin/T/V/D21/draft/review/confirmation/dashboard/results/export/unlock plus protected-route/network/session recovery checks. Generated local databases and compiled real HTTP servers only; no development credential replacement. Traces/videos/automatic failure screenshots are off; explicit results screenshots contain disposable data.
- Source self-review covered static/API prefix boundaries, unchanged guards, explicit proxy trust, sanitized configuration errors, workspace packaging, migration paths/override, image secrets/non-root/runtime dependencies, fixture ownership/cleanup, full current-submitted counting and live provider assumptions. No voting rule or applied migration was changed. The image retains the designed light palette even when the browser prefers dark; that preference and reduced motion were exercised, not a new dark theme.

## Phase 13 validation actually performed

- Baseline `npm run check` PASS: 52 fast tests, four typechecks/lint/format/builds. Baseline PostgreSQL initially failed sandbox TCP access with all 246 assertions skipped; the local-access rerun passed 246/246. Compose development PostgreSQL was healthy and no project 3001/3002/5173/5174 listener was present. No unrelated service was stopped.
- Final source `npm run check` PASS after production-source review: **56 fast tests**, all four workspace typechecks plus the E2E TypeScript check, lint/format and API/web builds. New cases cover static/SPA/API routing and headers, explicit proxy versus forged direct headers, validated configuration and secret-free errors. A first test expected a unique configuration path but Zod returned it twice; configuration diagnostics now deduplicate paths and handle malformed origins without leaking input.
- PostgreSQL **246/246 PASS** after hosting-route changes. No domain/schema/SQL mutation was needed. `npm run db:generate` reports **14 tables/no drift**. All four SQL migration hashes and `.env` fingerprint match the preserved baseline. Test helpers use generated databases; no development migration/data/credential write was performed.
- Final browser **6/6 PASS** on the final build, run separately from builds/database suites: desktop 1280×900, phone 375×812 and landscape 812×375 with dark browser preference/reduced motion. New fixture migrates twice using a dedicated generated migration URL while the runtime URL passed to the migration subprocess is deliberately unusable; four migration records remain. Each project starts/stops its own compiled server and removes its own generated database.
- Browser coverage: UI event/T/V-group/juror/team/selection/rule setup and real activation; repetitive roster/items/final categories use guarded HTTP. Both juries see only allowed categories and direct forbidden submit/detail return 404. Negative disable, invalid-submit rejection, same-sign removal/opposite replacement/keyboard Space, explicit save and refresh restoration, no automatic review selection, keyboard confirmation/cancel/focus, independent final submission, exact no-write replay and rejected submitted edits all pass.
- Dashboard first verifies 6/30 and later completes all **30** eligible assignments through actual juror HTTP operations. Results verify positive/negative scores, a whole unresolved cutoff tie, final closure, three selected overall winners, current-only history, administrator UI unlock/removal and juror replacement/reclosure. Submission history ends at 31 while current expected ballots remain 30. Actual browser XLSX download is reopened with ExcelJS and all three sheets/participation rows verified; test download is deleted.
- Axe WCAG A/AA rule scans pass across login/administration/category/review/confirmation/dashboard/provisional/final results states. Sign targets measure at least 44×44 and tested pages have no horizontal overflow. Generated result screenshots were visually inspected for phone/landscape layouts. Protected direct entry, wrong-origin writes, JSON 404s, simulated browser connection loss/retry and actual generated-session revocation/clearing pass.
- Failed attempts are retained here: the first harness incorrectly attempted an opposite-sign change beyond the configured negative cap, then expected a dashboard heading whose actual content is the event name; both harness assertions were corrected without weakening app rules. A later run had one uncertain desktop final-submit response while other projects passed; its exact cause was not captured. Added response-level status/contract/outcome assertions; **three diagnostic desktop repetitions passed (6 tests)**, then the final full suite passed 6/6. This isolated unclassified response is not claimed fixed or attributed conclusively to parallel builds; retain the diagnostic assertions and investigate if it recurs. No automatic retry was added to the happy path.
- Clean Linux image build/install PASS on Docker's Linux ARM64 VM, including production-only install with zero reported npm vulnerabilities. Runtime verified UID 1000, no `.env`/hosting secret file and no Playwright dependency. Native x86 hardware is not claimed tested.
- Separate validation-only Compose project: fresh PostgreSQL + migration-success app startup/readiness PASS, compiled migration repeat PASS, direct HTML route PASS, hidden interactive compiled password operator PASS without echo, actual container HTTP login/event/roster/team/configuration/activation/link/submission/results PASS. Restart and final-image upgrade preserve four migration records, one event/current submission and three audit records; final image ready after upgrade.
- Actual custom-format `pg_dump` and restore into a separate new validation database PASS. Exact sorted row equality across **15 tables** (14 application + migration history) confirms credentials, current ballot/entries and audit/history were retained. This is local PostgreSQL restore evidence, not a managed Supabase restore claim.

## Historical pre-cloud Phase 13 cleanup and handoff

All generated local test databases are absent (read-only catalog count 0). The exact `d21-phase13-validation` containers/network/volume were removed; the original Compose development PostgreSQL remains healthy. Test fixtures stopped their compiled API processes and removed downloaded workbooks. Temporary generated container credentials, fixture, dump and fingerprint files were removed. Final `.env` and four SQL hashes match the preservation baseline. Local image/build cache remains available; no remote resource was created. Generated desktop/phone/landscape result images are copied outside the repository into the current session visualization directory as `phase13-results-{desktop,phone,landscape-dark}.png`; ignored test outputs remain reproducible. No commit/push. All four implementation documents, README and relevant wiki pages are updated; final documentation formatting/diff hygiene checked separately from the already passing source/browser suites.

## Phase 13 limits and remaining acceptance

The account/project/security/migration progress is recorded above. The live address and private backup/isolated restore are recorded above. Authenticated live flows, provider restart/restore and distinct-client throttling remain pending. No paid resources or upgrades. Shared passwords and reusable links still require private organizer distribution.

Automated axe/keyboard/responsive checks do not constitute a full screen-reader/native-mobile audit. No load/large export/multi-instance test, native Excel/LibreOffice check, Linux x86 run, actual provider outage/managed restore, or authenticated live voting/XLSX browser test. Login throttling remains process-local, XLSX in memory, snapshots/manual refresh and shared-admin attribution unchanged. No deadline/alert work. Phase 13 remains IN_PROGRESS; continue this same phase after the account/publication gates, rather than declaring the whole product production-validated.

## Historical Phase 12 completion

**Phases 0–12: DONE. Phase 13: NOT_STARTED.** The user excludes deadlines/alerts and approves existing admin interventions plus XLSX results/participation/export-time download. Implementation, final source/PostgreSQL/browser validation, self-review, documentation and owned-resource cleanup are complete. No commit or Phase 13. Existing uncommitted work, development data/configuration and immutable migrations are preserved.

## Phase 12 implementation

- Added `auth/admin-transaction.ts`: bind the request cookie; check the current shared-admin session on the transaction connection after the event lock and before completion. Older event/jury/voting/team services now use request-bound service factories; ballot administration, dashboard and results share this authorization helper. Event metadata updates serialize with read snapshots. No role/session-lifetime change or claim-based identity.
- Existing event-first locks, sticky roster/configuration freezes, activation validation, unconditional reopening, independent category submission, expected revisions, exact retries and original submission/unlock history remain intact. No new reset/delete/cancel/archive/publication/tie-resolution behavior.
- Actual activation/closure/reopening and link issuance/revocation append atomic minimal audit records with shared admin identity and statement-time timestamps. State/audit roll back together. Already-active/closed lifecycle retries and no-op revocation append nothing; regeneration intentionally replaces access and records counts. No secrets/choices in these new audit records.
- Known database lock/statement timeout, unavailable connection and capacity errors now return sanitized retryable `503 DEPENDENCY_UNAVAILABLE`; unexpected failures remain generic 500, domain conflicts retain codes. No automatic write retries.
- Added guarded strict `GET /results/export.xlsx?eventId=<UUID>` and event-results **Stáhnout XLSX**. Categories, team results and eligible-juror participation share one event-locked dashboard/results projection and one UTC snapshot timestamp. ZIP generation releases the lock and rechecks authorization before delivery. Export reads change no ballots/history.
- Workbook preserves current submitted-only counts, optional empty submissions, invalid/ineligible flags, shared ranks, cutoff ties, provisional/final reasons and duplicate-name UUIDs. It has numeric score/count cells, literal strings (including spreadsheet operators), no formulas/macros/hyperlinks, filters/frozen headers, wrapped text and row sizing. No individual choices, revisions, audit snapshots or credentials. [Full scope/contract](../wiki/operational-hardening.md).
- `results/ExportResults.tsx` reuses tokens/shadcn Button, with pending/success/focused retry, abort on unmount, keyboard focus restoration and authorization-loss clearing. The writer is server-only. ExcelJS 4.4.0 and compatible UUID 11.1.1 override are pinned; no table/schema/migration change.

## Phase 12 validation actually performed

- Baseline `npm run check` PASS (48 fast tests, four typechecks/lint/format, both builds). Baseline PostgreSQL 216/216 PASS after local-access rerun; initial sandbox run skipped assertions on connection failure. No unrelated services stopped.
- Final post-review `npm run check` PASS: **52 fast tests**, four workspace typechecks, lint/format and both production builds. Four new fast cases verify sanitized retryable connection/lock/timeout errors. Final post-review PostgreSQL **246/246 PASS**, eight files, including **30 new operational cases**.
- New PostgreSQL coverage: actual lifecycle audit/idempotence/invalid transitions/activation; link regeneration/revocation/no-secret audit; audit-storage rollback; export numeric plus/minus/zero/negative scores/shared ranks, independent categories, duplicate identities, participation/metadata/no writes; finality through closure/unlock/replacement without history inflation; empty exports; Unicode/multiline and `= + - @` literal strings; strict claims/auth/no-store/download headers/event separation; excluded legacy past deadline behavior; 17 actual admin event-lock revocation waits across CRUD/read/link/export boundaries, statement-time expiry after lock waits, authorization loss inside writes with full state/audit rollback, and discarding a generated workbook after revocation before delivery.
- An intermediate suite had 19 older wizard assertions fail because its ballot-history helper also counted new access audit records. Scoped that helper to `target_type='ballot'`, retaining original ballot-history assertions; new operations tests separately check access/lifecycle audit records. An early current-result export test incorrectly used a juror snapshot `id` (not exposed by contract); typecheck/400 caught the fixture, corrected to a scoped stored ballot-ID lookup. No contract/security/schema rule was weakened. Subsequent full suites passed.
- Dependency installation initially reported the older transitive UUID advisory. Verified the compatible 11.1.1 override with a **clean npm 11.6.2 `ci`**, `npm ls uuid` and zero reported vulnerabilities. An intermediate install graph briefly omitted UUID and prevented results-test loading; a clean lockfile install resolved it. Final source/DB/build checks ran against the clean installation. Deprecation notices remain distinct from audit advisories.
- Real browser with disposable PostgreSQL/API: protected direct results login, correct final 10/10 score 10, keyboard XLSX download, actual downloaded workbook reopened programmatically (three sheets, correct score/UTC time), pending/success and restored download focus. Stopped the actual owned API: export showed focused error/retry; restart and keyboard retry succeeded. Expired disposable admin sessions: export returned to login and cleared protected rankings/export/event identity. Fresh login and export rechecked after final source review.
- Desktop 1280px, phone 375×812 and landscape 812×375 show no measured horizontal overflow; download target 44px high, phone full width. Recorded visual direction/current tokens used. Final screenshot `phase12-export.png` is outside the repository in the session visualization directory and contains disposable data. No new preview inspection or full screen-reader audit claimed.
- Browser database migration apply/repeat PASS (four immutable migrations). `npm run db:generate` reports **14 tables/no drift**. Final SQL 0000–0003 SHA-256 and `.env` digest match baseline. Development public-table data/credentials digest matches before/after. No development migration/data write performed.
- Cleanup PASS: owned API/web ports 3002/5174 have no listeners, browser viewport reset/tab closed, exact generated browser database dropped normally/absence verified, helper and credential manifest removed, downloaded disposable workbook removed. Earlier work is preserved; no commit.

## Phase 12 review, limits and completion

Self-review covered request-cookie binding and inherited guards, post-lock/end-of-operation authorization, lock order, event metadata snapshot consistency, atomic minimal audit and original ballot history, idempotence, exports/counts/privacy/literal cells, sanitized errors, dependency reproducibility, keyboard/phone recovery and phase scope. Review improved header/text wrapping and long-text row sizing, made new audit timestamps reflect statement time after waits, and unified existing ballot/dashboard/results admin checks. Final source/database checks and final browser export pass after those changes. No known blocking Phase 12 finding remains.

Deadlines and time/threshold alerts are **not applicable by explicit user decision**, not unrun passing checks. Existing factual integrity indicators remain. XLSX is a dated in-memory snapshot for current hackathon scale, not certification/publication. No native Excel/LibreOffice application check, large-export/load/multi-instance test, automated browser suite, full accessibility/screen-reader audit or production deployment was run. Very long descriptions preserve the full cell value but may require expansion in the reader. Shared administration has no individual attribution; privileged SQL can bypass app policy. Per-process login throttling and operational retention/hosting/backups remain Phase 13 work.

**Completion:** Phase 12 DONE within the approved amended scope. Required safety, audit, authorization/integrity, protected XLSX exports, critical error tests, browser validation, review and handoff are complete. Next is **Phase 13 — E2E Validation & Production Readiness**, only in a new explicitly user-started session after hosting/operational decisions. No Phase 13 work or commit. Suggested future commit: `feat: harden administration and export results with participation to XLSX`.

## Historical Phase 11 record

**Historical Phase 11 completion:** Q06 scoring, shared ranks, unresolved cutoff ties and strict finality are approved. Implementation, final post-review source/database/browser validation, self-review, documentation and resource cleanup are complete. No Phase 12/13 or commit. Prior uncommitted work, development data/configuration and immutable migrations are preserved.

## Phase 11 implementation

- Added pure server-used `rankResults`: positive minus negative score, descending competition ranks (1, 2, 2, 4), stable presentation without a tie-break, full-group selection only when it fits and unresolved crossing cutoff groups. Shared contracts describe aggregate rows, selection, lifecycle, participation, problems, provisional reasons and stage.
- Added guarded `GET /results/overview?eventId=...` and `GET /results/votings/:votingId`. Reuse exported locked dashboard eligibility/validity projection, then independently aggregate current eligible submitted entries in the same shared-event transaction. Post-wait admin session/statement-time expiry recheck; event-batched reads; no history read/writes, juror choices/identities or client claims. No dependency/migration.
- Final requires closed/archived + all positive eligible participation + no factual problem + no cutoff tie. Drafts/invalid drafts/cancelled/history never add votes; empty submissions add participation only. Unlock removes current votes, replacement adds only replacement; inconsistent stored submitted data stays counted/flagged as provisional, ineligible data is excluded/flagged. [Detailed contract](../wiki/results-ranking.md).
- Web event **Výsledky hlasování** and category **Výsledky kategorie** entries; refreshable `/admin/events/:eventId/results` and `/admin/results/votings/:votingId`; desktop tables/phone labelled rows, duplicate-name team IDs, shared-rank/tie explanations, provisional selection/final winners, current descriptions, explicit refresh/time, empty/loading/error/retry/session handling. Shared tokens/buttons; server alone computes results.
- Main files: API `modules/results/{service,routes,results.integration.test}.ts`, dashboard snapshot export, auth/app/server registration, contracts, domain `results.ts`/tests, web `modules/results` plus App/admin route/entry/CSS integration, root DB test script.

## Phase 11 validation actually performed

- Baseline source check PASS (41 fast tests/typechecks/lint/format/builds); PostgreSQL baseline 200/200 PASS after local-access rerun. Initial sandbox EPERM ran no assertions. No unrelated services stopped.
- Intermediate source check PASS: four typechecks/lint/format, **48 fast tests**, both builds. Seven new pure ranking cases include an independent exhaustive check of five-team scores -1/0/1 with every valid cutoff (972 scenarios), shared ranks, ties above/below/crossing cutoff, negative/zero scores, immutable inputs and unavailable cutoff.
- First results PostgreSQL run: 14/15 pass; auth fixture used nonexistent `sessions.user_id`. Corrected fixture to `admin_user_id`; 15/15 and full 215/215 passed. Added valid/invalid draft/cancelled-entry exclusion and shared-team cross-category isolation; expanded focused **16/16 PASS**. No application constraint/security rule was weakened. Final full suite **216/216 PASS** across seven files. Final post-review `npm run check` PASS: four workspace typechecks, lint/format, **48 fast tests** and both production builds.
- Two intermediate checks stopped at formatting after concurrent test/document edits; corrected formatting. Initial pure-test typecheck rejected generic `map(Object.freeze)` inference; replaced with a typed row callback. Review corrected undefined final-result color classes to existing `ring` token and made unready selection say it is not evaluated.
- Real browser with actual disposable PostgreSQL/API: protected direct results login/session recovery; independent category plus/minus/scores, zero/negative values, shared ranks, duplicate team names/IDs, unresolved multiwinner cutoff versus final unique winner, invalid-draft exclusion, unconfigured draft, empty-event state, category drill-down/direct reload/current descriptions, keyboard event entry/refresh and focused successful refresh.
- Actual admin unlock changed final 10/10/score 10 to provisional 9/10/score 9; real replacement submit and reclosure restored final 10/10 with score 9, new team vote 1 and old negative total reduced from 10 to 9. History was not added to current scores. Actual stopped API cleared tables and focused retry; restart/keyboard retry restored heading focus/data. Expiring disposable admin sessions then refreshing cleared tables and protected event content.
- Desktop 1280px, phone 375×812 and landscape 812×375 visually/mechanically inspected: no measured horizontal overflow, 44px tested buttons/links, phone counts visibly labelled and table roles retained. Preview inaccessible; recorded direction used. Screenshots outside repository: session visualization directory `phase11-results.jpg` (full desktop) and `phase11-preview.jpg` (compact preview).
- Migrations applied/repeated in generated browser DB (four rows); `npm run db:generate` reports 14 tables/no drift. Cleanup: owned API/web servers stopped, browser tab closed/viewport reset, exact generated DB dropped normally/absence verified, manifest removed; development public-table SHA-256 and `.env` digest unchanged. Final SQL 0000–0003 hashes match the baseline; temporary helper and credential manifest removed.

## Phase 11 review and limitations

Self-review covered aggregate joins/current submitted/eligibility, no history inflation, current team identity, equal-score order versus rank/cutoff, finality reversal, strict outputs/privacy, guarded routes and post-lock authorization, snapshot consistency, source boundaries and responsive error recovery. No known blocking finding remains. Final results are derived and can change after unlock/reopen; manual refresh makes freshness explicit.

No automated browser suite, full screen-reader/accessibility audit, load/multi-instance or deployment validation. Privileged SQL can bypass app policy; inconsistent submissions require organizer review, not an invented repair. Shared administration cannot attribute individual actions. No tie-resolution workflow, certification/publication/export, deadlines, threshold/time alerts, reset/delete or Phase 12/13 work. Q07/Q10 alerts/Q11 remain open/deferred.

## Phase 11 completion report

**Phase:** 11 — Results & Ranking. **Status:** DONE.

**Implemented / architecture / modules:** current eligible submitted-only server totals, pure domain score/shared ranking/multiwinner cutoff, strict aggregate contracts and event/category admin results screens in the modules listed above. No migration/dependency; existing locks/auth/history remain authoritative.

**Acceptance:** approved calculations, independent categories, multiple selected teams, whole cutoff ties unresolved, accurate provisional/final status, boundary/concurrency tests, responsive keyboard/error/session handling, review and handoff all satisfied. Final source check PASS (48 fast tests/typechecks/lint/format/builds), PostgreSQL 216/216 PASS, real-browser scenarios, migration no-drift/hash and cleanup/data-preservation checks complete.

**Review / limitations:** fixes and actual limits above. No known Phase 11 blocker. All four implementation documents, README and relevant wiki/module pages updated. Suggested future commit: `feat: add current-ballot results and shared-rank cutoff detection`. No commit authorized/performed.

**Next:** Phase 12 — Operational Hardening, only in a new user-started session with Q07/Q10/Q11 decisions before affected deadline/alert/intervention/export behavior. Stop after Phase 11; no Phase 12/13 implementation.

## Historical Phase 10 completion

User explicitly authorized Phase 10 on 2026-10-18, including deferral of time/threshold alerts. Dashboard API/UI, final post-review validation, source review, documentation and cleanup are complete. No commit or Phase 11 work. Existing uncommitted changes, immutable migrations and development data/credentials are preserved.

## Phase 10 implementation and validation

- Added guarded `GET /dashboard/overview?eventId=...` and `GET /dashboard/votings/:votingId` with shared strict metadata-only contracts. Batched queries under the existing shared event lock derive allowed-group eligibility, current submitted counts, pending/invalid/locked progress, per-group totals and factual problems. Recheck shared-admin session/statement-time expiry after lock acquisition. No choices/history exposed and no read writes.
- All category cards include setup drafts; operational totals/pending/attention KPI exclude drafts. Zero eligibility never completes. Completion is derived participation, not lifecycle. Unlock removes the current submission immediately; original history cannot inflate counts. Detail returns current eligible identities, states/timestamps and group progress; juror overview searches names/IDs and expands category assignments. [Exact semantics](../wiki/operational-dashboard.md).
- `/admin/events/:eventId/dashboard` is linked from event administration; `/admin/dashboard/votings/:votingId` supports direct entry/refresh and links to existing configuration/unlock. Explicit refresh/snapshot timestamps, loading/empty/errors/retry, focused feedback and native keyboard disclosure. Desktop/phone layouts use current tokens. No new dependency/migration or Phase 11 results.
- Baseline `npm run check` PASS (41 fast tests/typechecks/lint/format/builds) and PostgreSQL 186/186 PASS after local-access rerun. Initial sandbox attempt failed EPERM with no assertions. Compose PostgreSQL healthy; original web/API ports had no listeners.
- Initial expanded PostgreSQL run: 190/200 passed; ten new dashboard reads failed because the aggregate referenced nonexistent `ballot_entries.id` instead of the composite entry key. Corrected the filter to `voting_item_id`; focused dashboard 14/14 and full 200/200 subsequently passed. Existing 186 tests continued passing. No schema/constraint/security rule was weakened.
- Fourteen new database cases cover T/V/both eligibility and duplicate names, absence/empty/invalid/cancelled state, current-only submit/replay/unlock/replacement/history counts, closure/completion, empty/draft-only/zero eligibility, foreign events/ineligible records, malformed/extra claims, all actor/session guards, metadata privacy/no-store/read-only behavior, incomplete rules/unlinked items/current descriptive corrections and actual event-lock waits with committed state changes/revocation/expiry.
- Intermediate complete source check PASS (four typechecks/lint/format, 41 fast tests, API/web builds). Review then corrected draft cards with setup problems and refresh/retry keyboard focus; final post-review verification passes: `npm run check` (four typechecks/lint/format, 41 fast tests and both builds), `npm run test:db` (200/200 tests).
- Real-backend browser against a generated isolated database: protected direct dashboard/login, accurate 6/30 and 1/4 initial KPI, current empty/valid/invalid/submitted/locked states, group eligibility, named search/no-match/all filter, keyboard juror expansion, category drill-down and direct refresh, event-management entry, empty event 0/0, actual administrator unlock (5/5 → 4/5 and completion removed), separate shared-category submit, keyboard refresh, real stopped-API failure clearing data/focusing retry and successful restart/retry, expired-session refresh clearing protected identity/counts.
- Desktop 1280px, phone 375×812 and landscape 812×375 visually/mechanically checked without measured horizontal overflow. Phone refresh/logout/search/select measured 44px; juror summaries measured 64px. Preview inaccessible; recorded direction/current tokens used. Screenshot outside repository: session visualization directory `phase10-dashboard.png` (disposable fixture data).
- Migration apply/repeat in the generated browser database leaves four migrations. `npm run db:generate` reports 14 tables/no drift; SHA-256 matches baseline SQL 0000–0003. No development migration/write. Cleanup verified: owned API/web on 3002/5174 stopped; browser tab closed and viewport reset; this session’s exact generated browser database dropped normally with absence verified; temporary validation/credential files removed. SHA-256 over all development public-table records before/after confirms credentials/data unchanged.

## Phase 10 review and limits

Self-review covered guard scope, event identity, strict claims, current eligible/submitted aggregation, independent validity/availability, no history inflation or vote-choice exposure, shared-event consistency, post-wait auth, zero/draft behavior and responsive recovery. Corrected incomplete drafts misleadingly labelled prepared; corrected disabled-refresh focus loss and added error-recovery heading focus. No threshold/deadline/winner/tie policy inferred. Reverified successful refresh button focus and post-outage recovery heading focus in the real browser. No known Phase 10 blocker remains.

No automated browser suite, full screen-reader/accessibility audit, load/multi-instance or deployment test. Dashboard refresh is manual; it displays a timestamp and cannot claim live synchronization. Entry validity is computed internally; no results/ranking/history browser/export. Shared admin remains without personal attribution, and privileged SQL can bypass app policy. Q10 time/threshold alerts are deferred; Q06/Q07/Q11 remain future gates.

## Phase 10 completion report

**Phase:** 10 — Operational Dashboard. **Status:** DONE.

**Implemented / architecture / files:** metadata-only event/category snapshots in API `modules/dashboard/{service,routes,dashboard.integration.test}.ts`, shared contracts, auth/server registration, web `modules/dashboard` and admin entry/routing. Existing event lock, auth and pure D21 validation are reused; no migration/dependency.

**Acceptance / evidence:** actual eligible/current submitted aggregation, group isolation, pending/problem states, real-data category/juror screens, 200 PostgreSQL tests, 41 fast tests, complete source checks/builds, real-browser responsive/keyboard/error/expiry validation and source self-review pass. Migration repeat/no drift/unchanged hashes and cleanup verified; development public-table digest unchanged. Limitations above remain explicit.

**Handoff:** all four implementation documents and relevant wiki/README updated. Suggested future commit: `feat: add actual-data operational dashboard`. No commit authorized/performed. Stop after Phase 10. Phase 11 — Results & Ranking requires a new user-started session and Q06 decisions before affected tie/provisional-winner behavior; Q07/Q10 thresholds/Q11 remain deferred/open.

## Historical Phase 9 final state

Phases 0–9 are DONE. The records below describe the completed earlier phases; their then-next-phase statements are historical.

## Phase 9 implemented behavior and architecture

- Added protected `GET /wizard/review` with ordered current authorized categories, owner snapshots, actual positive/negative choices, current shared-team labels, validity/availability and submission timestamps. Shared event lock, post-wait session recheck, batched reads and no ballot/history creation.
- Added strict `POST /wizard/final-submit` for explicitly selected saved revisions/entries. Nonempty/unique categories, integer base revisions, strict fields and no identity/rule/state claims. Each category independently reauthorizes/revalidates in its own exclusive event-first transaction and uses Phase 8 submission/history/replay. Missing or changed saved choices conflict rather than creating/replacing a draft. Normal 400/404/409 category failures return separate outcomes and do not undo/stop other categories. Global auth/infrastructure failure stops later work; earlier commits survive and exact retries reconcile safely.
- Review UI shows saved signs/team positions, invalid/closed/empty/submitted/unstarted states and return-to-edit links. No automatic selection. Confirmation names selected categories and counts. `/wizard/confirmation` shows operation outcomes immediately; refresh/direct entry derives current submitted/remaining states without inventing durable event completion. Already-submitted/unselected/unavailable categories remain intact; later return and admin-unlocked drafts require fresh selection/confirmation.
- Revalidation preserves reviewed versions until explicit loading clears selection/confirmation; revoked category content disappears immediately. Session loss clears protected content. Actual connection failures retain the exact confirmed request for safe retry. Native semantic controls, focused confirmations/results/errors, cancel opener restoration, 44px selection/confirmation targets and responsive layouts.
- Main files: API wizard service/routes/integration tests and shared contracts; web `WizardReviewScreen`, `ReviewCategoryCard`, `useReviewSubmission`, shared `ballotMessages`, portal/content/routing integration. Existing submission/history/domain/schema unchanged. No migration or dependency.

## Phase 9 validation actually performed

- Baseline `npm run check` PASS (41 fast tests, four typechecks, lint/format, both builds); PostgreSQL 167/167 PASS after local-access rerun. Initial sandbox database attempt failed EPERM and ran no assertions.
- Final `npm run check` PASS after presentation cleanup and documentation: four typechecks, lint, formatting, **41 fast tests**, API/web builds. Final documentation status formatting/diff hygiene checked separately.
- Final PostgreSQL **186/186 PASS** across five integration files. Nineteen new tests cover T/V owner isolation and read-only review, current labels/validity/closed/submitted/absent states, selected-only and explicit empty submission/later return, malformed/duplicate/unknown claims and origin/no-store guards, forged saved choices/absence, stale/invalid/unavailable/concealed per-category outcomes, concurrent identical finals and draft-save races, admin unlock/old replay/replacement, closed no-write replay, injected history failure after an earlier commit and exact recovery, authorization loss between commits, and actual event-lock waits followed by closure/revocation/expiry/permission/configuration/revision changes. Review also rechecks expiry after a shared-lock wait.
- Real-backend browser PASS: T/V authorized review, accurate saved signs and invalid/closed/empty/absent/submitted states; return-to-edit/correct/save/review; keyboard selection/confirm/cancel with focus restoration; partial result when one selected category closes while another submits; durable current confirmation after reload; actual second-tab save rejects stale review; explicit load of newer saved choices clears selection; actual stopped-API error retains confirmation and succeeds on exact retry after restart; administrator unlock/resubmit and same-page unlock refresh; withdrawn category permission clears its choices before explicit loading; expired-session final action clears identity and controls. Pending/error/success states and focused feedback observed.
- Desktop 1280px, portrait 375×812 and landscape 812×375 visually/mechanically checked with no measured horizontal overflow. Selection labels measured 44px or taller; phone confirmation actions 44px high. Recorded visual direction/current tokens used because original preview remains inaccessible. Screenshots outside repository in this session visualization directory: `phase9-review.jpg` and `phase9-confirmation.jpg`.
- Disposable migration apply/repeat PASS (four migrations); `npm run db:generate` reports 14 tables/no drift; SHA-256 confirms SQL 0000–0003 unchanged. Development configuration/credentials/data were not written.
- Cleanup PASS: owned API/web services stopped; verification tabs closed/viewport reset; exact generated browser database `d21_test_2cadafe79aa04a1482e3c3a8df14b76f` dropped normally with absence verified; temporary fixture/server/control/credential state removed. Final test state: three drafts (revisions 3/5/1), two current submissions (3/2), four submission snapshots/two unlock snapshots and four migrations.

## Phase 9 review findings and limitations

- Self-review covered current authorization/ownership, strict claims, event-first locking, independently committed categories, saved-version equality, replay/revision/history/rollback and scope. Corrected result-view refresh affordance so historical outcomes are not presented as current verification; confirmation reload derives current state. Removed withdrawn-category names/choices promptly. Explicit current-load and cancel actions restore useful focus. Split category presentation from workflow state/confirmation.
- Intermediate formatting caught a missing parenthesis; typecheck caught test helper field naming. Both corrected. One PostgreSQL run passed 185/186: the replay test incorrectly expected the old availability report after closure. The replay properly derived `VOTING_UNAVAILABLE` without changing stored state/history; corrected the assertion and 186/186 passed. No domain rule or test guard was weakened.
- No automated browser suite, full screen-reader/a11y audit, load/multi-instance or deployment validation. Native unload/logout cancellation remains an inherited unverified limitation. Pending confirmed requests and per-attempt result reports are memory-only; reload reconciles current ballots. No push synchronization, autosave, durable event-wide completion or history browser/export. Privileged SQL can bypass application policy; shared administration remains without individual attribution.
- No known Phase 9 blocker. Q10 attention thresholds require a decision before affected Phase 10 alerts; Q06/Q07/Q11 remain later gates.

## Phase 9 completion report

**Phase:** 9 — Multi-Category Wizard & Review. **Status:** DONE.

**Implemented / Architecture / Files:** authorized saved-data review, safe return to edit, selected independent final submission and current confirmation/recovery in the modules above.

**Acceptance:** T/V isolation, correct review, independent transactional writes, confirmation/later return, meaningful PostgreSQL/browser validation and source review are verified. Final complete source verification passed; all Phase 9 criteria are satisfied.

**Handoff:** all four implementation documents and relevant wiki/README updated. Suggested future commit: `feat: add juror review and independent final submission`. No commit authorized or performed.

**Next:** Phase 10 — Operational Dashboard, only after Phase 9 DONE and a new user-started session. Stop here; no dashboard/results/deadlines/alert policy implemented.

## Historical Phase 8 state

**Phases 0–8: DONE. Phase 9: NOT_STARTED.** Independent category submission and administrator-only unlocking meet Phase 8 acceptance. Prior uncommitted work, development configuration/credentials/data and migrations are preserved. No commit or Phase 9 implementation.

## Phase 8 implemented behavior and architecture

- `POST /wizard/steps/:stepId/submit` strictly accepts `{expectedRevision:null|integer,entries}` and rechecks current session/statement-time expiry, event/group permissions, category status/items/rules in an exclusive event-first transaction. Valid choices (including empty under optional usage) replace the draft, increment revision once, set submitted status/timestamp and append a submission snapshot atomically. Invalid/stale/unauthorized operations cannot partially save or replace history. No prior validation or save grants authority.
- Matching retries return the current submitted snapshot without changing entries, revision, timestamps or audit. Requires matching entries independent of order and submitted revision equal to `(expectedRevision ?? 0)+1`. Closed-category replay confirms existing submission without accepting new votes; all fresh writes still require active/ready voting. Other submitted/cancelled edits reject. Categories remain independent for later return.
- Admin-only `GET /votings/:votingId/ballots` lists identity/status/revision/submittedAt without vote choices. Strict `POST /votings/:votingId/ballots/:ballotId/unlock` accepts `{expectedRevision}`. After the event lock it rechecks the administration session, locks the scoped ballot and records history before returning retained choices to draft with revision increment/submittedAt cleared. Matching replay is harmless only while that exact resulting draft remains current. Cancelled/draft states cannot be newly unlocked. Old unlocks cannot affect a resubmission.
- Existing `audit_logs` preserves submission and unlock snapshots with correct juror/shared-admin actors; transaction failure rolls state/entries/history back together. Legacy submitted choices are captured on unlock even without previous audit. Shared administrator identity has no individual-person attribution. Original SQL migrations, 14 tables and dependencies are unchanged. No exposed history mutation/reset/delete or separate admin lock workflow.
- Juror explicit confirmation/locked timestamp, restored read-only choices, real submitted overview progress, other-category navigation, failure/retry and stale-tab comparison. Administrator category detail has explicit unlock confirmation/cancel and safe refresh/conflict feedback. Same-page ballot refresh detects an administrator unlock and allows explicit comparison/loading before editing. Closed/unready categories remain unavailable after unlock until separately reopened.
- Main modules: API `ballots/{service,admin,routes}.ts`, wizard service/routes/integration tests, auth/server registration and contracts; web `BallotSubmission.tsx`, draft hook/persistence/category integration, admin `BallotUnlock.tsx` and voting detail. Pure D21 engine and existing draft-save revision policy remain intact.

## Phase 8 validation actually performed

- Baseline `npm run check` PASS (41 fast tests/four typechecks/lint/format/builds). Baseline PostgreSQL 140/140 PASS after local-access rerun; initial sandbox attempt failed with EPERM and ran no assertions.
- Final source `npm run check` PASS: four typechecks, lint, formatting, **41 fast tests**, both production builds. One intermediate run stopped at formatting in three updated documents; corrected and rerun. No source test/type/lint failure was concealed.
- Final PostgreSQL **167/167 PASS** in five integration files using generated disposable databases. New scenarios cover new/existing/empty submissions, restored confirmation/current progress, reorder-safe retries with unchanged timestamps/history, invalid/caps/negative disable/unknown/duplicate/stale claims, all session/origin/query/identity guards, independent categories, simultaneous matching/different submit and save races, administrator-only scoped unlock and simultaneous retry, original-history retention/replacement, rejected old requests, closed/archived confirmation/unlock/reopen, legacy revision zero, cancelled/exhausted records, failed audit storage and failed submission-state update rollback, actual event-lock waits followed by closure/archive/juror expiry/revocation/group change/unreadiness and admin expiry/revocation.
- Real-backend browser PASS against a generated database: invalid selection blocks submit; keyboard confirmation/cancel and focus restoration; valid submit and locked controls after refresh; actual submitted overview plus unfinished categories; administrator confirmation/cancel/unlock; retained selections and replacement submission; actual two-tab conflicting selections with local choices/comparison; actual API outage retaining choices and successful retry; stale closure blocking submit and reopening refresh restoring it without lost edits; same-page admin-unlock refresh/comparison; expired-session submit clears protected identity/controls. Pending and focused success/error states observed.
- Desktop at 1280px, phone 375×812 and landscape 812×375 visually/mechanically checked: no measured horizontal overflow at checked widths; measured sign targets 44×44px and submission-confirm button 44px high. Temporary viewport override reset. Original preview unavailable again; recorded design direction/current tokens used. Screenshot saved outside repository at the session visualization directory (`phase8-submitted.png`).
- Disposable migration application and repeat PASS (four migrations). `npm run db:generate` reports 14 tables/no drift/new migration. SHA-256 matches initial SQL 0000–0003 hashes. No development migration/data/credential write was performed.
- Cleanup PASS: owned API/web processes on 3002/5174 stopped, exact generated `d21_test_417e6789538342b2a65ef39c47980971` database dropped normally with absence verified; browser tabs closed/viewport reset. Temporary fixture/script removed. Browser fixture ended with one administrator-unlocked draft revision 6, one submitted ballot revision 1, seven preserved history records and four migrations.

## Phase 8 review findings and limits

- Reviewed server-derived ownership/group authorization, inherited origin/header/no-store guards, transaction/session rechecks, event-first lock order, revisions/uniqueness, immutable history through exposed APIs, rollback, UI recovery and phase boundaries. No blocking finding remains.
- Browser review found stale submission confirmation disabled comparison actions. Submit now exits its confirmation on a revision/state conflict, preserving choices and enabling immediate comparison. Reverified against two real tabs. Separated category availability from submitted read-only state so ballot refresh does not incorrectly request reopening; confirmed same-page unlock recovery. Success/error feedback receives focus and submitted heading reflects actual state.
- No automated browser suite, full screen-reader/accessibility audit, load/multi-instance or deployment test. Native unload/logout cancellation remains an inherited unverified limitation. No push synchronization/revocation/closure, autosave or history browser/export. Direct privileged SQL can bypass application policy; no database-role hardening is claimed. Only existing shared administration access can unlock; it cannot attribute an action to a person.
- Phase 9 review/final action remains undefined beyond approved independent categories. Results/ties Q06, deadlines Q07, alerts Q10 and operations Q11 remain later work. No independent admin lock/cancellation/reset/deletion is inferred.

## Phase 8 completion report

**Phase:** 8 — Submission & Locking. **Status:** DONE.

**Implemented / Architecture / Files:** Independent category submit with atomic validation/storage/history, safe retries/revisions, locked confirmation, admin-only unlock and preserved original choices/history, in the modules above.

**Acceptance:** valid submit succeeds; invalid/stale/duplicate/unauthorized requests cannot corrupt data; submitted records are protected except for the explicitly approved administrator process; remaining categories stay available; meaningful real PostgreSQL/concurrency/browser checks pass. Source review and handoff complete.

**Validation / Review / Known issues:** actual evidence and limitations above. All four implementation documents and relevant wiki/README updated. Suggested future commit: `feat: submit category ballots with administrator unlock history`. No commit authorized or made.

**Next:** Phase 9 — Multi-Category Wizard & Review, only in a new user-started session. Stop here. Define review/final-action semantics before affected implementation; already-submitted categories must remain intact and categories independent.

## Historical Phase 7 state

**Phases 0–7: DONE. Phase 8: NOT_STARTED.** Per-category draft persistence meets Phase 7 acceptance. Submission is approved independently per category but remains Phase 8. Prior uncommitted changes, development credentials/configuration/data and migrations are preserved. No commit or Phase 8 work.

## Phase 7 implemented behavior and architecture

- Strict owner-derived draft GET/PUT at `/wizard/steps/:stepId/ballot-draft`. Expected revision null asserts no ballot; integer revisions match existing ballots. First save revision 1, then increment. Full entry replacement and response snapshot are atomic. Existing tables/revision columns suffice; no migration or external dependency.
- Current session/statement-time expiry, event/current-group permissions, items, configuration and category status are rechecked under an exclusive event-first write transaction. Shared event locks protect reads. Stale writes return DRAFT_CONFLICT without changes. Structurally invalid/unknown/foreign/duplicate entries are rejected; D21-invalid selections persist only as drafts. Unready/closed/archived categories reject writes. Submitted/cancelled records remain read-only.
- Database-backed restoration across navigation/refresh/logout/re-entry and devices. Overview shows real saved not_started/in_progress/invalid_draft; existing submitted/cancelled rows project submitted/locked. Empty saved selection is an in-progress draft under optional vote usage. Availability is separate from draft rule validity. No save is submission.
- Explicit save/pending/success/failure/retry; conflicts retain local choices and compare with the latest saved version. Choosing local choices uses the explicitly compared revision; any newer save conflicts again. A lost-response retry cannot duplicate/overwrite a ballot. Successful visibility revalidation never replaces choices or advances the base revision silently. Recoverable refresh failure keeps the editor mounted.
- Closed-category rejection retains saved and local choices. Availability refresh after administrator reopening preserves edits; native reload is unnecessary. Session/authorization failure clears protected content. Unsaved changes stay only in component memory; native unload/logout confirmation warns before leaving.
- API `ballots/service.ts` owns batched snapshots/transactional draft replacement; `wizard/service.ts` reuses existing context and lock boundary; routes/contracts expose minimal inputs. Web `useBallotDraft.ts`, `DraftPersistence.tsx`, `CategoryVoting.tsx`, `WizardContent.tsx`, `JurorPortal.tsx` own persistence and UI behavior. Original pure D21 engine remains authoritative/shared.

## Phase 7 validation actually performed

- Baseline npm run check PASS (41 fast tests/typechecks/lint/format/builds); baseline PostgreSQL 122/122 PASS. Initial sandboxed database run could not connect; authorized local-access rerun passed. Compose PostgreSQL healthy; no initial project API/web listeners.
- Final npm run check PASS: four typechecks, lint/format, **41 fast tests**, both builds. Final npm run test:db PASS: **140 tests** across five integration files, all using generated disposable databases.
- New PostgreSQL coverage: save/read/logout recovery, owner/category isolation despite duplicate names, empty/invalid drafts and correction, entry replacement/sign changes, strict claims/revision/origin rejection, unknown/foreign/other-category/duplicate entries without mutation, caps/disabled negatives as invalid drafts, current group permissions, closed/archived reads and rejected writes/reopen, submitted/cancelled history preservation, stale/future revisions/ambiguous retries, simultaneous first/update saves across sessions (one success/one conflict), injected mid-entry storage failure with full rollback, actual event-lock waits followed by closure, revocation, expiry, membership change or unreadiness (no ballot written).
- Real-backend browser PASS: keyboard save, refresh/navigation/logout/link restoration, valid/invalid/empty saved states and overview progress, two-tab conflict/retained choices/comparison and both recovery choices, actual API outage with retained correction and successful retry, stale closure rejecting a save while retaining local edits, reopening availability refresh restoring controls without losing local choices, expired-session save clearing identity/controls. Pending and focused announced success/error feedback observed.
- Checked desktop at 1280px width, phone 375×812 and landscape 812×375 during verification: no observed horizontal overflow; all measured category sign controls 44×44px. Phone conflict comparison visually inspected. Screenshots saved outside the repository; final saved-draft screenshot in the session visualization directory.
- Disposable migration application/repeat PASS (four migrations). npm run db:generate PASS (14 tables, no drift/new migration). SHA-256 confirms SQL 0000–0003 unchanged. Browser fixture finished with two draft ballots, submitted_at null, and four migrations.
- Cleanup verified: owned API/web services stopped, ports 3002/5174 have no listeners, verification tabs closed and viewport reset, exact generated database d21_test_89f23a7308914491847516e89dbaa4bc dropped normally with absence verified. Temporary fixture/credential files removed. No development data or credentials were written.

## Phase 7 review findings and limits

- Reviewed server-derived identity/group boundaries, no-store/origin/header guards, event-first lock order, revision/uniqueness, rollback, immutable submitted/cancelled history, unchanged schema/migrations and phase scope. No blocking finding remains.
- Fixed transient visibility-refresh failures unmounting the editor, retry unmounting retained state, stale validation/availability reports preventing reopened-category recovery, stale save-success text after editing and feedback losing focus after disabled/replaced controls. Comparison buttons use flexible height and meaningful text.
- An intermediate typecheck caught an unused concurrency fixture session after cleanup; removed it and reran checks. Do not infer passes from intermediate failures.
- Original Lovable preview was unavailable; used recorded direction/current tokens. No automated browser suite, full accessibility/screen-reader audit, load/multi-instance or deployment check. Browser-driver handling of native unload/logout confirmations was unreliable; cancellation was not verified and is not claimed passing. Native unload warnings also depend on browser behavior, so explicit saving remains required.
- Unsaved edits are intentionally not durable and clear on authorization loss. No automatic merge, push synchronization/revocation/closure or background autosave. Every request is authoritative. Submission/unlocking, review, results/ties, deadlines, alerts and operational policy remain in their assigned phases.

## Phase 7 completion report

**Phase:** 7 — Ballot Drafts & Persistence. **Status:** DONE.

**Implemented / Architecture / Files:** Per-category persisted drafts, atomic owner-scoped replacement/revisions, shared D21 draft validation, actual saved progress, restoration and explicit conflict/error recovery in the modules listed above.

**Acceptance:** safely saved/restored drafts, correct juror/category boundaries, invalid drafts never submitted, useful saving/error feedback and meaningful persistence tests all satisfied. Source review, final checks, documentation and cleanup complete.

**Validation / Review / Known issues:** actual results and limitations above. Four implementation documents and relevant wiki/README pages updated.

**Next:** Phase 8 — Submission & Locking, only in a new user-started session. Implement independent category submission so remaining categories can be finished later; resolve Q08 unlocking/locking/retry details before affected behavior. No Phase 8 work or commit. Suggested future commit: feat: persist juror category drafts with revision conflict recovery.

## Historical Phase 6 final state

**Phases 0–6: DONE. Phase 7: NOT_STARTED.** Engine, controls and authoritative read-only validation satisfy Phase 6 acceptance; final checks, review, documentation and service cleanup are complete. No Phase 7 work or commit. Development configuration/password/data and all prior changes are preserved.

## Phase 6 implemented behavior

- Pure immutable D21 transitions: same-sign toggle/removal, opposite-sign replacement, single vote per item, explicit stored maxima, negative disable, one negative per two actual positives and optional vote usage. User-approved edits reducing eligibility remain visible as invalid until corrected; no automatic deletion. Additional votes beyond a stored cap are blocked with feedback.
- Shared strict request/response schemas; `POST /wizard/steps/:stepId/validate` uses the existing event/session/group boundary and current item/configuration data under the shared event lock. A 200 validation report may have `valid:false`; no ballot is accepted or written. Malformed/unknown claims and unauthorized requests are rejected independently of the UI.
- Responsive category table/mobile grid, sticky used/max/remaining counters, actual negative entitlement, 44px sign buttons with pressed semantics/checkmarks, explanatory invalid/closed/unready states and focused server-check/error feedback. Connection failure retains the selection for retry. Expired-session responses clear protected content.
- Selection exists only on the current page. Navigation/refresh resets it; UI makes this explicit. Visibility revalidation retains same-category state after successful authorization. No draft, save, submit, review, dashboard/results, deadlines, tie rules or destructive policy.
- Main modules: `packages/voting-domain/src/{index,index.test}.ts`, shared contracts, API `wizard/{service,routes,wizard.integration.test}.ts`, web `voting-wizard/CategoryVoting.tsx` and portal/content integration, focused responsive CSS. Workspace manifests/lockfile add only internal package dependencies.

## Phase 6 validation actually performed

- Baseline `npm run check` PASS and PostgreSQL baseline 109/109 PASS. Initial sandboxed database attempt could not connect; the authorized local-access rerun passed.
- Final `npm run check` PASS: four typechecks, lint/formatting, **41 fast tests** and both builds after the last source/test edits. Final `npm run test:db` PASS: **122 tests**, including 13 new validation tests.
- Fast coverage includes exhaustive independent validation of all 2,187 vote assignments across seven candidates, toggle/replacement/removal/immutability, caps, disabled negatives, optional usage and invalid eligibility recovery. The five-positive/two-negative example under a larger explicit cap passes too.
- PostgreSQL covers actual-cast eligibility, caps, duplicate same/opposite signs, invalid/foreign/same-event other-category items, strict input/query claims, all session/origin guards, current membership, unavailable/incomplete categories and no ballot/configuration/progress writes. Real event-lock waits recheck closure, revocation and expiry after release.
- Real-backend browser PASS: valid/invalid server reports, plus/minus caps, both replacement directions, same-sign removal, keyboard Enter/Space, disabled negatives, stale-page closure disabling controls, actual API outage with retained selection and successful retry, expired-session clearing identity/controls, navigation/refresh resetting temporary selection. Pending states and focused feedback observed.
- Desktop 1280×900, phone 375×812 and landscape 812×375 show no measured horizontal overflow; all 14 category sign controls measure 44×44px. Full-page desktop/mobile screenshots saved outside the repository and visually inspected. Sticky counters remain compact (landscape height 102px) with focus scroll clearance.
- Migration application and repeat succeeded in the disposable browser database. `npm run db:generate` reported no schema drift; SHA-256 comparisons confirm all four SQL migrations unchanged. Final verification confirms four migrations and zero browser-fixture ballots/entries. Owned services were stopped, ports 3002/5174 have no listeners, browser tab closed/viewport reset, exact generated database dropped normally with absence verified and temporary credential/script files removed.

## Phase 6 review findings and limitations

- Fixed inherited dark-mode outline styles overriding selected backgrounds; selected plus/minus colors now remain legible and include a non-color checkmark. Fixed mobile caption width after changing the table to a grid.
- Reused the existing transaction/session/group authorization flow rather than introducing a second identity lookup or independent validation transaction. No schema change or history/roster mutation.
- Initial expanded PostgreSQL run passed 121/122: the duplicate/opposite-sign test expected only one error, although the engine correctly also reported insufficient positive eligibility. Corrected the assertion to allow all applicable errors; 122/122 then passed. A formatting check also caught the newly written test file before formatting; corrected and rerun.
- The original Lovable preview remained unavailable through the web tool; used the recorded visual direction and established application styles.
- No automated browser suite, full screen-reader/a11y audit, production/deployment, multi-instance or load check. Static pages have no push revocation/closure updates; every validation request remains authoritative. Local selections intentionally do not survive leaving/reloading the page. Persistence/submission require Phase 7 onward and unresolved Q04/Q08 decisions.

## Phase 6 completion report

**Phase:** 6 — Voting Interaction & D21 Engine. **Status:** DONE.

**Implemented / Architecture / Files:** Pure shared transitions/validation, temporary category UI and strict server validation API using the existing authorization/lock boundary, as above. No new external dependency or migration.

**Acceptance:** plus/minus addition/replacement/removal, confirmed D21 caps/actual-cast ratio/optional usage, clear invalid states, independent server rule/ownership enforcement, meaningful unit/edge-case tests and desktop/mobile interaction all implemented and verified. Final source/authorization/integrity/scope review found no remaining blocker; `git diff --check` passes.

**Validation / Review / Known issues:** final command/browser/migration results and fixes/limitations above. No persistence/submission was introduced. Temporary verification resources cleaned up; development credentials/data preserved.

**Next:** Phase 7 — Ballot Drafts & Persistence, only in a new user-started session. Resolve Q04 before affected persistence/submission contracts. No Phase 7 work or commit. Suggested future commit: `feat: add D21 voting interactions and authoritative validation`.

**Handoff:** plan, progress, decisions and next-session documents and relevant wiki/README pages updated. Stop after Phase 6.

## Previous phases — historical records

### Phase 5 final state

**Phases 0–5: DONE. Phase 6: NOT_STARTED.** Phase 5 acceptance is satisfied; final checks, database/browser verification, review, documentation and cleanup completed. Git remains on `main` at `0dafa82`; all prior Phase 3/4 changes are preserved. No commit or Phase 6 work.

React/TypeScript/Vite/Tailwind/shadcn, Fastify, PostgreSQL/Drizzle and shared Zod contracts. Four applied migrations and 14 tables remain unchanged; Phase 5 requires no schema change. Existing `.env`, development shared password and data were not changed.

## Phase 5 implemented behavior

- Approved admin generation and manual private delivery of event/juror links. Accessible roster controls include juror IDs for duplicate names. The secret URL is displayed once for copying and discarded on closing/navigation/refresh. Admins can confirm regeneration/revocation, including while the roster is locked.
- Links are reusable with **no expiry** by the user’s amendment. Redemption creates a 12-hour absolute PostgreSQL session, rotates the browser’s prior session and supports multiple devices. Logout revokes the current session; using the original link recovers access. Regeneration/revocation invalidates every prior link and session of the event juror. No account or identity matching by name.
- Secrets use random 256-bit tokens and hash-only database storage. Fragment links are stripped from the address bar, including same-document navigation; only transient component state retains an unredeemed link for retry. No authentication secret is stored in browser storage. Public redemption inherits same-origin protection and a per-IP/process rate limit.
- Protected `/wizard/current`, `/wizard/steps` and `/wizard/steps/:stepId` derive event, identity and current group from the session/database, then join same-event `VotingAllowedGroup`. Browser ownership/group claims are rejected. Forbidden, draft, foreign-event and nonexistent step details share a 404 response.
- Only authorized non-draft categories appear. Closed/archived ones remain navigable but unavailable. Steps use voting UUIDs, ordered selection before final, creation time then UUID. Entries use configured display order then UUID; shared team descriptive corrections remain visible.
- Root link entry; `/wizard` welcome; refreshable/direct UUID step pages; browser history, previous/next/overview links; navigation-position progress. Read-only teams/instructions/configured maxima; no vote controls, fabricated vote counts, ballot writes, review or submission.
- Loading, empty, unavailable, malformed/revoked link, expired/revoked session, error and retry states. Responsive layouts, labeled native controls, semantic progress/table, keyboard confirmation/cancel, focused headings/errors and opener restoration.
- Event-first link writes and shared-event wizard reads preserve the sticky roster lock and existing composite/RESTRICT protections. Recheck session after lock waits using statement-time expiry and the transaction’s existing connection.

Key modules: API `auth/juror-access.ts`, `wizard/{service,routes,wizard.integration.test}.ts`, auth scope/session integration; shared contracts; web `voting-wizard/{JurorPortal,WizardContent}.tsx`, admin `JurorAccess.tsx`/roster integration, shared typed API transport and routing. Details: [juror entry and wizard](../wiki/juror-wizard.md).

## Phase 5 validation actually performed

| Check                                        | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline `npm run check` / `npm run test:db` | PASS before implementation: 13 fast / 87 PostgreSQL tests.                                                                                                                                                                                                                                                                                                                                                                                            |
| Final `npm run check`                        | PASS: four typechecks, lint, formatting, 13 fast tests, both builds. Final rerun after the last UI/document changes passed.                                                                                                                                                                                                                                                                                                                           |
| `npm run test:db`                            | PASS: **109 tests** — 14 foundation, 12 auth, 16 event/jury, 45 voting/configuration/lifecycle, 22 wizard/access. Disposable databases only.                                                                                                                                                                                                                                                                                                          |
| Access/session security                      | PASS: hash-only issuance/status, protected cookies, 12-hour lifetime, old reusable links, multiple devices, logout/recovery, rotation, regeneration/revocation, expired/revoked/fabricated sessions, invalid/wrong-event secrets, strict ownership/origin rejection and throttling.                                                                                                                                                                   |
| Authorization/integrity                      | PASS: T/V/both visibility, duplicate names, foreign/missing/draft detail rejection, unavailable categories, deterministic ordering/ties, fresh membership/name/team corrections, empty authorized list, no ballot writes and no review/submission endpoints.                                                                                                                                                                                          |
| Concurrency                                  | PASS: redemption visibly waits for event lock then rejects revoked credential; concurrent issuances leave one valid link; session expiring during an event-lock wait is rejected after acquiring it. Sticky roster marker and voting records preserved.                                                                                                                                                                                               |
| Migrations                                   | PASS: apply/repeat in disposable browser database leaves four migrations. `npm run db:generate` reports 14 tables/no schema drift. Final SHA-256 comparison confirms migrations 0000–0003 unchanged. No development migration/write performed.                                                                                                                                                                                                        |
| Real-backend browser                         | PASS: organizer generation/copy/close/reopen without secret retrieval, confirmed revocation/reissue, entry via generated link, same-page hash entry, T/V with duplicate names, denied private/foreign steps, welcome/empty/unavailable states, navigation/history/refresh, logout, expired/revoked session and reusable-link recovery, revoked-link rejection, automatic on-screen expiry clearing protected identity and focusing recovery feedback. |
| Browser errors/keyboard/responsive           | PASS: actual API outage produces focused error; retry succeeds with retained transient link after restart. Loading/pending states observed. Keyboard entry/step navigation/confirmation/cancel and opener focus checked. Desktop 1280×900, portrait 375×812 and landscape 812×375 show no measured horizontal overflow; tested controls ≥44px. Screenshots visually inspected outside repository.                                                     |

Initial expanded PostgreSQL run passed 98/107: repeated fixture requests hit the real public redemption limiter. Fixtures now use distinct simulated client IPs; a separate test retains one IP to verify the 20/minute limit. Subsequent 107/107 and expanded 109/109 runs pass. Typecheck also caught fixture tuple/index typing and heading-level typing, corrected without weakening validation. No application security rule was relaxed.

## Phase 5 review findings and limitations

- Fixed same-document hash entry while the root page is already open; strips the new secret and focuses the entry heading.
- Fixed organizer confirmation cancellation losing focus by keeping its opener mounted; generated-link focus and panel-close opener restoration were rechecked.
- Reused the transaction connection for session rechecks to avoid connection-pool exhaustion; switched session expiry to statement time so a lock wait cannot authenticate against a stale transaction timestamp. The new PostgreSQL expiry-wait test passes.
- Cleared any displayed prior link before issuance/revocation, so a failed/ambiguous replacement does not keep presenting an obsolete secret. Only status is retrievable afterward.
- Reviewed server authorization, secret exposure, shared cookie/origin protections, event-first locks, unchanged references/migrations/roster behavior and phase boundaries. No known blocking source finding remains; final `git diff --check` passed.
- No automated browser E2E suite, screen-reader/full accessibility audit, production, multi-instance/load test or push revocation notification was run/added. Per-process rate limiting and retained revoked/expired access/session records remain existing operational limitations. Idle pages revalidate on navigation/refresh/visibility; every API request remains authoritative.
- The original design preview was unavailable through the web tool; recorded reference notes and existing tokens were used. Phase 6 D21 interactions/validation and later persistence/submission/results remain absent. Q04/Q06/Q07/Q08/Q10 alerts/Q11 remain later gates.

## Phase 5 completion report

**Phase:** 5 — Juror Entry & Wizard Foundation. **Status:** DONE.

**Implemented / Architecture / Files:** Approved link/session lifecycle, server-derived category access, deterministic protected wizard navigation and responsive/accessible states, as above.

**Acceptance:** entry, T/V authorization, forbidden-step rejection, navigation structure and desktop/mobile behavior are implemented and verified. Final source hygiene/check rerun and verification-service cleanup passed. All Phase 5 acceptance criteria are satisfied.

**Next phase:** 6 — Voting Interaction & D21 Engine, only in a new user-started session after Phase 5 is DONE. No Phase 6 work or commit performed. Suggested eventual commit: `feat: add juror entry and authorized wizard foundation`.

**Handoff:** All four implementation documents and relevant wiki pages updated with actual validation, limitations and the Phase 6 handoff.

Cleanup verified: owned temporary API/web services on 3002/5174 stopped and both ports have no listeners; browser verification tab closed and viewport reset; exact generated browser database dropped normally and absence verified; temporary credential/fixture files removed. Read-only development inspection still reports four migrations/14 tables. Development configuration/password/data were preserved. Desktop/mobile screenshots are saved outside the repository.

<details>
<summary>Completed Phase 4 report and earlier phase history</summary>

The following is historical. Its no-wizard and future Phase 5 statements describe the end of Phase 4, before the current authorized session.

## Phase 4 completed behavior

- Protected voting draft create/list/detail/edit; selection/final category setup; shared event teams with voting-specific entries, display order and propagated descriptive corrections. Original item snapshots/ballot references are retained. No name-based identity merging.
- Explicit draft configuration: selected places (advancing teams or winners), maximum positive votes, maximum negative votes and negative-vote enable/disable. No formula, rounding or cap defaults are inferred. Each negative requires two positives actually cast; not all votes must be used.
- Shared strict contracts enforce integers within PostgreSQL bounds, positive places/positive cap, nonnegative negative cap, positive cap greater than places, negative cap no greater than half the positive cap, and zero negative cap when disabled. Draft configuration can precede a complete candidate/roster setup.
- `PUT /votings/:votingId/configuration` persists all four explicit fields atomically. Metadata PATCH rejects rule/ownership/status/deadline injection. Selection count is the advancing slots; registered count is actual entries and non-advancing count is derived. No reversed elimination mode or results ranking is introduced.
- `POST /votings/:votingId/activate` locks event first, then voting; checks draft/no ballot history, valid explicit limits, linked entries, places and combined vote allowance below candidate count, at least one same-event allowed group, and equal T/V groups of 5/7/9 each. Status changes only after all checks. Invalid activation rolls back without setting the sticky roster marker; successful active retry is idempotent.
- Voting metadata/configuration/entries/permissions freeze after first activation or any ballot. Shared team and juror descriptive corrections remain available. Event roster additions/removal/reassignment remain sticky-frozen once any voting starts or any ballot exists.
- Active → closed and closed/archived → active have explicit confirmation, idempotent retries and preserved history/configuration. Admin reopening never rechecks readiness, clears history or unlocks setup. Drafts cannot use reopening to bypass first activation. No archive endpoint is introduced.
- Every endpoint inherits admin/session/origin guards. Event-first locks serialize activation, configuration, roster operations and freeze triggers. Composite same-event references and RESTRICT protections remain intact.
- Responsive real-backend admin forms with labels, linked validation summaries, focused errors, retained failed inputs, keyboard confirmation/cancel and refresh recovery.

## Final Phase 4 validation

- `npm run check` PASS: four workspace typechecks, lint, formatting, 13 fast tests and API/web builds.
- `npm run test:db` PASS: **87 tests** (14 foundation, 12 auth, 16 event/jury, 45 voting/configuration/team/lifecycle), all against generated disposable databases.
- New coverage: explicit limit persistence/invalid tuple rejection, selection/final with three places and four-plus/two-minus limits, negative disable, T-only/V-only/both permissions, successful activation with 5/7/9 jurors, missing/unequal/unsupported rosters, incomplete/invalid config, unlinked/missing entries, missing groups, candidate limits, draft ballot history, idempotence and immutable setup after activation/closure/archive.
- Every new route rejects anonymous/expired/revoked/juror access and incorrect mutation origin/header. Malformed identifiers, unknown fields and missing resources are covered. Cross-event references remain rejected by earlier API/SQL tests.
- Actual PostgreSQL concurrency: activation versus roster removal permits only a consistent serial outcome; activation visibly waits for the event lock and rejects a roster changed before commit. Another event activates independently while the first is locked. Existing configuration/permission/item locking and closure/reopening races pass.
- Migration application/repeatability PASS in a new disposable browser database and twice in development. In-memory digest of all public-table rows before/after confirms development data and credentials unchanged. Four migrations remain applied. `npm run db:generate` PASS: 14 tables, no schema drift/new migration.
- Browser PASS: missing-rule and unequal-roster activation rejection with focused errors; invalid plus/negative tuple validation; corrected explicit rules; adding the fifth V juror through UI; actual selection activation; persisted state on refresh; final category with negatives disabled; actual final activation; stale configuration editor rejected with retained inputs and refreshed editor removed; close/reopen preserves explicit rules and frozen controls. First activation was exercised through the API/UI, not a SQL status fixture.
- Keyboard confirmation/cancel and opener focus restored. Portrait 375×812, landscape 812×375 and desktop 1280×900 verified with no measured horizontal overflow; tested form/button heights at least 44px. Screenshots visually reviewed and saved outside the repository.
- Source review covered contracts, auth scope, lock order, invalid-activation rollback, history, UI recovery, maintainability and phase boundaries. `git diff --check` passed. No known Phase 4 blocker remains.

Cleanup verified: temporary services on 3002/5174 stopped (no listeners), browser tabs closed and viewport reset; generated browser database dropped normally and absence verified; temporary connection/test-log files removed. Existing development credentials were never replaced for tests.

## Known limits and next phase

No automated browser E2E suite, full accessibility audit, production deployment or multi-instance/load testing was performed. D21 interaction/ballot validation is Phase 6 and later, not implemented here. Manual limits are the approved product choice; automatic H21 formulas/rounding are not implemented. No ballot API, wizard, dashboard, results, tie-breaking, deadline or deletion/archive feature was added.

Q03 link issuance/redemption/lifetime must be resolved before public juror entry. Q04 submission, Q06 ties, Q07 deadlines, Q08 submitted-ballot unlocking, Q10 alerts and Q11 operations remain gated in their assigned phases.

## Phase completion report

**Phase:** 4 — Voting Configuration & Teams. **Status:** DONE.

Selection/final setup, explicit voting rules, teams/items, allowed T/V groups, first activation/invalid activation, closure and approved admin reopening satisfy the phase criteria. Validation, review and actual limitations are recorded above. The four implementation documents and relevant wiki pages are updated. Suggested future commit message: `feat: add voting configuration and team management`; no commit is authorized or made.

**Next:** Phase 5 — Juror Entry & Wizard Foundation, only in a new user-started session. Stop here.

<details>
<summary>Historical Phase 4 incremental work and validation — 2026-10-16</summary>

These earlier incomplete-status statements describe earlier stopping points and are superseded by the completed state above.

## Phase 4 implemented slice

- Guarded voting draft create/list/detail/edit and strict shared contracts. Names/instructions and selection/final round labels persist in existing storage; no inferred selection/elimination or D21 rules.
- Event detail voting list and `/admin/votings/:votingId` detail/edit screen, shared accessible forms, loading/empty/error/retry states, pending/success feedback, retained failed inputs and responsive layout.
- Draft T/V permissions through protected GET/PUT allowed-group routes and an accessible editor. Supports T, V, both or incomplete setup; validates unique same-event groups and replaces permissions atomically under the same event-first draft lock. Does not freeze roster or add juror entry.
- Every route inherits `adminGuard` inside the cookie/origin scope. Collection event ownership is authoritative; bodies cannot reassign event, change status or set D21/deadline fields.
- Updates lock parent event before voting and recheck status/ballot history transactionally. Started votings and drafts with ballot history reject edits. This is a temporary safety gate, not approval of Q05 policy. Sticky roster triggers and composite/RESTRICT references remain intact.
- Shared event teams and voting-specific entries, draft-only entry addition/reassignment/order editing, same-event references and unique team per voting. Team descriptive corrections are read through shared references; original item snapshots and ballot IDs are retained. No deletion/archive is exposed.
- Active → closed under event-first locking, explicit UI confirmation, idempotent retry and preserved ballots/configuration.
- Additive `0003_young_starbolt.sql`: teams, same-event item references and legacy backfill to one distinct team per item. No name-based identity merging.
- No D21 configuration, activation endpoint, deletion/archive, deadline, ballot API, wizard, dashboard or results.

## Phase 4 validation actually performed

| Check                               | Result                                                                                                                                                                                                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                     | PASS: four workspace typechecks, lint, formatting, 13 fast tests and both builds.                                                                                                                                                                                          |
| `npm run test:db`                   | PASS: 59 PostgreSQL tests — prior 42 plus 17 voting tests, all using disposable databases.                                                                                                                                                                                 |
| API integrity                       | PASS: draft CRUD, unchanged/null D21/deadline fields and roster lock, missing/invalid IDs, event list isolation, ownership/status/rule injection rejection, started/ballot-backed edit rejection.                                                                          |
| Authorization                       | PASS: every new route rejects anonymous, expired, revoked and juror sessions; mutations reject missing header and wrong origin.                                                                                                                                            |
| Concurrency                         | PASS: draft edit observed waiting on parent event lock, then rejected after activation SQL fixture commits. Prior activation-fixture/roster race tests still pass. No activation endpoint exists yet.                                                                      |
| Migration application/repeatability | PASS: additive migration applies/repeats in disposable and development databases; migration count is four. Existing core records, item snapshots, ballots and shared password were compared before/after and preserved. Original 0000–0002 unchanged.                      |
| `npm run db:generate`               | PASS after generating/reviewing 0003: 14 tables, no further schema drift.                                                                                                                                                                                                  |
| Browser management                  | PASS against disposable real backend: login, empty list, create selection draft, edit to final category, saved detail/list after navigation/refresh, invalid-field summary/focus, keyboard open/cancel/save and opener focus restoration. Loading/pending states observed. |
| Browser recovery/safety             | PASS: real parent-row-lock timeout, focused error/retained input, successful retry. Stale editor rejected after SQL active fixture; refresh removes edit control and original stored name remains.                                                                         |
| Responsive browser                  | PASS: default desktop, 375×812 portrait detail and 812×375 landscape editor. No measured horizontal overflow; measured buttons/inputs/select/textarea at least 44px high. Viewport reset.                                                                                  |
| Review                              | Route scope, contracts, locks, integrity and phase boundary reviewed; `git diff --check` clean at review.                                                                                                                                                                  |

First expanded database run passed 49/50: the new expired-session fixture violated the existing creation-before-expiry constraint. Corrected its creation time; full rerun passed 50/50. Strengthened concurrency coverage to observe a real PostgreSQL lock wait. No product constraint was weakened.

After the user's “please continue,” added unaffected draft T/V permission configuration. Full `npm run check` passed and PostgreSQL coverage expanded to 53/53: T/V/both/incomplete and repeated replacement, cross-event/missing/duplicate rejection without modifying prior permissions, all new route guards/origin checks, started/ballot-backed write rejection and parent-lock concurrency. Schema regeneration again reported no drift.

Additional browser checks passed for T-only, V-only, combined/incomplete permission edits, reload persistence, keyboard save/cancel/focus restoration, 375×812 and 812×375 layouts and stale permission rejection. Review fixed open editors remaining visible after status refresh; both draft forms now disappear when refreshed voting is no longer draft. Stale permission form removal and retained saved groups were verified against a real active SQL fixture. No activation endpoint was added.

At the earlier draft-only stopping point, temporary API/web services on 3002/5174 were stopped, browser tabs closed and viewport overrides reset. The generated `d21_p4_browser_*` database was dropped and absence verified; its temporary connection file was removed. Read-only inspection confirms three migrations in the configured development database. `.env`, development shared password and data were preserved. A draft screenshot was saved outside the repository for review.

## Shared-team and closure continuation — verified results

- `npm run check` PASS: four workspace typechecks, lint/format, 13 fast tests and both builds. `npm run test:db` PASS: 59 tests, including every new team/item/closure route guard and origin check.
- Shared teams/entries: duplicate names remain distinct IDs; one team may be included in several categories; descriptive corrections propagate; original item snapshots remain untouched. API/SQL checks reject cross-event references and duplicate entries. Concurrent adds serialize; started/ballot-backed additions/reassignment/order changes fail.
- Upgrade test now includes duplicate-name legacy items and a referenced ballot entry. Migration/repeat application preserves credentials, snapshots, IDs and ballot references while creating distinct team identities.
- Migration generation reported 14 tables/no further drift. Applied and repeated `npm run db:migrate` in development: count four, before/after comparison confirms core records, password, roster markers and ballot history preserved. Existing migration files 0000–0002 unchanged.
- Browser: team empty/create/edit, validation summary/focus, selection/final entry creation, duplicate-choice filtering, order/refresh, shared correction in both categories, keyboard save/cancel/focus, 375×812 portrait and 812×375 landscape (no measured overflow, controls ≥44px). Stale entry rejected after a SQL active fixture; refreshed entry controls disappear; descriptive team correction still works.
- Browser closure: explicit confirmation/cancel, keyboard focus, successful close and persisted closed state with teams retained after reload. The active state was a SQL fixture; no activation endpoint was exercised.
- Review fixed numeric order errors incorrectly mentioning text length. Added a per-field validation message and rechecked it in the browser.
- Two early PostgreSQL runs completed assertions but exited with closing-client errors because forced database cleanup raced socket shutdown. Shared test cleanup now waits for zero connections and uses a normal DROP; full 58-test and then 59-test runs passed without unhandled errors. No application authorization or database constraint was relaxed.
- This continuation's temporary API/web services were stopped; browser tabs closed and viewport reset. Its generated browser database was dropped normally and absence verified; the temporary connection file was removed. Development remains migrated to four migrations, with shared credentials/core data preserved. Review screenshots were saved outside the repository.

## Unconditional reopening clarification — verified results

- User confirmed each negative requires two positives actually cast, and admins may always reopen. The negative eligibility ceiling is recorded with examples for Phase 6; candidate/seat-based positive caps and rounding remain unresolved. No interaction engine was added.
- Added protected `POST /votings/:votingId/reopen` and responsive confirmation UI. Closed/archived → active needs no readiness check; active retry is idempotent. Drafts return 409 and cannot bypass first activation. Ballots, entries, permissions, configuration and sticky roster lock are preserved; editing remains frozen. No archive operation was added.
- `npm run check` PASS (four typechecks, lint, formatting, 13 fast tests and both builds). `npm run test:db` PASS: 61 tests (14 foundation, 12 auth, 16 event/jury, 19 voting/team/lifecycle). New coverage includes route auth/origin guards, malformed/unknown bodies and IDs, draft rejection without freeze, incomplete closed/archived reopening, preservation, event-lock waiting and concurrent close/reopen serialization.
- Interactive real-backend browser verified closed → active, persisted status after refresh, confirmation/cancel with opener focus restored, keyboard submit, reclosure and mobile reopening. At 375×812 the confirmation has no horizontal overflow; measured button heights are 44px. Screenshots saved outside the repository. Archived reopening is covered by PostgreSQL tests, not browser UI.
- Migration application/repeatability PASS in the new disposable browser database (four migrations); `npm run db:generate` reports 14 tables/no drift. No schema change was needed. Source/authorization/locking/phase-boundary review and `git diff --check` passed.
- The first browser seed failed because its SQL omitted required `kind`; the disposable fixture was corrected before browser verification. Product code was unaffected. Temporary API/web services stopped, browser tab closed, viewport reset, generated database dropped normally and absence verified; temporary connection/log files removed. Development data/password/`.env` unchanged.

## Remaining Phase 4 gates

User confirmed H21 as the D21 authority, shared event teams and permission to reopen. Q09 is implemented. A narrow clarification is pending for the guideline’s conflicting small-election example/finite threshold and integer rounding. The user subsequently confirmed unconditional admin reopening, preserving history; API/UI are now implemented. Q07 deadline deferral is a proposal, not an approved decision. Recommendations in decisions.md are not implemented as approved policy.

Selection/final **draft preparation** passes; complete configuration remains unmet. Explicit D21 parameters, activation-time equal 5/7/9 rosters, invalid-activation rollback and remaining post-activation configuration policy remain open. Closure/reopening are implemented. No activation endpoint exists, so actual invalid activation and API activation/roster races cannot be tested yet.

No automated browser E2E suite, full accessibility audit, complete Phase 4 workflow, deployment or multi-instance/load validation ran. Interactive browser checks used disposable credentials/data. Phase 5 must wait for Phase 4 DONE and a new user-started session.

## Phase 4 completion report

**Phase:** 4 — Voting Configuration & Teams. **Status:** IN_PROGRESS.

**Implemented / Architecture / Decisions:** basic draft API/UI and temporary edit gate above; existing migration/history/configuration preserved, no product rule inferred.

**Files / Modules:** API `modules/votings`, auth/app/server registration, shared contracts, web voting list/detail/forms/routing, root database test script and docs.

**Validation / Review:** results, fixture correction, concurrency evidence and limitations above. No known blocker in the implemented draft slice; the phase remains incomplete.

**Acceptance / Next phase:** draft preparation verified; remaining criteria open above. Phase 5 — Juror Entry & Wizard Foundation is conditional on full Phase 4 completion and a new user-started session.

**Handoff:** all four implementation documents updated. Suggested eventual commit message after full Phase 4 completion: `feat: add voting configuration and team management`. No commit authorized/performed.

</details>

## Historical Phase 3 record

## Phase 3 implemented behavior

- Event create/list/detail/edit with real backend data, strict trimmed names/descriptions and maintained update timestamps.
- T/V group creation and descriptive renaming, immutable codes and one group per code/event.
- Event-specific juror create/list/edit, duplicate display names, correct T/V assignment, search and membership removal before freeze, subject to existing RESTRICT references. No global juror accounts or name-based identity matching.
- Every new administration endpoint inherits `adminGuard` inside existing cookie/origin scope. Shared strict request/response schemas and composite same-event references protect the API and database relationships.
- Approved Q05 event-wide freeze of additions/removals/reassignment once voting starts or any ballot exists. Name corrections remain available. Approved Q10 incomplete setup is allowed; activation-time equal T/V groups of 5/7/9 remain Phase 4.
- Additive `0002_low_talon.sql` adds a sticky freeze marker, backfills existing voting/ballot history, and installs triggers sharing the event row lock with roster mutations. Applied `0000`/`0001` are unchanged.
- `/admin/events` and `/admin/events/:eventId` screens, shared login/session recovery, event/group/juror forms, empty/loading/error/retry states, removal confirmation, accessible labels/errors and keyboard focus. `/admin/login` remains direct login; `/` has no administration link.
- No event/group deletion/archive, voting configuration, D21, ballot persistence/submission API, wizard, dashboard or results.

## Phase 3 validation actually performed

| Check                         | Final result                                                                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`               | PASS after validation fixes: all four workspace typechecks, lint, formatting, 13 fast tests and both production builds.                                                                                                                                |
| `npm run test:db`             | PASS: 42 PostgreSQL tests — 14 foundation, 12 auth and 16 event/jury checks.                                                                                                                                                                           |
| `npm run db:migrate`          | PASS: additive migration applied initially; final repeat application completed without changing existing history/data.                                                                                                                                 |
| `npm run db:generate`         | PASS: no schema drift or additional migration generated.                                                                                                                                                                                               |
| Migration upgrade/backfill    | PASS in a generated disposable database: Phase 2 records upgraded, credential hash/display data/ballots preserved, correct freeze backfill, repeat migration count remains three.                                                                      |
| Authorization and isolation   | PASS: every new route rejects anonymous/expired/revoked and juror sessions; mutations reject missing header/cross-origin requests; cross-event group/child operations fail without modifying the other event.                                          |
| Roster policy and concurrency | PASS: incomplete setup/duplicate names, group uniqueness, pre-freeze removal, RESTRICT history protection, started statuses and every ballot status, sticky freeze, safe name correction, and concurrent activation/roster serialization.              |
| Browser management            | PASS: login, empty list, create/read/edit event, create/rename T/V, create/edit/reassign jurors, search/no-match state, saved list/detail after refresh, removal confirmation and cancellation. Removal success is covered by API integration tests.   |
| Browser keyboard/errors       | PASS: keyboard form opening/submission/cancel, error-summary focus, opener focus restoration, failed mutation retains values and succeeds on retry, real roster loading/lock timeout and Retry recovery.                                               |
| Browser roster/auth           | PASS: stale reassignment rejected after a test fixture freezes the event; refreshed membership controls and group selector disabled; name correction succeeds; logout, protected direct entry, expired-session recovery, root page with no admin link. |
| Responsive browser            | PASS: desktop, 375×812 portrait and 812×375 landscape. Title/action layout corrected; no horizontal overflow; measured button/input/select/textarea targets at least 44×44px. Temporary viewport override reset.                                       |
| Source review / diff hygiene  | PASS: authorization scope, event isolation, additive migration, phase boundaries, error handling and maintainability reviewed; `git diff --check` clean. No commit made.                                                                               |

The first expanded database run after service recovery passed 39 and failed 3 because a fixture reused a parameter as both text and a PostgreSQL enum. An explicit `ballot_status` cast fixed the fixture; the subsequent full 42-test run passed. Earlier Docker/PostgreSQL connection timeouts are historical; they are not current validation blockers.

Browser checks used a real API/database on temporary ports 3002/5174 and a generated database with a disposable password. Intentional dependency/schema and row-lock failures affected only that database. Test servers were stopped and the generated browser database was removed successfully. The previous attempted fallback container is confirmed absent. `.env`, development shared password, existing data and original migration files were preserved. At validation start the original web/API ports had no listeners; no original development server was stopped by this test continuation.

## Review findings and fixes

- Corrected the test-only ballot enum parameter typing; no application SQL or applied migration was changed for that failure.
- Browser keyboard testing found opener focus lost after cancellation. The form now captures the opener before it is disabled and restores focus after the parent commit; keyboard cancellation and successful save were rechecked.
- Portrait visual inspection found action buttons squeezing the event heading into a narrow column. Small-screen headers now stack; desktop/portrait/landscape were rechecked.
- Earlier review retained success messages during refresh, separated shared errors to avoid module cycles, kept membership confirmation explicit, and moved shared form-field definitions outside the component module to avoid hot-refresh warnings.
- Freeze enforcement is authoritative in server transactions, with existing composite database references intact. Privileged direct SQL administration can bypass HTTP policy and is outside this boundary.

## Known limitations

No automated browser E2E suite, full accessibility audit, production deployment or multi-instance/load test was performed. Browser scenarios were exercised interactively through the browser tool against real backend data. Future phases still require approved D21 methodology, configuration/lifecycle decisions, juror-link lifecycle, submission rules and other recorded open decisions. Shared administration access cannot attribute actions to individual people. No known Phase 3 blocker remains.

## Phase Completion Report

**Phase:** 3 — Event & Jury Management. **Status:** DONE.

**Implemented / Architecture / Decisions:** Event/jury management with guarded API/UI, shared contracts, same-event integrity, approved roster freezing/setup/removal policies and additive storage, as above.

**Files / Modules:** `apps/api/src/modules/{events,jurors}`, shared errors/validation and auth registration, `packages/contracts/src/index.ts`, database schema/migration metadata, `apps/web/src/modules/admin`, auth/routing integration and wiki.

**Validation / Review:** Final command results, browser scenarios, three fixes and limitations are recorded above.

**Acceptance criteria:** Event create/edit/list/detail; juror/group management; correct T/V membership; invalid/unauthorized relationship rejection; meaningful API/database/browser validation; responsive/accessibility states; review and documentation are satisfied.

**Next phase:** Phase 4 — Voting Configuration & Teams, only in a new session explicitly started by the user. Do not continue automatically.

**Handoff:** All four implementation documents updated. Suggested future commit message: `feat: add event and jury management`. No commit performed.

<details>
<summary>Historical Phase 2 implementation and validation record</summary>

The record below describes the end of Phase 2 only; its then-current Git, service, password-setup and future-event-management statements are historical. Current state and results are above.

## Implemented

- Password-only administration login for admins and guarantors, with the same permissions and shared `Administrace` identity. No email, signup or individual credential model.
- Local hidden-prompt `admin:set-password` command for initial setup/replacement; replacement atomically revokes all admin sessions. `admin:revoke-sessions` keeps the password while revoking existing sessions. No real/default password was seeded during implementation.
- PostgreSQL sessions with 256-bit random tokens stored only as hashes, 12-hour absolute expiry, per-browser login rotation, idempotent logout, expiry/revocation checks and database-backed admin guards.
- HttpOnly/SameSite cookies, Secure host-only HTTPS cookies, exact-origin checks, custom request header, bounded password hashing and login throttling. Generic dependency errors fail closed.
- Additive `0001_regular_warbound.sql` adds singleton `admin_access`, event-scoped `juror_access` secrets, and exactly-one-actor `sessions`. Existing foundation migration and voting constraints remain intact.
- Juror backend preparation: shared typed identities, hashed secret storage, event-safe lookup, session references and tests for duplicate-name/event separation. No public juror-entry endpoint, link issuance workflow or wizard is implemented yet.
- Czech login UI with shared tokens and shadcn Button/Input, password visibility control, loading/error/retry, session restoration/expiry, logout and accessible focus. The authenticated screen confirms access and describes future event management without fake data.
- Root setup instructions, authentication wiki, updated decisions, phase plan and handoff.

Main files: `apps/api/src/modules/auth/{crypto,service,routes,operator}.ts`, `apps/api/src/{app,config,server}.ts`, database schema/migration, `packages/contracts/src/index.ts`, `apps/web/src/modules/auth/AuthScreen.tsx`, UI Input and API transport.

## Validation actually performed

| Check                              | Result                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial baseline `npm run check`   | PASS: four workspace typechecks, lint/format, 6 fast tests and both builds before authentication changes.                                                                 |
| Initial baseline `npm run test:db` | PASS: 14 PostgreSQL checks. The first sandboxed attempt was blocked by local-network permissions; the authorized rerun passed.                                            |
| Final `npm run check`              | PASS: four workspace typechecks, lint/format, 12 fast tests and both production builds.                                                                                   |
| `npm run test:db`                  | PASS: 26 checks: 14 foundation and 12 authentication integration tests, using independent disposable databases.                                                           |
| `npm run db:migrate`               | PASS: reviewed additive migration applied to the existing local development database.                                                                                     |
| `npm run db:generate`              | PASS: no schema drift after generating the additive migration.                                                                                                            |
| Operator CLI                       | PASS against a disposable database: hidden first/repeat prompts, successful set-password without echo, and revoke-sessions command.                                       |
| Manual browser checks              | PASS: real login, incorrect-password feedback/focus, session restoration after refresh, logout, keyboard submit/visibility toggle, unavailable server and retry recovery. |
| Responsive checks                  | PASS: desktop, 375×812 portrait and 812×375 landscape; no horizontal overflow at tested sizes; input/buttons measured 44 px high. Temporary viewport override reset.      |
| Dependency installation audit      | PASS: zero reported vulnerabilities when the two official Fastify plugins were installed.                                                                                 |

No automated browser E2E suite, full accessibility audit, production deployment or multi-instance operations testing was performed. Browser tests used temporary credentials in an isolated database; none were copied into development configuration.

## Review findings and resolutions

- Added row locking and credential-hash rechecks so password replacement and login serialize correctly. If replacement revokes a just-created login session, login returns unauthorized rather than an internal error. A real concurrent integration test covers this boundary.
- Preserved retryable 503 status for password-hashing capacity errors; added a focused regression test. Session-store failures never grant access or expose database details.
- Removed an unnecessary dynamic import after it caused a build warning and then an unused-import typecheck failure. The final static import passes the complete checks without that warning.
- Moved login errors beside the password field, retained entered input, and verified programmatic focus/keyboard behavior.
- Reviewed new source, migration, contracts and scope directly because Git has no baseline commit. No event CRUD, D21 logic, wizard submission or unrelated refactor was introduced.

## Known limits

The development shared password still needs to be chosen by an operator using `npm run admin:set-password`. This is initial setup, not a seeded/demo credential. Shared access cannot identify which person performed an action. Admin and guarantor have equal rights by the user's instruction.

Juror link lifetime, issuance and redemption must be finalized before exposure in the relevant later phase. Q02 and Q04–Q11 remain open for their affected phases. Login throttling is process-local; proxy/hosting configuration and expired-session retention/cleanup remain operational work. The authenticated screen has no event-management features yet.

## Phase Completion Report

**Phase:** 2 — Authentication & Sessions. **Status:** DONE.

**Implemented / Architecture:** Shared-password administration, approved 12-hour server sessions, protected endpoints, operator setup/revocation, login UI, juror backend preparation and additive storage, as detailed above.

**Files / Modules:** API auth, configuration/server, database schema/migration, shared contracts, web auth and shared Input, documentation.

**Validation:** Actual commands/results are in the table. Automated E2E and production operations were not run.

**Review findings:** Concurrent replacement/login, retryable errors, imports and form feedback were reviewed and corrected. No known Phase 2 blockers remain.

**Acceptance criteria:** Login/logout, unauthorized rejection, consistent expiry/revocation, approved shared admin/guarantor permissions, auth tests, shared contracts, juror preparation, usable login UI, validation, review and handoff are complete.

**Next phase:** 3 — Event & Jury Management, only in a new user-started session after the relevant Q05/Q10 decisions. Phase 3 has not started.

**Handoff:** Updated plan.md, progress.md, decisions.md and next-session.md. Suggested commit message: `feat: add shared-password administration and server sessions`. No commit performed.

## Phase 2 routing follow-up — DONE, 2026-10-16

The user requested a juror-first home page and a separate direct admin URL. `/` now renders `JurorLanding`; `/admin/login` renders the existing password/session screen. Neither the public page nor unknown paths exposes an admin navigation link. A shared `AppHeader` keeps branding consistent; browser titles match the page. Link redemption and voting remain later-phase work.

Validation: `npm run check` PASS (four workspace typechecks, lint, formatting, 12 tests and both builds). Browser checks PASS for root-page content/no admin link, direct and refreshed admin login, home navigation, unknown path, and mobile layout. Database tests were not rerun for this frontend-only adjustment; their prior Phase 2 result above remains historical. Review found no authorization changes or new dependencies. Plan, decisions and handoff updated; Phase 3 remains NOT_STARTED. No commit made.

</details>

</details>
