# Juror entry and voting interactions

Phases 5–8 are DONE as of 2026-10-17; actual validation and limitations are recorded in [progress](../implementation/progress.md). Phase 6 adds verified temporary category interactions and authoritative validation. Phase 7 draft persistence is now implemented; independent category submission and administrator-only unlocking are now implemented in Phase 8; review remains Phase 9. See the Phase 7 section below for current behavior; earlier Phase 5/6 descriptions are historical.

## Organizer workflow and approved lifecycle

In an event’s juror roster, choose **Osobní přístup** for the intended juror. The accessible control includes the juror ID to distinguish duplicate display names. An administrator can generate a link, confirm regeneration or revoke access, including after the roster is locked. These operations never unlock the roster or change voting data.

The generated link is shown once for copying. The organizer delivers it privately through their own channel. There is no email integration or automated delivery. Closing the panel, refreshing or navigating away removes the displayed secret; it cannot be retrieved from the server. If delivery fails or the response is lost, generate a replacement and deliver only the new link.

The user approved reusable links, amending the recommendation to remove link expiry. A link has **no expiry** and supports return after logout/session expiry and multiple devices. Regeneration invalidates all prior links and all sessions of that event juror; revocation does the same without issuing a replacement. Repeated revocation is safe. A previously used link remains usable until revoked or replaced. Recovery from a revoked link requires organizer reissue. This does not establish any voting deadline or submission policy.

Each redemption creates a new 12-hour absolute PostgreSQL session and rotates the browser’s previous session, using the existing protected cookie. Reads never extend session lifetime. Logging out revokes only that session; the reusable link and other devices remain valid. One browser has one current actor/event session; using another juror link replaces that browser’s previous session.

Names are display information only. Event ID in a link is a lookup scope, not authority to select an identity. The backend resolves the secret hash and its stored event/juror references. No browser-supplied juror/group claim is accepted.

## Entry and navigation

- `/` remains the juror entry surface and has no public administration link. Organizer links use `/#event=<event UUID>&key=<random secret>`.
- The secret stays in the URL fragment, which HTTP requests/referrers omit. The page strips it from the address bar on entry, including same-document hash navigation. It retains it only in component memory for retry. Explicit **Pokračovat k přehledu** redeems it; no link-prefetch GET creates a session.
- `/wizard` displays current identity, event, group and authorized category links.
- `/wizard/steps/:stepId` is a directly loadable, refreshable category page. The stable step ID is the voting UUID. Browser URLs restore navigation position; there is no persisted wizard or ballot progress record.
- Categories sort selection before final, then creation time and UUID. Entries sort by configured display order then UUID; corrected shared team descriptions are read through their references.
- Only current group-authorized, non-draft categories appear. Closed and archived categories remain navigable as unavailable steps with explanatory text. Drafts, foreign-event and forbidden categories are absent; direct detail access returns the same 404 for all of them.
- Progress indicates position, not ballot validity/completion/submission. The last step returns to the overview; no review/final-submit screen is implied.

Category pages show instructions, configured limits, teams and previous/next navigation. Phase 6 adds plus/minus controls, sticky used/max/remaining counters and an explicit server check without saving or submitting. Empty, loading, invalid-link, unavailable-category, expired/revoked-session, server-error and retry states are explicit. Navigation focuses the main heading; errors receive focus; native controls retain keyboard semantics and visible focus. Session expiry clears the displayed protected content; returning to a visible tab revalidates it. Revocation is authoritative on each API request, with no push notification while a page remains idle.

## API

All routes are inside the existing cookie/origin/no-store scope. Mutations require `X-D21-Request: 1` and approved origin. Public redemption is limited to 20 attempts per minute per IP/process. The existing administration login limit remains unchanged.

| Route                                                 | Access and response                                                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `GET /events/:eventId/jurors/:jurorId/access`         | Admin only. `{issued: boolean}`; no secret or hash.                                                                              |
| `POST /events/:eventId/jurors/:jurorId/access`        | Admin only, strict `{}`. Atomically revoke prior links/sessions and issue a new link; `{url}` is returned only now.              |
| `POST /events/:eventId/jurors/:jurorId/access/revoke` | Admin only, strict `{}`. Revoke links/sessions, return 204.                                                                      |
| `POST /auth/juror/start`                              | Strict `{eventId,token}`. Return `{session,wizard}` with identity, expiry, event/group and authorized steps; set session cookie. |
| `GET /wizard/current`                                 | Juror session. Current welcome identity/context and `steps`.                                                                     |
| `GET /wizard/steps`                                   | Juror session. Ordered authorized step array.                                                                                    |
| `GET /wizard/steps/:stepId`                           | Juror session. `{current,step,items}` from a consistent event-locked read.                                                       |
| `POST /wizard/steps/:stepId/validate`                 | Strict `{entries:[{votingItemId,voteValue}]}`; authoritative rule report, no persistence.                                        |

Missing/expired/revoked sessions return 401; admin sessions cannot read juror endpoints (403), and juror sessions cannot use admin endpoints (403). Invalid/revoked secrets return generic 401 `INVALID_JUROR_LINK`. Unknown ownership fields and wizard query claims are rejected with 400. Detail authorization is repeated server-side; UI visibility provides no authority. Schema errors/dependency failures fail closed through the existing generic error boundary.

## Storage, locking and later phases

Existing `juror_access` and `sessions` tables suffice: no Phase 5 schema change or migration. Only random-secret hashes are stored; records/history remain retained with existing RESTRICT/composite references. Issuance, revocation and redemption lock the parent event first, serializing with each other and roster operations. Wizard reads hold a shared event lock, recheck the session after waiting and derive the current group from the database. Session expiry uses statement time so a session expiring while waiting cannot pass against an old transaction timestamp. Auth reads inside these transactions reuse their connection to avoid pool exhaustion.

Migrations 0000–0003 remain unchanged. Phase 6 retains these authorization/lifecycle boundaries. No ballot writes, results, dashboard, tie-breaking, automatic cap formulas, deadline or destructive deletion behavior is added.

## Phase 6 interactions and validation

Same-sign click removes a vote; opposite sign replaces it atomically. Stored maxima and negative disable are enforced in controls. Actual-cast negative eligibility is at most one negative per two positives, also capped by the configured maximum. Unused votes are allowed. The user explicitly chose to retain edits reducing eligibility, show invalidity and allow correction, without auto-removing other votes. The local invalid-state display also explains newly selected negatives without sufficient positives; server validation never marks these valid.

Selection exists only in component memory on the current category page; navigation/refresh/logout/expiry resets it. The screen states that checking does not save or submit. Successful visibility revalidation retains same-category selection. Sign controls expose pressed state, sign/checkmark and semantic colors. Mobile uses the desktop table's semantics in a narrow grid; counters remain sticky and keyboard focus has scroll clearance.

`POST /wizard/steps/:stepId/validate` returns `{valid,issues,plusUsed,minusUsed,plusRemaining,minusRemaining,minusEntitlement}`. A well-formed request returns 200 with `valid:false` for domain-invalid selection: this is a report, never ballot acceptance. Malformed entries/unknown claims return 400, session/origin guards retain 401/403 and concealed categories 404. Current database rules/status/item IDs and current same-event group membership determine the report. A shared event lock spans authorization and validation, with session recheck after waits. No configuration, roster, ballot/entry or progress row changes. Validation success grants no authority to a future write; later persistence/submission must recheck within its own transaction.

Connection/check failure retains local selection and allows retry. A server-detected closure/unready category disables controls. Session/authorization failure clears protected content. Static pages have no push closure/revocation notification. Full validation and remaining limitations are in [progress](../implementation/progress.md).

## Phase 7 persisted drafts — 2026-10-17

The user approved independent per-category submission with later return, superseding the all-category atomic proposal. This phase adds **drafts only**. Explicit **Uložit návrh** saves the current category on the server and never submits it. Refresh, category navigation, logout/re-entry and another authorized device restore the saved choices. Unsaved edits remain in component memory, never local/session storage, and are lost when leaving; native unload protection and a logout confirmation warn about them. Session expiry/authorization failure clears protected content.

The overview derives `not_started` from no saved ballot, `in_progress` from a rule-valid saved draft (including an explicit empty selection), and `invalid_draft` from a structurally sound D21-invalid saved draft. Rule validity and category availability are separate: closure does not erase draft progress. Existing submitted/cancelled records are read-only and display submitted/locked progress; no such state is created by draft saves.

| Route                                    | Contract                                                                                                                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /wizard/steps/:stepId/ballot-draft` | Current owner's saved snapshot, or JSON null when absent.                                                                                                                                             |
| `PUT /wizard/steps/:stepId/ballot-draft` | Strict `{expectedRevision: null \| integer, entries:[{votingItemId:UUID,voteValue:1\|-1}]}`. Full replacement of one category draft. Returns saved snapshot with 200, also for domain-invalid drafts. |

A snapshot has `{status,revision,savedAt,entries,validation,progress}`. Category detail now adds `ballot: snapshot|null`; authorized steps add actual saved `progress`. No browser-supplied ownership, group, limits, validity, timestamp or status is accepted.

`expectedRevision:null` asserts absence; existing saves must match the current stored revision (including legacy zero). First save uses revision 1; each successful subsequent save increments it. Missing/malformed revision or structural values/claims: 400. Duplicate/opposite entries and unknown/foreign/other-category item IDs: 400 `INVALID_DRAFT_ENTRIES`, no change. Stored caps/negative eligibility/disable can make a saved draft invalid, but never submitted. Unready rules: 409 `CONFIGURATION_NOT_READY`; closed/archived: 409 `VOTING_UNAVAILABLE`; submitted/cancelled: 409 `BALLOT_NOT_EDITABLE`; stale/future revision: 409 `DRAFT_CONFLICT`; exhausted integer revision: 409 `REVISION_EXHAUSTED`. Existing 401/403/concealed 404 and origin/header/no-store protections apply to both resources.

Every save holds the exclusive parent-event lock, rechecks current session/statement-time expiry and current same-event group/category/items/rules, then locks the owner's ballot. Revision check, creation/update, entry replacement and response projection share that transaction. Failure rolls all changes back. Existing unique/composite/RESTRICT constraints and sticky roster locks remain intact; no migration is needed. The validation-only POST remains read-only and never grants later write authority.

Cross-tab/device writes with the same base revision allow one winner; stale writers cannot overwrite it. The UI keeps local choices, fetches the latest snapshot and shows both versions. Jurors explicitly choose the saved version (discarding local edits) or retain local choices against the compared revision and press Save again. A further intervening save conflicts again. No automatic merge. A lost response may mean a successful save; retrying the old revision safely conflicts, and comparison can recover the already-saved version without duplication. Visibility revalidation never replaces local edits or advances their base revision silently.

Failures retain local selections and allow retry. Recoverable visibility-refresh failure keeps the editor mounted. Availability refresh after administrator reopening retains local choices and uses current authorization; it is separate from reloading the page. Save/check feedback is announced and explicit feedback receives focus; conflict actions fit phone screens. Scope excludes final submission/locking, review, dashboard/results, deadlines and unlocking.

## Phase 8 submission and locking — 2026-10-17

Category submission now validates/stores the current selection atomically with expected revision, timestamp and submission history. Matching retries cannot duplicate writes. Submitted choices are read-only and show actual submitted progress; unfinished categories remain available for later return. Only shared administration can unlock for juror correction/resubmission, preserving original choices/history. Closed/archived categories remain unavailable until separate reopening. Same-page refresh detects unlocked revisions for explicit comparison/load. Details: [submission and administrator unlocking](ballot-submission.md).

The wizard-wide review/final action remains Phase 9; no final-submit/review endpoints were introduced. Earlier Phase 5–7 no-submit descriptions above are historical.

## Phase 9 review and final action — 2026-10-17

Overview/category links and the last step now lead to `/wizard/review`, showing saved positive/negative choices, current validity/availability and safe return to the editor. Explicitly select saved valid open categories (including labelled empty drafts), then confirm their named counts. Categories commit independently with separate results, keeping already-submitted and remaining categories intact. `/wizard/confirmation` restores current submitted/remaining states after reload/later return. Revalidation requires explicit loading of changed reviewed versions and clears withdrawn protected categories immediately. Full [contract, retries and partial-failure recovery](multi-category-review.md). Earlier no-review statements above are historical.
