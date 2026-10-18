# Session handoff

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

Shared admin/guarantor identity and equal rights; reusable event/juror links without expiry; 12-hour sessions; regeneration/revocation ends that juror's access. No deadlines or alerts by explicit decision.

Explicit D21 caps and one negative per two positives actually cast; optional/empty use; retain invalid reducing edits. Configuration/items/permissions and event rosters freeze at the approved boundaries. Reopening preserves ballots and freezes. Saved valid open categories are explicitly selected for independent submission; exact revision/replay semantics and administrator-only unlock preserve history.

Only current eligible submitted ballots count. Score is positives minus negatives; shared competition ranks; entire crossing cutoff tie unresolved and organizer handled outside the app. Final requires closed, positive full eligibility/participation, no factual problem and no unresolved cutoff tie. Reopen/unlock can reverse finality. Audit snapshots never add votes. Preserve protected results/participation/time XLSX and existing admin interventions; no reset/delete/cancel/archive/publication policy is inferred.

Contracts: [results](../wiki/results-ranking.md), [submission/unlock](../wiki/ballot-submission.md), [review](../wiki/multi-category-review.md), [wizard](../wiki/juror-wizard.md), [dashboard](../wiki/operational-dashboard.md). Full completion evidence: [progress](progress.md).
