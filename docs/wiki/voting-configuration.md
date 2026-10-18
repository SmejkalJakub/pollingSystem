# Voting configuration — Phase 4 complete

Phase 4 is DONE as of 2026-10-17. Real-backend administration supports voting drafts, selection/final configuration, explicit D21 limits, allowed T/V groups, shared teams/entries, first activation, closure and unconditional admin reopening. See [progress](../implementation/progress.md) for actual validation and limitations.

## Configuration and teams

Event detail manages shared teams and voting categories. `/admin/votings/:votingId` supports direct entry/refresh, draft metadata, explicit rule configuration, T/V permissions and entries.

The user approved explicit administrator-entered limits without automatic formula/rounding. Each voting stores `selectedPlaces`, `maxPlusVotes`, `maxMinusVotes` and `allowNegativeVotes`; no cap defaults are inferred. Selection places are advancing teams/slots; final places are winners. Registered count is the actual entry count and non-advancing count is derived. No reversed elimination mode or results ranking is added.

Places and positive allowance are positive integers; negative allowance is nonnegative. All counts fit PostgreSQL integers. Positive allowance exceeds selected places; negative allowance is at most floor(positive allowance / 2), and must be zero when negatives are disabled. On first activation, places and the combined positive/negative allowance must be below candidate count. The general conditions follow the [approved H21 guideline authority](https://www.ih21.org/en/guidelines); explicit caps and no automatic rounding were approved separately by the user on 2026-10-17.

Each negative requires two positives **actually cast**: negatives used ≤ floor(positives used / 2), also bounded by the stored negative cap and enable flag. Examples: 0–1 positives → zero negatives; 2–3 → one; 4–5 → two. Votes may be left unused. Phase 6 now implements this contract in the pure interaction engine and validation-only server check. Ballot persistence/submission remain later phases.

Names accept 1–200 trimmed characters, descriptions/instructions up to 5,000. A shared team belongs to one event and may appear once in each of several votings. Duplicate names remain distinct identities. Descriptive corrections propagate across categories, including started ones; original item snapshots and ballot references remain preserved. No team/entry removal/archive is exposed.

Drafts without ballot history can edit metadata, explicit rules, same-event T/V permissions (including incomplete setup), entries/team reassignment and nonnegative display order. All writes recheck current state under the event-first transaction. After first activation these voting fields are frozen; shared team descriptive corrections remain allowed.

## Lifecycle

First activation validates complete rules, no draft ballot history, linked entries, sufficient candidates, at least one allowed same-event group and both T/V rosters equal with 5/7/9 jurors each. It locks the parent event then voting and changes status only after validation. Failure rolls back without freezing setup. A repeated request on active voting returns the unchanged record.

Active voting can be closed through explicit confirmation; already-closed retries are idempotent. Draft/archived closure is rejected. Admins may reopen closed/archived voting **without readiness checks**, preserving ballots, configuration and sticky roster lock. Active reopen retries are idempotent; drafts cannot bypass first activation through reopen. Configuration remains frozen. No archive/delete operation is introduced.

Forms retain failed inputs, focus linked validation summaries, restore opener focus after cancel, and show pending/empty/error/retry/success states. Refreshed started status removes draft editors. Server rejection protects stale editors left open in other tabs.

## API

Every route inherits `adminGuard` inside authentication cookie/origin scope. Mutations require `X-D21-Request: 1` and approved origin. Strict contracts reject unknown fields, ownership/status injection and unapproved deadline inputs. Responses are no-store. Child relationships remain event-scoped; shared administrators can manage all events.

| Route                                        | Behavior                                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `GET, POST /events/:eventId/votings`         | List/create `{name,instructions,kind:'selection' \| 'final'}` drafts.                                                            |
| `GET, PATCH /votings/:votingId`              | Read or nonempty partial editable draft metadata. Response includes nullable configuration fields for incomplete/legacy records. |
| `PUT /votings/:votingId/configuration`       | Atomically save all four explicit rule fields, draft/no-history only.                                                            |
| `GET, PUT /votings/:votingId/allowed-groups` | Read/replace draft `{juryGroupIds: UUID[]}` permissions.                                                                         |
| `GET, POST /events/:eventId/teams`           | List/create `{name,description}` shared teams.                                                                                   |
| `PATCH /events/:eventId/teams/:teamId`       | Nonempty descriptive correction within event.                                                                                    |
| `GET, POST /votings/:votingId/items`         | List/add draft `{teamId,displayOrder}` entry.                                                                                    |
| `PATCH /votings/:votingId/items/:itemId`     | Draft partial team/order edit, retaining item ID.                                                                                |
| `POST /votings/:votingId/activate`           | First activation with all readiness checks; active retry idempotent.                                                             |
| `POST /votings/:votingId/close`              | Active → closed; closed retry idempotent.                                                                                        |
| `POST /votings/:votingId/reopen`             | Closed/archived → active without readiness checks; active retry idempotent.                                                      |

Lifecycle actions accept an empty body or strict `{}`. Create returns 201; normal reads/updates/actions return 200. Malformed/unknown inputs return 400, missing resources 404, invalid/missing/expired/revoked sessions 401 and juror/forbidden-origin requests 403. Conflicts return 409 with specific codes: `VOTING_NOT_EDITABLE`, `ITEM_EXISTS`, `INVALID_VOTING_STATUS`, `CONFIGURATION_NOT_READY`, `ITEMS_NOT_READY`, `GROUPS_NOT_READY`, `ROSTER_NOT_READY`.

## Storage and integration

Migration 0003 adds shared `teams`, composite same-event references and unique voting/team identity. Each legacy item gets a distinct team with its original UUID; names never merge identities. Original item snapshots and ballot references are untouched. Nullable `team_id` supports legacy/direct SQL data; new APIs require a team and activation rejects unlinked records.

Existing voting columns store explicit configuration; no extra migration is needed for activation/configuration endpoints. Migrations 0000–0003 are applied and immutable. Composite references/RESTRICT protections remain intact. All voting/roster/configuration writes share the event-first lock protocol and sticky roster trigger. Never clear `roster_locked_at` to reopen setup.

Phase 4 added no ballot API, wizard, dashboard, results/ties, deadline or deletion/archive behavior. Phases 5/6 now add [authorized navigation and temporary voting interactions](juror-wizard.md). These remain in assigned later phases with unresolved product decisions recorded separately.

Phase 8 now provides [independent category submission and administrator-only unlocking](ballot-submission.md). Unlock retains choices/history and returns a draft; it never changes voting status/configuration or roster lock. Closed/archived categories still require separate reopening before juror writes. Review/results remain later phases.
