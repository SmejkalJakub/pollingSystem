# Decision log

## Stages 4–5 release — IN_PROGRESS, 2026-10-19

The user requests “please deploy it and then tell me what remains”. Prepare publication of the completed Stages 4–5 to the existing Render Free/Frankfurt service `srv-dbac88eq1p3s73b4jqm0` in the confirmed workspace, using its linked main branch; automatic deployment remains off. This is a release operation, not a new implementation stage. Necessary Git publication will use Conventional Commits with no co-author trailers. No credentials/key rotation, paid resources, other-project change or new feature scope.

The current service is verified as source `a79338c` / deploy `dep-dbaimoeq1p3s73bqt4sg`; remote main still matches `21aae5c`. Local release Docker build PASS (zero reported dependency vulnerabilities); publication scan PASS across 213 non-ignored files with no hosted database credential or external link-key values found. Existing local Stage 4/5 validation remains as recorded below; no application source was changed for this release preparation. The user restored the expired hosted admin session for post-deployment verification.

The user explicitly approved private pre/post backups and then explicitly approved committing/pushing the prepared changes to main and deploying them. The earlier automatic-review transfer block is resolved by that approval. Pre-deployment backup PASS: `backups/d21-polling-test-20261019T081831Z-pre-stages45.dump` (82,019 bytes, private 0600 under 0700, manifest validated). A private baseline records row hashes for all 15 public/drizzle tables: six migrations, six events, 91 ballots and existing access/history/session rows. Two initial empty backup attempts failed on private service-file quoting; corrected before publication, empty owned artifacts removed. No database mutation from these reads/backup. Git publication, deploy and hosted verification remain pending.

## Simplification Stage 5 — confirmed scope and implementation, 2026-10-19

- Inspection on 2026-10-18 found separate metadata/rule/permission/entry saves and no previously confirmed combined-save contract. Presented one combined form per category with atomic saving, incomplete drafts, retained errors, stable-ID retries and explicit stale comparison; the user's “please continue” adopts that concrete recommendation. Multi-category tables, import, bulk link copying, duplication and new readiness are separate later work. No publication authorization.
- Implementation choice within this scope: a client-generated stable category UUID and entry UUIDs address exact desired-state retries without persistent receipts. Strict GET/PUT `/events/:eventId/votings/:votingId/setup` uses existing admin checks/event-first transactions. Exact matching normalized state is read-only, even after a later freeze; otherwise a precise current fingerprint and editable draft/no-ballot state are required. Omission never deletes; collisions roll back the complete save.
- Fingerprints include raw scoped category/entry data with precise PostgreSQL timestamps, selected permissions, available event teams/groups and any category ballot. Roster freeze alone does not prevent configuring a different draft. Unchanged legacy partial rule tuples/unlinked entries may remain; changed rules must pass the existing complete tuple validator. Clearing configured rules and new partial tuples are rejected, preserving existing semantics. Activation still checks all readiness; no defaults or formula.
- Explicit comparison keeps changed local metadata fields, whole changed configuration/permission values and whole changed entry rows; adopts untouched current values and remote additions. Frozen or edited externally removed entries cannot be reapplied. No automatic merge/write. Saved entry IDs and untouched descriptive snapshots survive; reassignment swaps temporarily unlink references only inside the atomic transaction to honor the existing immediate uniqueness constraint.
- Combined form editing pauses during save/refresh and activation confirmation; finish/discard edits before activation/overview refresh. Current authorization loss clears protected content. No schema/migration/dependency, identity, D21/size/permission/activation/lifecycle/freeze/submission/revision/unlock/history/results/tie/finality/export policy change. [Complete category contract](../wiki/simplification-stage-5.md).

Stage 5 is DONE locally. Source checks PASS (77 fast tests/typechecks/lint/format/builds), full PostgreSQL 297/297 plus final focused category 17/17, full browser 21/21 plus final category 3/3 after blank-order retention correction, source/visual/accessibility review and exact preservation/cleanup/handoff complete. These are local checks; no hosted Stage 4–5 validation or publication.

## Simplification Stage 4 — implementation within approved scope, 2026-10-18

- The new chat explicitly starts Stage 4, including automatic T/V groups; local implementation/validation/review/docs/cleanup only. No inherited Stage 1–3 release authorization to commit/push/deploy Stage 4.
- Inspection confirms one group/code/event, stable membership/group UUIDs, existing default group names, sticky event-first freeze and name-only corrections after freeze. Automatic creation therefore fills only missing groups inside an explicit successful unfrozen table-save transaction, including an explicitly saved empty table. Reads/event creation/preview/cancellation create nothing; frozen incomplete historical rosters remain incomplete. Existing names/IDs are never overwritten. This is an implementation choice within the approved automatic-group scope, not a new voting/identity policy.
- Juror rows use explicit T/V codes mapped to same-event stored group IDs. Names never match identities; stable client membership UUIDs support exact no-write retries. No credentials/sessions are generated. Fingerprints include groups/precise juror timestamps/freeze state, excluding access metadata; current authorization/event locks still govern every request.
- Keep Stage 3 whole-row explicit comparison with juror-specific safeguards: edited externally removed saved memberships cannot be recreated, and a concurrent freeze blocks applying illegal local additions/assignments. Untouched current rows/removals are adopted only through explicit review. Membership removal remains a separate confirmation and RESTRICT-bound legacy action; table omission never deletes. Existing access/group controls require finishing table edits first.
- No migration/dependency, ballot/history/session/access/voting/D21/results/tie-rule change. Categories, combined setup, bulk copy/duplication and new readiness remain outside Stage 4. [Full contract](../wiki/simplification-stage-4.md).

Stage 4 VERIFIED locally: 73 fast tests/typechecks/lint/format/builds, 280/280 PostgreSQL, final fixed-build browser 18/18 without retries, source/visual/keyboard/Axe review, schema no drift, exact development preservation, owned-resource cleanup and all documentation/handoff complete. Auxiliary access/removal/group-name panels pause table editing; current dirty-state tracking prevents delayed refreshes from discarding edits. No publication or subsequent stage.

Updated 2026-10-18. Explicitly distinguish confirmed instructions from proposals.

Current Stage 1 supersedes the historical 12-hour **juror** session and one-time-only link-display decisions below; administration expiry remains 12 hours. [Current access/transition/key contract](../wiki/simplification-stage-1.md). Historical Phase 13 commit/push/deployment authorization does not apply to this local-only session.

| ID  | Status                                   | Problem / options                                         | Decision or proposal                                                                                                                          | Reason and consequences                                                                                                                                                 |
| --- | ---------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | CONFIRMED — brief                        | Implement everything together or one phase per session?   | One phase per session, with validation, review, documentation, and explicit new-session continuation.                                         | Preserves scope and continuity; do not advance beyond the phase the user authorizes.                                                                                    |
| D02 | CONFIRMED — user message                 | Strictly reproduce the preview or allow improvements?     | Use the supplied Lovable preview as design guidance; thoughtful innovation is allowed.                                                        | Written product and accessibility requirements still govern behavior.                                                                                                   |
| D03 | CONFIRMED — brief                        | How should separate sessions recover context?             | Repository-local wiki plus plan, progress, decisions, and next-session documents.                                                             | No existing wiki or repository files were present. Root README and AGENTS point sessions to the persistent sources.                                                     |
| D04 | REQUESTED STACK                          | Monolith or distributed services?                         | React/TypeScript/Vite/Tailwind/shadcn frontend; Node/Fastify backend; PostgreSQL; lean modular monolith.                                      | Matches the user's default stack. No existing technology constrains adoption.                                                                                           |
| D05 | APPROVED — user continuation, 2026-10-16 | Which SQL/validation/workspace tools?                     | Drizzle ORM, Zod, npm workspaces, shared contracts and pure voting-domain package.                                                            | Explicit SQL access, portable schemas, and small shared domain logic. Architecture baseline approved; open product choices remain separate.                             |
| D06 | CONFIRMED — Phase 2 user decisions       | Session and authorization design?                         | Same-origin PostgreSQL sessions, protected cookies and 12-hour absolute expiry; shared admin/guarantor password and event/juror secret links. | Later password-only user instruction supersedes email accounts. Juror entry/link lifecycle remains later-phase work; voting access still requires allowed-group checks. |
| D07 | CONFIRMED — brief                        | May the engine infer D21 methodology or tie rules?        | No: obtain explicit decisions before affected implementation.                                                                                 | Preview examples cannot establish the voting standard.                                                                                                                  |
| D08 | OBSERVED                                 | Does the workspace contain implementation or Git history? | The folder was empty and not a Git repository on initial inspection.                                                                          | No application checks, branch, remote wiki, or prior implementation could be verified. No Git initialization or commit performed in Phase 0.                            |

Full proposed design: [architecture](../wiki/architecture.md). Unresolved choices and implementation gates: [open decisions](../wiki/open-decisions.md).

## Phase 1 decisions (historical)

- User continuation authorizes Phase 1 only. Phase 0 is DONE.
- Keep the specified minimal VotingItem model. Shared event-level Team identity remains Q09, to be resolved before Phase 4; a later additive migration can introduce it. No team CRUD or deletion behavior is implemented.
- D21 configuration columns are nullable in drafts, with basic nonnegative/disabled-negative constraints only. No formulas or activation policy are inferred.
- Per-voting ballots support either future submit workflow. No wizard-wide state or submission endpoint is added while Q04 remains open.
- Users contain identity-independent display information only. Credential and session tables wait for Q03 in Phase 2.
- Foreign keys use RESTRICT as a conservative database baseline. No destructive product endpoint or retention policy is established.
- Git initialized on main with no commits.

- Root packageManager pins npm 11.6.2 after the host’s npm 11.0.0 peer-resolution crash. esbuild is overridden to patched 0.28.x; generation and builds are verified against this resolution.
- The official shadcn Button was added with the CLI, then its imports were adapted to the existing local cn utility and the focused Radix Slot dependency; unused generated dependencies were removed. Review future generated imports before accepting new dependencies.

## Phase 2 decisions — confirmed 2026-10-16

- SUPERSEDED: the initial email/password choice was replaced in the same session by the user’s “just a password protected login, no email” instruction.
- CONFIRMED final model: one shared administration password for admins and guarantors, distributed by the organizer. No email or individual login accounts; both use the same permissions and shared audit identity.
- The user chose unique organizer-issued secret links per juror and event; names are display labels. Phase 2 prepares backend storage; entry UI and wizard integration remain Phase 5.
- The user approved database-backed sessions, protected same-origin cookies, a 12-hour absolute expiry, logout revoking the current session, and an operator command to revoke all administration sessions.
- Admin and guarantor share administrative permissions as permitted by the brief; no expanded RBAC system.
- Implementation scope: authentication only. No event CRUD, wizard, D21, or commit.

- Operator commands set/replace the shared password and revoke sessions. Password replacement revokes all administration sessions in the same transaction. No default password is seeded.
- Native scrypt with the OWASP baseline, hashed random session secrets, strict same-origin cookie/origin protection, bounded hashing and per-process login throttling implement the approved access model.
- Juror secret issuance/redemption and link lifetime are deferred until the relevant roster/entry work; Phase 2 provides storage and an event-scoped lookup only.
- Auth implementation and operator details: [authentication](../wiki/authentication.md).

## Phase 2 routing follow-up — confirmed 2026-10-16

- The user requested the juror page as the default and administration behind a specific URL. Chosen URL: `/admin/login`; no admin link appears on the juror landing.
- `/` provides personal-link instructions without inventing a juror identity form, event status or link-redemption workflow. Functional juror entry remains Phase 5.
- Exact path routing replaces the previous catch-all admin screen. Other paths show not-found content; API authentication remains unchanged.

## Phase 3 decisions — confirmed 2026-10-16

- User explicitly authorized Phase 3 only, with no commit or Phase 4 implementation.
- Q05 (roster portion): freeze event membership and T/V assignments once voting starts or any ballot exists. Allow display-name corrections. Other voting lifecycle/configuration portions remain unresolved for Phase 4.
- Q10 (size portion): allow incomplete setup; equal groups of 5, 7 or 9 must be enforced on voting activation in Phase 4. Attention thresholds remain unresolved.
- No event or jury-group deletion/archive in Phase 3. Juror event membership may be removed before the roster freezes. Existing RESTRICT references remain protected; no history cascade is approved.
- Git now has initial commit `0dafa82` and was clean at inspection, superseding earlier no-history observations.

## Phase 3 validation continuation — 2026-10-16

- User requested completion of the pending Phase 3 tests. PostgreSQL was available again at inspection; no data reset or shared-password replacement was needed.
- No new product rule was introduced. Fixed test-fixture PostgreSQL enum typing, keyboard opener-focus restoration and a narrow-screen event-heading layout defect found by validation.
- Final verification: `npm run check` PASS (13 fast tests, four workspace typechecks, lint, formatting, both builds), `npm run test:db` PASS (42 PostgreSQL tests), migration repeat/no-drift PASS and real-backend browser scenarios PASS. Detailed evidence and limitations are in progress.md.
- Phase 3 is DONE. Phase 4 requires a new user-started session. No commit is authorized or performed.

## Historical Phase 4 initial scope and pending decisions, 2026-10-16

- CONFIRMED: user explicitly starts Phase 4 only; no commit or Phase 5 work. Initial inspection found `main` at `0dafa82` with uncommitted Phase 3 changes, healthy Compose PostgreSQL and no project web/API listeners. Preserve that work and all development configuration.
- IMPLEMENTED UNAFFECTED SLICE: prepare draft selection/final voting names/instructions, event lists, voting details and T/V draft permissions. Existing draft-null D21 fields remain unset; no team model, deadline, deletion/archive, activation or closure behavior is inferred. No migration is needed for this slice.
- TEMPORARY SAFETY GATE, NOT APPROVED Q05: updates accept only drafts with no ballot history; active/closed/archived voting cannot be edited through this draft API. Every update locks the parent event first and rechecks status/ballots inside the transaction. After Q05 is answered, implement the approved descriptive-edit policy explicitly.
- Q02 PENDING: asked for authoritative methodology and worked examples covering plus/minus limits, negative-vote conditions, mandatory usage and selection/elimination. No formula or limits approved.
- Q05 PROPOSAL ONLY: draft → active → closed; freeze rules/items/allowed groups on activation, allow title/instruction corrections, no reopening/archive/deletion in Phase 4. Alternative: make all active configuration immutable, or specify another lifecycle. No answer received yet.
- Q09 PROPOSAL ONLY: shared event teams with voting-specific entries; team-name corrections propagate, entry edits limited to draft, no team/entry removal/archive initially. Alternative: independent voting items, or another explicit history policy. No answer received yet.
- Q07 PROPOSAL ONLY: defer deadlines until timezone/cutoff policy is confirmed. No deadline API or control was added.
- API follows the brief's `/events/:eventId/votings` and `/votings/:votingId` routes. The shared administrator is authorized across events; the collection parent is authoritative and request bodies cannot change event ownership. This is not per-admin tenant isolation.
- User's “please continue” authorizes further Phase 4 work; it does not specify D21 rules or clearly approve the lifecycle/team proposals. Follow-up decision questions remain pending. Continued unaffected draft T/V permission configuration instead.
- `GET, PUT /votings/:votingId/allowed-groups` supplement the brief's baseline routes with an explicit idempotent draft permission resource. Empty draft setup is allowed; duplicate/foreign groups are rejected. Replacement deletes only draft configuration links inside an event-first transaction with no ballot history; no team/history deletion policy is inferred.
- Q02 research reference only: [Institute H21 guidelines](https://www.ih21.org/en/guidelines) and [Decision 21 explanation](https://www.decision21.com/d21-method) describe optional vote usage and at least two plus votes before a minus vote. They have been suggested as authoritative references; no rule, formula, rounding convention, worked example or tie policy is approved/implemented from this research.

## Historical Phase 4 user decisions — earlier continuation

- CONFIRMED: “D21: take it from the guidelines” chooses the H21 guideline page as authority. The written finite-candidate threshold and single-winner small-count example disagree, and integer rounding is unexplained in accessible text; a narrow clarification is pending before implementing those affected rules. Formula/table images could not be accessed because browser security blocked their CDN; do not bypass this block.
- CONFIRMED: “Lifecycle: reopening is fine” permits reopening. Asked whether this resumes the same voting with ballots/frozen configuration/roster preserved and readiness rechecked; no reset/deletion policy is authorized.
- CONFIRMED: “Teams: yes” accepts the proposed shared event teams with voting-specific entries, propagated descriptive corrections and draft-only entry editing; no team/entry removal/archive. Legacy items are linked to distinct teams without merging names; same names never establish identity. Existing item snapshots and ballot IDs remain preserved.
- IMPLEMENTED: team list/create/descriptive edit; voting entry list/add/reassign/order edit only in drafts without ballot history. Item reads join the shared team, preserving original item display snapshots. Nullable team references retain legacy/direct-SQL compatibility; new API entries require a team, and future activation must reject unlinked legacy entries. Composite event/team FK and unique voting/team constraint protect linked records.
- IMPLEMENTED: active → closed, with an explicit UI confirmation, event-first transaction and idempotent closed-state retry. No ballots/configuration are reset. Activation/reopening still require the unresolved D21/readiness and reopening details; no such endpoint was added.

## Phase 4 explicit clarification — 2026-10-16

- CONFIRMED: “every 2 positive votes result in 1 negative” means each negative requires two positives actually cast: negatives used ≤ floor(positives used / 2). Thus 0–1 positives permit no negatives, 2–3 permit one, and 4–5 permit two. Unused positive allowance grants no negative entitlement. This supersedes any conflicting generic guideline negative-eligibility interpretation. It does not settle candidate/seat-based positive limits or integer rounding. The interaction engine remains Phase 6.
- CONFIRMED: “reopening should be possible always … Admin can reopen” removes readiness checks from admin reopening. Closed/archived voting resumes as active, with active retries idempotent. Preserve existing ballots, configuration and the sticky roster lock; no reset/deletion is authorized. Drafts must use first activation and its required readiness checks, never reopening. No archive operation is introduced.
- Browser access already works locally. External guideline formula/table images were blocked by browser security; no browser setting change is needed or requested. Source text supplied by the user can resolve the remaining positive-limit/rounding gap.

- IMPLEMENTED/VERIFIED: unconditional admin reopen API/UI with strict guarded action, draft rejection, active idempotence, event-first transaction, preserved ballots/configuration/permissions/items/sticky lock, 61 passing database tests and desktop/mobile/keyboard browser validation. No first-activation endpoint or D21 engine was introduced.

## Phase 4 completion decisions — 2026-10-17

User selected “Approve this setup” for: explicit admin-entered positive/negative limits without automatic H21 formula/rounding; selection specifies the number of teams advancing, with no reversed elimination mode; voting configuration, entries and T/V permissions frozen after first activation. Shared team descriptive corrections remain approved. The confirmed per-two-positives negative eligibility and unconditional admin reopening remain unchanged.

Consequences: store explicit integer limits and number of advancing teams/winners; no inferred formula/default cap. H21 general conditions (more positive votes than winners and total vote allowance below candidate count) and the user’s negative eligibility ceiling govern activation validation. UI requires an explicit negative-vote enable/disable choice. Candidate count comes from actual voting entries; selection places are available slots, and eliminated count is candidate count minus advancing count. Results/ranking/ties and the interaction engine remain later phases. Deadlines/deletion/archive are not introduced.

- IMPLEMENTED/VERIFIED 2026-10-17: explicit configuration API/UI and event-first first activation. General H21 bounds and approved negative ratio validated; no automatic formula. Equal T/V 5/7/9 check, invalid-activation rollback, configuration freeze and idempotence implemented. Final coverage: 87 PostgreSQL tests; actual browser activation/recovery/responsive checks. Phase 4 DONE; Phase 5 not started and no commit made.

## Phase 5 decisions — confirmed 2026-10-17

- User explicitly starts Phase 5 only. Existing Phase 3/4 work remains uncommitted; no commit or Phase 6 authorization.
- Approved organizer workflow: per-juror admin generation, show the secret link once for copying, organizer delivers privately using their own channel; no messaging integration.
- User’s “lets ignore the expiry” amends the recommended reusable-link lifecycle: links have no expiry. Existing 12-hour absolute sessions remain approved. Links can restore access after logout/session expiry and work on multiple devices. Regeneration/revocation invalidates old links and all sessions of the event juror. This interpretation was stated in the session before implementation.
- Approved unavailable-category policy: only authorized non-draft categories; closed/archived remain visible as unavailable steps. Order selection before final, then creation time and ID. Stable voting UUIDs identify steps. Progress represents navigation position, never ballot completion.
- Technical detail: secret goes in the URL fragment, removed from the address bar on entry and retained only in transient component memory for retry. Only hashes persist server-side; names never authenticate. No new storage fields/migration required for the approved no-expiry lifecycle.

- IMPLEMENTED/VERIFIED in Phase 5: protected link lifecycle, welcome/authorized non-draft steps, stable UUID routes and read-only responsive navigation. Existing storage suffices; applied migrations unchanged. 109 PostgreSQL tests pass. Final check (13 fast tests/typechecks/lint/format/builds), 109 PostgreSQL tests, browser scenarios, migration-hash/no-drift checks, source review and cleanup pass. Phase 5 is DONE; Phase 6 requires a new session. No commit.

## Phase 6 decisions — confirmed 2026-10-17

- User explicitly authorized starting Phase 6 in this new session. Prior uncommitted Phase 3/4/5 changes remain preserved; no commit or Phase 7 work is authorized.
- Asked whether removing/replacing a positive vote should be blocked when it leaves too many negatives. User selected **keep the edit and show an invalid state until corrected**. The engine never removes other votes automatically. Actual-cast negative eligibility is reported as a validation error; adding a positive or removing a negative repairs it. Controls block increases beyond stored maxima and disable forbidden negatives. Sign replacement is atomic and cannot create simultaneous signs on one item.
- Technical boundary: `POST /wizard/steps/:stepId/validate` accepts only `{entries:[{votingItemId,voteValue}]}` and reports `{valid,issues,plusUsed,minusUsed,plusRemaining,minusRemaining,minusEntitlement}`. A structurally valid validation request returns 200 even when `valid:false`; it is a read-only report, never acceptance/storage/submission. Malformed inputs and authorization errors retain existing 400/401/403/404 behavior.
- The server uses current database configuration, category items, session/event and current group under a shared event lock, rechecking session expiry/revocation after waits. Closed/archived or incomplete/misconfigured categories fail validation; invisible categories retain identical 404 responses. Future writes must repeat these checks inside their own transaction; a prior successful validation grants no authority.
- Local component memory only: navigation/refresh/logout/expiry discards selection; no browser storage, ballot rows, wizard progress or submission state. Returning to a visible tab rechecks authorization while retaining same-category local state when access still succeeds. UI states plainly that checking does not save or submit votes.
- Reuse existing semantic tokens and shadcn Button. Selected votes have sign, pressed state, thicker border and checkmark; color is supplementary. Mobile table becomes a semantic grid without horizontal scrolling. No new external dependency or migration.

- IMPLEMENTED/VERIFIED Phase 6: final check PASS (41 fast tests/typechecks/lint/format/builds), PostgreSQL 122/122 PASS, real-backend desktop/mobile/keyboard/error/security checks PASS, migration hash/no-drift checks PASS and source review/cleanup complete. Phase 6 DONE; stop before Phase 7. No commit.

## Phase 7 decisions — confirmed 2026-10-17

- User chooses independent category submission: a juror may submit only some categories and return later. This supersedes the proposed atomic all-category final submission. Phase 7 implements drafts only; per-category submit/locking belongs to Phase 8. Remaining final-review behavior is Phase 9.
- User approves preserving/displaying closed-category drafts and disabling saves/submission until administrator reopening. Other categories remain independent. Archived categories use the same unavailable policy.
- User requires multiple tabs not to collide. Implement optimistic expected-revision checks inside the event-first write transaction, reject stale writes and retain local changes for explicit comparison/recovery. No silent overwrite or automatic merge.
- Technical scope: explicit save, full replacement of one category draft, revision null for no ballot and integer for an existing ballot, revision increment per successful save. Empty saved selection remains a valid in-progress draft under approved optional vote usage; absence is not_started. Structurally invalid/foreign/duplicate entries are rejected; D21-invalid but structurally sound selections can persist as invalid_draft. No save is submission. Submitted/cancelled records are read-only. No Q08 unlock behavior is inferred.

- IMPLEMENTED/VERIFIED Phase 7: explicit save and restoration, expected-revision conflicts, comparison and retry, current server authorization/rules, invalid/empty saved drafts and separate saved progress. Closed drafts remain readable; availability refresh after reopening retains edits. Submitted/cancelled records are read-only. No migration, external dependency or submission endpoint. Final validation: 41 fast tests, 140 PostgreSQL tests and real-backend browser checks; detailed evidence/limitations in progress.md. Phase 7 DONE, stop before Phase 8. No commit.

## Phase 8 decisions — confirmed 2026-10-17

- User authorizes administrator-only unlocking for the juror; nobody else can unlock. User then explicitly approves: retained choices become an editable draft, original submission and unlock action remain in history, and juror can resubmit a replacement. Closed categories require reopening before edits/resubmission. Existing shared administration/guarantor identity and permissions apply; no individually attributed admin identity is invented.
- Phase 8 only; no commit or Phase 9 implementation. Category submission remains independent. Implementation uses expected revisions and atomic validation/storage; retry and unlock revision handling must protect newer work.

- IMPLEMENTED/VERIFIED Phase 8: submit accepts the same strict `{expectedRevision,entries}` shape as saving, and atomically stores the current selection as submitted. The UI requires explicit per-category confirmation, including an empty selection under approved optional vote usage. A prior check/save never authorizes submission.
- Submit increments revision once (absence → 1). An already-submitted ballot returns its existing confirmation only when the requested entries match independent of order and its revision equals `(expectedRevision ?? 0)+1`; no state/history/timestamp changes. This confirmation replay is allowed after closure, with current session/group authorization, because it accepts no new votes. Other attempts conflict. Unlock increments again, so old submit/save/unlock requests cannot modify subsequent work.
- Admin unlock uses a strict expected revision, accepts submitted ballots only, retains entries, clears current submittedAt and changes status to draft. Exact unlock replay is harmless only while the resulting revision/draft and recorded unlock remain current. Later edits/resubmissions cause conflicts. Unlock never reopens voting or clears the sticky roster lock.
- Existing `audit_logs` stores submission snapshots (entries, revision, timestamp and current rules) and admin unlock snapshots, atomically with each operation. This is a deliberate history-storage exception to avoiding vote contents in routine logs; no vote contents enter HTTP logs or the admin listing. No history mutation endpoint exists. Legacy submissions lacking an earlier audit record are captured at unlock without inventing past metadata. Shared admin identity cannot identify an individual person. Only current `ballots.status='submitted'` is current submitted data; history snapshots must never be counted as additional ballots.
- No new migration/dependency. PostgreSQL 167/167 and final source check PASS; real browser confirmation/admin unlock/resubmit/conflict/outage/closure/expiry checks PASS. No automated browser suite/full accessibility/load/deployment audit. Phase 8 DONE; stop before Phase 9, no commit.

## Phase 9 decisions — confirmed 2026-10-17

- User starts Phase 9 from the Phase 8 handoff and explicitly approves selecting saved, valid, open categories on review for independent submission, with a separate result per category. Already-submitted categories remain untouched. Closed, invalid and unselected categories remain for later. Empty saved drafts are labelled and require explicit selection.
- Technical contract: review reads only current authorized saved snapshots/items. Final input carries selected category IDs, saved revisions and reviewed entries; the server rejects absent/changed drafts and revalidates each category within its own event-first transaction. Matching submission retries reuse Phase 8 semantics. Authorization/infrastructure loss may leave an uncertain partial result; refresh/retry must reconcile current state without overwriting newer work.
- Scope is Phase 9 only; preserve all earlier uncommitted work, migrations and development data/credentials. No commit or Phase 10 work.

- VERIFIED 2026-10-18: Phase 9 DONE. Final source check passes (41 fast tests/typechecks/lint/format/builds), PostgreSQL 186/186, real-backend desktop/phone/landscape/keyboard/conflict/outage/authorization checks, migration repeat/no drift/hashes and cleanup pass. No commit or Phase 10 work; full evidence/limitations in progress.md.

## Phase 10 authorization and projection decisions — 2026-10-18

- User explicitly says “yes start phase 10” in a new session, accepting the proposed actual-progress/pending/invalid/locked scope and deferral of time/threshold alerts until Q10 is decided. No Phase 11 or commit authorization.
- Operational projection counts each allowed-group juror/category pair once, with only current eligible submitted ballots contributing to participation. Draft categories show planned setup detail but are excluded from event-wide progress/pending/attention KPIs. History snapshots never count. Distinct pending jurors have at least one unsubmitted non-draft assignment. Zero eligibility never implies completion.
- “Hotovo” is a derived participation label (all expected current submissions and no detected problem), never a lifecycle transition or permanent event completion. “Připraveno” is a draft with no detected projection problem, not permission to bypass activation readiness. Existing cancelled records project locked; no new administrative lock/reset/cancel/delete policy.
- Use the existing D21 engine to distinguish draft quality from availability, and flag inconsistent current submissions/ineligible records without silently repairing or reclassifying their stored state. Return only identities/progress/timestamps/counts, never vote choices or history contents.
- Shared event-lock reads with post-wait admin-session expiry/revocation recheck preserve consistency with existing exclusive event-first writes. Explicit refresh and visible snapshot timestamps suffice; no polling/realtime infrastructure. No migration/dependency. Full semantics: [operational dashboard](../wiki/operational-dashboard.md).

- VERIFIED: Phase 10 DONE. Final source check PASS (41 fast tests/typechecks/lint/format/builds), PostgreSQL 200/200, real-browser desktop/phone/landscape/keyboard/outage/expiry and current-count checks, migration repeat/no drift/hashes, source review and cleanup complete. Development public-table digest unchanged. No Phase 11 work or commit.

## Phase 11 Q06 — confirmed 2026-10-18

- User approves score = positive votes minus negative votes, highest first, equal scores sharing rank. Competition rank counts teams above plus one (1, 2, 2, 4); display order/UUID may order equal-score rows but never decides selection.
- A tied score group that crosses the available places is unresolved in its entirety. Only teams wholly above it are selected; organizers resolve ties outside this app. No extra winners or invented tie-break/runoff.
- User selects the proposed final-results rule: closed/archived, every eligible juror submitted, no data problems and no unresolved cutoff tie. Zero eligibility is not completion. Reopening/unlock can return results to provisional.
- Implement Phase 11 only; no Phase 12/13 or commit. Current eligible submitted ballots/entries are the count source; audit snapshots and drafts never contribute. Existing inconsistent stored submissions are flagged, without inventing a repair policy.

- VERIFIED: Phase 11 DONE. Final post-review `npm run check` PASS (four typechecks/lint/format, 48 fast tests and both builds), PostgreSQL 216/216, real-backend browser responsive/keyboard/current-count/unlock/replacement/outage/expiry checks, migration repeat/no drift/hashes, source self-review, documentation and owned-resource cleanup complete. Development public-table/config digests unchanged. No Phase 12/13 or commit.

## Phase 12 operational scope — confirmed 2026-10-18

- User: “Deadlines are not needed” and “Alerts are not needed.” Remove these from implementation scope; nullable legacy deadline storage is retained without API/UI/enforcement. Existing factual integrity/problem indicators remain.
- User approves XLSX, then chooses “Results and participation (recommended)”: category results, participation status and export time from the same current data as admin screens. Export metadata/aggregate results and eligible-juror progress only; no individual vote choices, audit snapshots or access/session secrets.
- User chooses “Existing actions are enough (recommended)”: retain/audit close/reopen, submitted-ballot unlock and juror-link regeneration/revocation. First activation is also audited as an existing lifecycle transition. No new intervention semantics.
- Implement Phase 12 only; retain the shared admin/guarantor identity and approved rules/freezes/history. No commit or Phase 13. Hosting/backups remain undecided for Phase 13.

- VERIFIED: Phase 12 DONE within the approved scope. Final source check PASS (52 fast tests/four typechecks/lint/format/builds), PostgreSQL 246/246, real-backend browser keyboard/mobile/download/outage/retry/expiry checks, clean dependency install/audit, migration no-drift/hash checks, source review and cleanup complete. Development data/configuration digests unchanged. No commit or Phase 13.

## Phase 13 hosting and operations — confirmed 2026-10-18

- User requests hosting on a local Linux machine and a live instance for colleague testing, with a preference to consider Story Teller's setup. Read-only inspection found Story Teller uses Vercel + Supabase; it was not modified.
- User explicitly chooses **Render + separate Supabase** while retaining Linux Docker hosting, and accepts no automatic test-data deletion and ownership of hosting accounts/backups/restores. This resolves Q11's target/owner/retention direction; actual account/project/domain/proxy/cost/backup destination and schedule remain deployment setup decisions.
- One persistent Node application serves the built frontend and `/api` under the same origin; the same Docker image supports Linux and Render. Default development Vite behavior remains. No serverless adapter or change to shared identity/D21/submission/results/audit is introduced.
- Use Node 22/npm 11.6.2 build/runtime stages and compiled migration/operator entry points. Bundle workspace TypeScript, retain immutable SQL, run as a non-root user, gate Compose app startup on successful migrations, retain volumes on normal shutdown. Ignore nested environment files and database dumps in build/Git contexts.
- Origin/cookies/link construction continue using explicit `APP_ORIGIN`. Proxy trust defaults off and accepts only explicit validated IPs/CIDRs; do not infer Render proxy ranges. Actual proxy/client throttling requires live verification. A separate optional migration connection supports provider direct connections without changing the runtime connection.
- Supabase is PostgreSQL only. Disable Data API/GraphQL exposure before migrations and verify anonymous/publishable keys cannot bypass Fastify's authorization. Existing application tables have no Supabase RLS policy; do not assume new-project defaults prove isolation. No real Supabase project has been changed.
- Render configuration disables automatic deployments; its paid-plan selection is a reviewable proposal, not authorization to incur charges. No commit, push, account-resource creation or live publication is authorized merely by preparing it. Obtain final approval after the tested package and exact account/cost details are concrete.
- Playwright/axe are dev-only; explicit result screenshots use disposable data. Credentials/link fragments are excluded from traces/videos/automatic screenshots. Tests create/drop only generated local databases and stop only their own app processes.

## Phase 13 unpaid-testing amendment — confirmed 2026-10-18

- User clarifies testing must be unpaid and is only a minor colleague test before the future local Linux server exists. This supersedes the earlier proposed paid Render plan; no paid resources, add-ons or upgrades are authorized.
- Keep the already approved Render + separate Supabase topology, with both on Free plans and confirmed available quotas. Render's free sleep/cold-start and Supabase's free inactivity pause are documented. An account with payment-backed overages requires a verified no-charge configuration before provisioning; otherwise use no payment method and accept suspension at free limits.
- `render.yaml` now uses `plan: free`. Because free services have no paid pre-deploy hook or interactive shell, startup runs the existing compiled migrations before starting the server; the existing hidden-password operator runs locally in the same image using an explicit ignored env file for only the hosted test database. No new authentication mechanism or password-in-environment shortcut.
- Current provider documentation was checked. Only Blueprint/docs changed; full application/browser tests were not rerun for this adjustment, and the earlier passing results remain historical. Managed free-host cold starts, TLS/proxy/database connectivity and live flows remain untested until accounts are connected and deployment is authorized.

## Phase 13 explicit cloud and Git authorization — 2026-10-18

- User confirms Supabase “SmejkalJakub's Org” and Render “Jakub's workspace”, with no changes to other projects. User explicitly authorizes multiple short Conventional Commits and pushing this repository; no co-author trailers. This supersedes earlier no-commit/publication gates for the unpaid test package only.
- Free billing verified: Supabase quote $0/month; Render Hobby has no card and unused quotas. No billing changes or paid resources/upgrades.
- New separate Supabase ref `ieqmrqctivjiljzyyucn` uses a dedicated backend login, disabled Data API/GraphQL, restricted default grants, verified-TLS session pooling and the unchanged compiled Drizzle migrator. Database CREATE permission is required even when Drizzle's schema already exists; no role/create-database/superuser privilege is granted.
- Public dashboard-linked Supabase CA is included in the image and enabled only by explicit `NODE_EXTRA_CA_CERTS`; URLs require `sslmode=verify-full`. Private connection stays in ignored mode-0600 `deploy/.env.test`; no existing project credentials are reused. Render direct-service settings must match `render.yaml`; direct creation is not automatic Blueprint synchronization.

## Phase 13 deployment corrections — 2026-10-18

- Direct MCP creation provisioned only the new free Render service, with manual deploys. The first build passed; inline Docker command quoting failed at startup. Use an executable startup script, with migration failure stopping startup and exec preserving signals.
- Provider advisor exposed a mutable lookup path on the existing invoker roster trigger. Fix portably with additive Drizzle migration 0004, preserving applied SQL 0000–0003. Pin `public, pg_temp`; do not grant definer privileges or change voting/roster behavior. Hosted security advisor is clear after applying it.

## Phase 13 live deployment and credential handoff — 2026-10-18

- Only the new Free/Frankfurt Render service is live, manual deploys, exact app source `901c63b`, readiness `/api/ready`, explicit provider HTTPS origin. Original projects/billing are unchanged. No automatic Blueprint synchronization.
- User chooses the shared admin password privately through the existing operator, using only the ignored test env file. No default password, password in chat or reused development credential. Authenticated live verification waits for this input.
- Initial hosted-app backup is retained privately on the owner's Mac and verified by an isolated local restore with exact 15-table equality. It predates admin/event/voting data. Owner manually backs up before/after test sessions and before deployment; no automatic deletion, paid backup service or managed-provider restore claim.
- Proxy trust stays disabled until authoritative inbound configuration is verified. Shared login throttling is a documented pilot limitation; do not claim independent clients are distinguished. Phase 13 remains in progress despite successful free publication.

## Phase 13 final authorization, recovery and completion — 2026-10-18

- User supplies the already configured shared password and authorizes all remaining testing. Use it only for the new test application; do not reset credentials, expose it in files/arguments/logs or globally revoke the user's sessions. The existing user event remains untouched; live scenarios create labelled test events only.
- Conservative proxy trust remains disabled. Real multi-client login/T/V redemption succeeds; changing spoofed forwarding headers does not avoid the 20/minute redemption limiter. Source-network isolation is not claimed. Keep the shared peer-IP throttle as a documented limitation for the approved minor test, rather than inventing ingress CIDRs or weakening security.
- Controlled database-access interruption and restoration, manual test-service redeployment, existing-session/data/XLSX recovery and populated hosted-data recovery into an isolated Linux app are verified. Do not infer managed-Supabase disaster recovery or load/multi-instance guarantees.
- Retain three closed labelled test events/results under the approved no-deletion policy; revoke their generated links. Keep private owner backups, including the populated final dump; no automatic schedule/deletion or paid service. Earlier operational-probe session hashes expire under the existing 12-hour policy; avoid global logout.
- Phase 13 is DONE within the approved free colleague-test and portable Linux package scope. Phases 0–13 are complete. Future physical Linux server provisioning needs the actual machine/origin and a user request; no new implementation phase starts automatically. No product-rule or application-source change was required for final live testing.

## Simplification Stage 1 — confirmed 2026-10-18

- The user explicitly authorizes Stage 1 of a new simplification programme after completed Phases 0–13. This session is local only: no commit, push, deployment, live data/cloud change, charge or other-project modification. Earlier Phase 13 publication authorization is historical and does not apply. Stop before subsequent stages; the user must start a new session.
- The user removes the prior 12-hour juror session limit. New juror sessions use null expiry and browser-session cookies without Max-Age/Expires; no arbitrary replacement timeout. Administration keeps its 12-hour absolute database/cookie/UI expiry. Logout, same-event/current-membership authorization, transaction-time rechecks, voting closure and organizer revocation/replacement remain authoritative. Browser retention is not guaranteed; personal-link re-entry remains usable.
- Migration 0005 upgrades only unrevoked juror sessions still valid at migration time. Expired/revoked sessions retain their dates/state and cannot revive; admin expiry and all ballots/history remain intact. Existing browser cookies can still expire on their old schedule until fresh personal-link redemption. Applied migrations 0000–0004 remain immutable.
- Direct roster Copy retrieves the same active secret read-only, with accessible feedback and a selected fallback on clipboard failure. Generation, confirmed replacement and confirmed revocation remain distinct. No copy creates a credential, audit record or session change. Roster access metadata identifies absent/legacy/stored links without exposing secrets.
- Technical security design: AES-256-GCM ciphertext beside the existing SHA-256 authentication hash; independent random nonces, authentication tag, version/key ID, and AAD bound to normalized event/juror UUIDs and token hash. External process-environment key ring supports retained old keys and new active-key rotation. No automatic key creation/rotation or stored key in database/repository. Missing keys block issuance/copy safely but not hash-based entry, existing sessions or revocation; failed replacement rolls back. Private key backups must accompany database recovery separately.
- Legacy hash-only links continue working and cannot be reconstructed. An explicit consequential replacement is necessary to enable future copying. No silent migration or copy-time regeneration. Dedicated protected POST copy endpoint inherits origin/header/no-store guards and rechecks current admin authorization after lock waits/before completion. Keys, plaintext and ciphertext stay out of routine logs/audit/unrelated responses. [Full contract/setup/transition](../wiki/simplification-stage-1.md).
- Preserve approved D21 limits/negative eligibility/optional usage, group-size readiness, roster/configuration freezes, submission/revision/unlock/history/current-only results/ties. Later workspace/table/bulk/category changes are approved direction, not implemented in Stage 1. Exact next-stage scope belongs to its new user-started session.

- VERIFIED: Stage 1 DONE locally. Final source check 60 fast tests/typechecks/lint/format/builds, PostgreSQL 252/252 (two workers, unchanged timeouts), browser 9/9 desktop/phone/landscape with actual restart/clipboard/fallback/keyboard/axe and existing voting workflows, no drift/immutable SQL, preservation/cleanup, review/docs/handoff PASS. Earlier failures/fixes and unrun limits remain explicit in progress.md. No subsequent stage or publication.

## Simplification Stage 2 — confirmed 2026-10-18

- User explicitly begins Stage 2: reorganize administration into a compact event workspace with Preparation, Voting progress and Results; preserve Stage 1 and existing voting rules. Local validation, review, documentation and handoff only. No commit/push/deploy/cloud/live data operation or later stage.
- Implementation choice within that scope: reuse existing event/dashboard/results URLs; page links retain event context, category details highlight the corresponding section, and preparation query links select Porotci/Týmy/Kategorie. Default/unknown setup is jurors. Existing forms, saves and consequential confirmations remain unchanged; event metadata is disclosed below the selected preparation view.
- One compact application header retains Eventy/logout and a keyboard skip link. A shared heading/navigation component replaces duplicate global section labels; existing tokens, wrapping links and 44px targets remain. No new backend, contract, migration, dependency, ranking or domain logic.
- Editable tables, batch/spreadsheet input, automatic T/V groups, combined category setup, bulk assignment/copy/duplication and new readiness tooling are later direction, outside this navigation stage. They require a new user-started session; do not infer product rules from the new layout.
- VERIFIED: source checks 60 fast tests/typechecks/lint/format/builds, PostgreSQL 252/252, full local browser 12/12 desktop/phone/landscape, no drift, exact development data/configuration/migration fingerprints unchanged and zero generated databases. Review/visual checks and handoff complete. [Workspace guide](../wiki/simplification-stage-2.md).

## Simplification Stage 3 — confirmed 2026-10-18

- User's “yes” approves the presented Teams-only scope: editable names/descriptions and new rows; spreadsheet paste preview; one atomic save (any error saves nothing) with retained row/field errors; stale-edit rejection for explicit review/reload; safe retries without duplicate additions. Duplicate names retain distinct IDs; no deletion.
- Jurors, categories, automatic T/V creation, assignment/copy/duplication and readiness tools remain outside this stage. Preserve Stage 1 access/key/legacy contract, Stage 2 workspace and all voting/audit rules. Work remains local with no commit/push/deploy/live/cloud/credential/charge/other-project operation.
- Acceptance: atomicity and rollback, authenticated same-event access and post-lock checks, stale/concurrent updates, duplicate-name identity, response-loss retries, retained inputs/inline errors/preview, keyboard/phone layouts, source/domain regressions, review, accurate documentation, cleanup and handoff. Stage 3 is not complete until these checks actually pass.

- Implemented within that approval: full-table snapshot fingerprint with precise PostgreSQL timestamps; stable client UUIDs for new teams; exact desired-state read-only replay, otherwise matching base version required. Omission cannot delete. Review/rebase keeps locally changed whole rows and adopts untouched/current/new remote rows only after an explicit comparison action. Existing 64 KiB request limit remains; oversized requests save nothing. No migration, persistent operation receipts, new dependencies or per-name identity behavior.

- VERIFIED: Stage 3 DONE locally after source checks (68 fast tests/typechecks/lint/format/builds), 265/265 PostgreSQL, final fixed-build desktop/phone/landscape browser 15/15 without retries, source/visual/keyboard/Axe review, no schema drift, exact development data/configuration/SQL preservation, earlier source preservation, cleanup and documentation/handoff. Earlier fixture/harness failures and limits remain recorded in progress.md. No subsequent stage or publication.

## Stages 1–3 deployment — authorized 2026-10-18

- User requests deploying the completed package, then the next stage, and explicitly approves committing/pushing tested Stages 1–3 to main. This supersedes earlier local-only/Git/publication restrictions for this release only. Target remains the existing Render Free service and its separate Supabase test database; no paid plan, password reset, other-project changes or later-stage implementation is authorized.
- Take a fresh private hosted backup, retain an external versioned link-encryption key outside the checkout, set only the two missing server key variables, and deploy the reviewed six-migration package. Preserve existing records and credentials; verify readiness, migration transition, current admin access and new workspace/Teams/link behavior. The next implementation stage still needs its new user-started session and precise scope.

- VERIFIED: release `a79338c` / `dep-dbaimoeq1p3s73bqt4sg` is live; external key backup and six-migration transition configured, pre/post private archives validated, original records/sessions preserved, hosted Teams/validation and approved test-link creation/revocation checked. Copy success UI passes; live clipboard text equality is unverified because the connector returned empty. See the release verification in progress.md for exact evidence and limits.

## Simplification Stage 4 — new-chat scope approved 2026-10-18

- User explicitly requests a **new chat** for the Jurors table and **automatic T/V groups** after deployment. Include inline names/T/V assignment, spreadsheet preview, one atomic save with retained errors, conflict checks and safe retries. Preserve existing roster freezes, identities, personal-link controls and voting/history rules. Existing group names/IDs must survive; do not silently overwrite rosters or create credentials.
- Stage 4 implementation, validation, review, documentation and handoff belong to that new session only. This release does not authorize later-stage categories/combined setup/bulk operations, new voting rules or automatic publication of future work. Resolve actual uncovered product questions before implementing affected behavior.
