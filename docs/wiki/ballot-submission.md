# Category submission and administrator unlocking

Phase 8 is DONE (2026-10-17). Categories are independent: jurors may submit some and finish the remainder later. Saving a draft never submits it. Phase 9 now adds [saved review and selected independent final submission](multi-category-review.md) under the explicitly approved contract.

## Juror workflow

Choose **Odevzdat kategorii**, review the positive/negative counts, and explicitly confirm. Submission validates and stores the current selection atomically; a separate draft save is unnecessary. Empty selections are allowed under the approved optional-vote policy. Invalid selections cannot be submitted. The server independently checks current session, event/group permission, category availability, items and D21 rules.

Successful submission displays a timestamp and read-only choices. It survives refresh, logout/re-entry and device changes. Only an administrator can unlock it. Other categories remain accessible. An old tab retains its local choices and compares against a newer saved/submitted version; it cannot silently overwrite another device.

On a connection failure, retain the selection and retry. A lost response can mean submission succeeded: an identical replay returns its current confirmation without another write. If the ballot changed since then, comparison is required. Session/permission loss clears protected content. There is no background synchronization; every request is authoritative.

## Administrator workflow

In category administration, **Odemčení hlasovacích lístků** lists saved ballot identities/statuses without exposing choices. Select the intended juror (UUID distinguishes duplicate names), then confirm unlocking. Refresh first when the revision changed.

Only the existing shared administration login can unlock. It preserves the original submission and unlock action in history, retains choices as a draft, increments revision, and removes the current submitted timestamp. The juror can then edit and resubmit a replacement. Until resubmission, the current ballot is a draft and must not count as submitted. No administrator edit of vote choices is accepted.

Unlock does not reopen a category. Closed/archived categories preserve readable choices and block juror saves/submission until separate administrator reopening. Unlock never changes configuration, eligibility or the sticky roster lock. Cancelled records remain locked; no reset/delete/cancellation or separate non-submitted admin lock workflow is introduced.

Administration uses a shared identity; history cannot identify an individual administrator. Original submissions are stored internally, with no exposed history editing/deletion endpoint or history browser/export in this phase.

## API and concurrency

| Route                                              | Input / response                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| `POST /wizard/steps/:stepId/submit`                | Strict `{expectedRevision:null                                                    | integer,entries:[{votingItemId:UUID,voteValue:1 | -1}]}`; 200 owner snapshot. |
| `GET /votings/:votingId/ballots`                   | Admin only; array of `{id,jurorId,displayName,status,revision,submittedAt}`.      |
| `POST /votings/:votingId/ballots/:ballotId/unlock` | Admin only, strict `{expectedRevision:integer}`; 200 updated admin ballot record. |

The existing draft/detail snapshot now adds nullable `submittedAt`. Submit uses the same expected-revision boundary as saving: null asserts absence, an integer must match the current draft, and a successful write increments revision once. No browser-supplied identity, status, rules, timestamps or validity is trusted.

A submitted ballot can replay confirmation only when entries match independent of ordering and its current revision equals `(expectedRevision ?? 0)+1`. Nothing changes, including timestamps/history. This no-write replay can confirm an existing submission after closure; it cannot accept new votes. Other submitted attempts return 409 `BALLOT_NOT_EDITABLE`. Stale draft input returns 409 `DRAFT_CONFLICT`. Rule-invalid entries return 409 `INVALID_BALLOT`; unavailable/unready categories return 409 `VOTING_UNAVAILABLE`/`CONFIGURATION_NOT_READY`. Malformed inputs/claims return 400. Existing 401/403/concealed 404 apply.

Unlock increments revision again. Matching replay succeeds only while its exact resulting draft/revision and recorded unlock remain current. A later save/resubmit causes 409 `BALLOT_CONFLICT`; never retry an old unlock against a new submission. Non-submitted records return 409 `BALLOT_NOT_SUBMITTED`; exhausted integer revisions return 409 `REVISION_EXHAUSTED`.

Mutations inherit `X-D21-Request: 1`, same-origin checks and no-store behavior. All writes acquire the exclusive parent-event lock, recheck the session after waiting, then lock the ballot. Submission, draft saves, administrator unlock and voting lifecycle therefore serialize. Reads use shared event locks. Entry/state/timestamp/revision/history failure rolls back the entire operation.

Existing 14 tables/four immutable migrations suffice. `audit_logs` stores submission snapshots (choices/revision/timestamp/rules) and administrator unlock snapshots. Legacy submissions with no earlier audit are captured when unlocked without inventing past metadata. Vote choices are not written into routine HTTP logs or the administration listing. Future results must count only current submitted ballots, never historical snapshots.

Validation and limitations: [implementation progress](../implementation/progress.md).

## Phase 9 selected final action — 2026-10-17

The user approved selecting saved eligible categories on review and submitting them independently. `POST /wizard/final-submit` reuses the submission/history/replay boundary above after checking exact saved revision AND reviewed choices per category. No new empty ballot, silent replacement or implicit resubmission is permitted. Normal conflicts return per-category outcomes; global auth/infrastructure failure can leave earlier commits intact and requires exact retry/current review reconciliation. `/wizard/confirmation` derives current data on refresh. See [review/final contract](multi-category-review.md); opening statements deferring review describe Phase 8 history.
