# Session handoff

**Deployment update, 2026-10-18: DONE.** Stages 1–3 are live on the existing [free test service](https://d21-voting-test.onrender.com), source `a79338c`, Render deploy `dep-dbaimoeq1p3s73bqt4sg`. Six migrations, hosted preservation, authenticated workspace/Teams and test-link revocation checks pass. Clipboard success was announced twice; the browser connector returned an empty clipboard, so live copied-text equality is unverified (local automated copying/fallback passed). Earlier local-only statements below describe historical stage boundaries. User explicitly approves a new Stage 4 chat for the Jurors table, including automatic T/V groups; no Stage 4 implementation occurs here.

## Approved next session: Simplification Stage 4

The user explicitly selected **Create Stage 4 chat; include automatic T/V groups** after the release. Start only Stage 4 in that new chat. Read README, every implementation document, relevant wiki and actual code/Git state before changes.

Implement a Jurors table with inline names and T/V assignment, spreadsheet paste preview, one atomic save, retained row/field errors, stale-edit comparison and safe retries without duplicate identities. Include automatic T/V groups. Reuse approved Stage 3 atomic/retry/comparison behavior where appropriate, while respecting juror identity and the stricter roster freeze. Preserve existing juror IDs, links/sessions, ballots, memberships/history and existing group names/IDs; never unfreeze or silently replace credentials. Inspect group creation/membership constraints before choosing automatic group behavior. Obtain a decision for any genuinely unresolved affected product rule instead of inventing it. Categories/combined setup/bulk copying/duplication/readiness remain later stages.

The release source is `a79338c`; see [current release verification](progress.md#stages-13-release-verification--2026-10-18) and [deployment guide](../wiki/deployment.md). Documentation may have a later main commit; auto-deploy is off. Preserve the root `.env`, ignored `deploy/.env.test`, all private backups and external key file. Stage 4 is authorized for local implementation, validation, review, accurate four-document handoff and cleanup. Current publication approval applies to this completed Stages 1–3 release; do not infer automatic Stage 4 commit/push/deployment authorization.

## Historical Stage 3 local handoff

Updated 2026-10-18. **Simplification Stage 3: DONE locally.** Phases 0–13 and Stages 1–2 remain DONE. Working tree stays on `main` after `38112f4`, retaining earlier uncommitted Stage 1/2 work. No commit, push, deployment, cloud/live-data operation, development migration, credential reset, charge or other-project change.

## Current Stage 3

User explicitly approved Teams-only inline names/descriptions/new rows, spreadsheet paste preview, one atomic table save, retained errors, stale-edit review and safe retries. Open **Příprava → Týmy** (`/admin/events/:eventId?setup=teams`). [Workflow/API/retry/conflict/limits](../wiki/simplification-stage-3.md).

`TeamsManager` loads the versioned snapshot; `TeamTable` handles edits/save/comparison, `TeamRows` renders labelled fields, and `TeamPaste`/`team-table-utils` preview clipboard text. New strict GET/PUT `/events/:eventId/teams/table` uses existing event locks and current admin checks after waits/before completion. Precise timestamp/content fingerprints detect concurrent writes, including legacy APIs; stable new-row UUIDs plus exact desired-state no-write replay prevent duplicate additions after uncertain responses. Any invalid row/conflict/database/auth error saves nothing in that attempt. Omission cannot delete; duplicate names stay distinct IDs. No migration, table or dependency added.

Refresh with unsaved values opens comparison. Explicitly applying local changes keeps changed whole rows, takes current untouched rows and remote additions, then requires a separate save; another concurrent write can conflict again. Failed inputs/errors stay available; session loss clears protected content. Clipboard input is headerless TSV, not file upload or name matching. Existing 64 KiB full JSON request limit remains. Values/preview are memory-only; save before leaving. Browser unload/retention is browser-controlled.

Stage 1 untimed access, encrypted repeatable Copy/fallback, legacy handling and external-key requirements remain unchanged. Stage 2 event navigation remains. All existing voting rules, permissions, roster/configuration freezes, revisions/submission/replay/unlock/history, current-only results/ties/finality and XLSX remain authoritative. Shared team corrections still propagate while original snapshots/ballots/history remain preserved.

## Validation, review and cleanup

- Final source check PASS: 68 fast tests, workspace/E2E typechecks, lint/format and both builds. E2E typecheck/format pass after final harness corrections. PostgreSQL `npm run test:db -- --maxWorkers=2` **265/265** across nine files, including 13 new atomic-table/security/concurrency/replay/rollback cases.
- Final fixed-build `npx playwright test` **15/15**, no retries, desktop/phone/landscape-dark/reduced motion. Teams preview/error/conflict/actual committed-response loss/no-duplicate retry/focus/auth recovery and earlier Stage 1 access/restart + complete T/V/voting/results/XLSX/unlock workflows pass. Axe A/AA, 44px/no-overflow and visual/source review pass. Earlier failures and harness corrections are recorded in [progress](progress.md); no assertion was removed to obtain passing results.
- Schema generation reports 14 tables/no drift. All six SQL/configuration fingerprints and development public-table data match the pre-validation baseline. Prior files outside Stage 3 remain byte-for-byte preserved; overlapping edits reviewed against baseline. Generated database count **0**, fixture servers stopped and temporary baseline/helpers removed. Secret-free screenshots are outside the checkout in this session visualization directory as `stage3-teams-{desktop,phone,landscape-dark}.png`.
- No full screen-reader/native-device/all-browser, native spreadsheet application, load/multi-instance/new-container or cloud/deployment validation. Preview remains inaccessible; recorded warm light reference/current tokens were used. Hosted pilot is still the historical Phase 13 build. Stage 1 key backup/migration/browser-cookie limits remain.

To validate again: `npm run check`, `npm run test:db -- --maxWorkers=2`, then `npx playwright test` against the finished build (do not rebuild during a browser run). Tests use disposable local databases/credentials and clean up their own servers. Preserve `.env` and development data. Read Stage 1 prerequisites below before any separately authorized deployment.

## Next-stage boundary

Stop after Stage 3. A new user-started session must approve the next precise scope. Jurors/categories tables, automatic T/V groups, combined category setup, bulk assignment/copy/duplication and new readiness tools remain unimplemented direction. No new D21/identity/submission/tie/batch semantics may be inferred. Publication, cloud/live operations, credentials, charges and other projects require fresh authorization. Suggested future commit only if explicitly requested: `feat: add atomic editable team table and spreadsheet preview`.

## Historical Stage 2 handoff

Updated 2026-10-18. **Simplification Stage 2: DONE locally.** Phases 0–13 and Stage 1 remain DONE. Work stays on `main` after `38112f4` with the earlier uncommitted Stage 1 preserved. No commit/push/deploy/cloud/live-data operation, development migration or credential reset.

## Current Stage 2

Compact event heading/navigation with **Příprava / Průběh hlasování / Výsledky** across event and category screens. Preparation uses separate **Porotci**, **Týmy** (`?setup=teams`) and **Kategorie** (`?setup=categories`) views, loading only the selected collection. Default/unknown view is jurors. Existing category routes remain; category setup returns to the category list. **Nastavení eventu** is below preparation content. Global Eventy/logout and skip navigation remain available. [Workspace guide](../wiki/simplification-stage-2.md).

Existing forms/explicit saves/confirmations, Stage 1 untimed access/encrypted Copy/fallback, all approved voting rules, freezes, permissions, revisions/replay/unlock/history, progress/results/ties/finality and XLSX remain unchanged. No new backend, contract, migration or dependency. Navigation does not save forms; finish saving/cancelling before leaving.

Validation: source checks PASS (60 fast tests, workspace/E2E typechecks, lint/format/builds), PostgreSQL **252/252** with two workers, full local built-app browser **12/12** across desktop/phone/landscape without retries. New workspace cases cover context/history/direct entry, focused setup, keyboard/edit/save/failure recovery and expired-session restoration; existing Stage 1 restart/copy and complete voting/result/export/unlock workflows pass. Axe/no-overflow/44px checks and visual/source review pass. Schema generation reports 14 tables/no drift. Development data/configuration/all SQL fingerprints unchanged; zero generated databases and fixture servers stopped. See [progress](progress.md) for helper failures and limitations.

No full native-device/screen-reader/all-browser, load/multi-instance, new container or cloud validation. The preview remains inaccessible; recorded warm light design was used. The hosted app is still the historical Phase 13 build. Secret-free workspace screenshots are in the session visualization directory outside the checkout; ignored reproducible test output remains local.

## Next-stage boundary

Stop after Stage 2. A new user-started session must authorize the exact next scope. Editable tables, batch/spreadsheet preview, one save per table with retained errors, automatic T/V groups, combined category setup, bulk assignment/copy/duplication and readiness tooling remain unimplemented later direction. Preserve existing domain/audit constraints and all Stage 1 changes; do not infer new D21, identity, submission or tie rules. Commit, push, deployment, live/cloud changes, charges and other projects require fresh authorization.

## Stage 1 operational prerequisites retained

- Read [Stage 1 contract, session transition and key backup/setup](../wiki/simplification-stage-1.md) before operating this version. New juror expiry is null; only valid/unrevoked existing juror sessions migrate. Expired/revoked sessions never revive. Old browser cookies can still expire until personal-link re-entry issues the new cookie.
- Link generation and repeatable encrypted retrieval need private `JUROR_LINK_KEYS` + `JUROR_LINK_ACTIVE_KEY_ID` outside the checkout/database. No real key was provisioned or existing `.env` rewritten. Without keys, existing hash-based entry/sessions and revocation work; generation/copy safely fail 503. Keep keys unchanged across restarts and backed up separately from database dumps. Retain old IDs/keys during rotation and for retained backups.
- Legacy hash-only links still work. They cannot be recovered; explicit confirmed replacement enables future copying and invalidates earlier links/sessions. Copy never replaces access or changes voting data. Do not silently replace legacy links.
- Apply migration 0005 before the updated API in any future authorized deployment. Do not run the old non-null-expiry API after upgrading. Local development/live databases have not been migrated in this session; only disposable validation databases have six migration records. The hosted pilot remains the historical Phase 13 version below.
- Final validation: source check PASS (60 fast tests/typechecks/lint/format/builds), `npm run test:db -- --maxWorkers=2` 252/252, full built-app `npx playwright test` 9/9 across desktop/phone/landscape, compiled migrations/restart/clipboard/keyboard/axe/44px/no-overflow, generation no drift and original SQL integrity PASS. Review fixed focus timing, ordinary juror-list projection and stale hidden-link wording. Earlier failed attempts and explicit limits are retained in progress.md.
- Final development data/configuration/original-SQL fingerprints match the pre-final-validation baseline; generated test database count 0 and fixture-owned servers stopped. No development write/migration or live operation. Temporary preservation helpers are removed; three secret-free roster screenshots are outside the repository in this session’s visualization directory. All four implementation documents and relevant README/wiki/configuration guidance are updated.
- Limits remain browser-controlled cookie retention, Chromium/axe rather than full native/screen-reader/all-browser coverage, and no new load/multi-instance/container-image or owner-key-backup disaster-recovery drill. Do not confuse local Stage 1 checks with the historical live evidence below.

## Historical Phase 13 operational handoff

The record below is retained for account/data continuity. Its prior Git/publication authorization and 12-hour juror-session wording are historical, superseded by the current Stage 1 scope/decisions. It is not evidence of deploying Stage 1.

Updated 2026-10-18. **Phases 0–13: DONE within the approved scope.** Phase 13 includes local integrated validation, portable Linux Docker hosting, the live unpaid colleague-test instance, authenticated live workflows and recovery, technical review, documentation and preservation. Stop here; no further phase is authorized automatically.

## Live application and accounts

- App: https://d21-voting-test.onrender.com; administration: https://d21-voting-test.onrender.com/admin/login. Existing shared password is configured and was used successfully with the user's explicit test authorization. Never copy it from chat into source, env files, arguments or logs; do not reset it or revoke all user sessions without authorization.
- Render “Jakub's workspace” `tea-d91qrvhkh4rs73aqgbh0`; only this task's `d21-voting-test` service `srv-dbac88eq1p3s73b4jqm0`, Free/Frankfurt/manual deploys. Latest verified live deploy `dep-dbae0p5g1s2s73boe0bg`, source `833a8c6`, readiness `/api/ready`. Later completion documentation commits need no deployment; application code is unchanged. Settings match `render.yaml`; no automatic Blueprint sync.
- Supabase “SmejkalJakub's Org” `ljobtzyeffzapiajvdez`, Free. Only new `d21-polling-test` project `ieqmrqctivjiljzyyucn`, Frankfurt. Existing Story Teller/Stribograd and shared billing remain unchanged. Render had no card, $0 charges and free allowances; no paid resources/upgrades are authorized.
- Data API disabled, pg_graphql absent, no provider-role table grants, security advisors clear, SSL enforced. Dedicated `d21_app` uses verified-TLS session pooling; its connection limit is restored to -1 after the controlled outage test. Private ignored mode-0600 `deploy/.env.test` targets only this project. Preserve the root development `.env`.
- Five Drizzle migrations, 14 app tables. Original SQL 0000–0003 are immutable; earlier additive 0004 pins the invoker roster trigger search path. Image includes the public provider CA; `NODE_EXTRA_CA_CERTS` must be set before Node starts. Startup script migrates then execs the server; failures stop startup.

## Final validation evidence

- Source check: 56 fast tests, four workspace plus E2E typechecks, lint/format/builds passed. PostgreSQL 246/246; generated local browser 6/6. Full earlier evidence, intermediate failures and limits are in progress.md.
- Authenticated live browser **6/6**: desktop, phone and dark-preference/reduced-motion landscape. Actual admin setup/T/V authorization/D21 invalid rejection/draft save-reload/review/confirmation/independent submission/dashboard/ranking/ties/finality/XLSX/unlock/replacement; actual downloaded workbooks reopened. Axe, keyboard/focus, 44px targets and no-overflow checks pass. Designed light palette remains light.
- Independent live admin sessions and secure host-only cookies pass. Forged forwarding headers do not bypass the redemption limiter (20 invalid-link 401s, then 28 throttled 429s). `TRUSTED_PROXY_CIDRS` stays empty: conservative shared proxy-IP buckets, not verified source-network isolation or distributed throttling.
- Controlled new-test-role access interruption terminates eight app connections and produces sanitized authenticated 503. Restored access preserves the same session/results. Manual redeploy preserves two admin sessions, final results, export and five migration records. A malformed helper logout lacking JSON body returned expected 400; corrected logout/revoked-cookie checks pass. Two earlier probe session hashes remain for normal 12-hour expiry; their raw cookies were not retained and no user-wide logout was performed.
- Hosted link regeneration/revocation passes. Three closed labelled `Ověření Phase 13 – …` events remain; their 30 links are revoked and active test-juror sessions are zero. Your pre-existing event/data, admin credential, development `.env` and all SQL hashes are unchanged.
- Final backup `backups/d21-polling-test-20261018-final.dump`, private mode 0600 under 0700 directory. Four total events, 90 current submissions, 93 submission-history records, five migrations. Exact 15-table restore equality, then real Linux app readiness/login/final results/three-sheet XLSX pass against the restored copy. Generated restore DB/container and temporary files removed. This is recovery into isolated Linux Docker, not restore into managed Supabase.
- Temporary hosted-test helpers/output removed; credential scan found no file copies and working memory was cleared. Only live resources, ignored connection, private backups and screenshots remain intentionally. Screenshots outside the repository: session visualization directory `phase13-live-results-{desktop,phone,landscape-dark}.png`.

## Operations and limits

The user owns accounts/backups/restores and accepts no automatic deletion. Keep current snapshots private; refresh before/after planned tests and before deployments using [deployment guidance](../wiki/deployment.md). No unattended backup schedule, paid upgrade or automatic test-data deletion. XLSX is a result snapshot, not a database backup.

Free sleep/cold-start/inactivity/quotas and shared peer-IP login/redemption throttling remain explicit pilot limits. No load/multi-instance, native Linux x86, full screen-reader/native mobile/native spreadsheet audit or managed-provider restore claim. Provisioning the future physical Linux server awaits its actual machine/origin and a separate user request. Keep explicit HTTPS origin and conservative proxy trust; never infer ingress ranges from outbound IPs.

The user authorized commit/push with multiple short Conventional Commits and no co-author trailers. Preserve other work; inspect actual Git state before any new edit. No automatic next phase or new product behavior.

## Product rules to preserve

Historical Phase 13 rule: shared admin/guarantor identity and equal rights; reusable event/juror links without expiry; 12-hour sessions (juror timing is superseded by Stage 1 above); regeneration/revocation ends that juror's access. No deadlines or alerts by explicit decision.

Explicit D21 caps and one negative per two positives actually cast; optional/empty use; retain invalid reducing edits. Configuration/items/permissions and event rosters freeze at the approved boundaries. Reopening preserves ballots and freezes. Saved valid open categories are explicitly selected for independent submission; exact revision/replay semantics and administrator-only unlock preserve history.

Only current eligible submitted ballots count. Score is positives minus negatives; shared competition ranks; entire crossing cutoff tie unresolved and organizer handled outside the app. Final requires closed, positive full eligibility/participation, no factual problem and no unresolved cutoff tie. Reopen/unlock can reverse finality. Audit snapshots never add votes. Preserve protected results/participation/time XLSX and existing admin interventions; no reset/delete/cancel/archive/publication policy is inferred.

Contracts: [results](../wiki/results-ranking.md), [submission/unlock](../wiki/ballot-submission.md), [review](../wiki/multi-category-review.md), [wizard](../wiki/juror-wizard.md), [dashboard](../wiki/operational-dashboard.md). Full completion evidence: [progress](progress.md).
