# Event and jury management

Phase 3 implementation, with Stage 1 access, Stage 2 workspace and Stage 3 Teams updates on 2026-10-18. See [progress](../implementation/progress.md) for actual validation and completion status.

## Approved behavior

- Events have a name (1–200 trimmed characters) and optional description (up to 5,000 trimmed characters).
- Each event can contain one T and one V group. Group codes are immutable; their descriptive names can be corrected.
- Each event juror has a display name (1–200 trimmed characters) and exactly one group belonging to that event. Duplicate names are allowed; UUIDs identify memberships. This is an event-specific roster, without global juror accounts or identity matching by name.
- Incomplete/unequal rosters are allowed during setup. Phase 4 now validates equal T/V groups of 5, 7 or 9 on first activation. Incomplete setup is rejected without freezing it.
- Membership creation, reassignment and removal freeze for the entire event once any voting is active/closed/archived or any ballot exists, including drafts/cancelled ballots. Juror names, group names and event descriptions can still be corrected.
- Removal before the freeze deletes only the selected event membership. Existing foreign-key RESTRICT references (including secret links, sessions, audit or ballots) prevent deletion; no cascade or automatic access-history removal is implemented. The UI requires an explicit confirmation step.
- There are no event or jury-group deletion/archive endpoints or controls. Event membership cannot be transferred by changing `eventId`; add a distinct membership in the other event.

These Q05/Q10 roster decisions and the limited removal policy were explicitly confirmed by the user. They do not approve voting configuration changes, reopening, D21 methodology, submission semantics, deadlines or alert thresholds.

## Administration screens

`/admin/login` remains the direct shared-password login URL. Authenticated administration shows the real event list there and at `/admin/events`. `/admin/events/:eventId` supports direct navigation/refresh and shows event editing, T/V group management and the event roster. Missing or expired sessions show the existing login form. A juror session cannot use administrative APIs.

Stage 2 keeps these URLs and places event administration in **Příprava / Průběh hlasování / Výsledky**. Preparation defaults to **Porotci**; `?setup=teams` and `?setup=categories` open the other focused management views. T/V controls and direct Stage 1 copying stay in Porotci; event metadata/editing is under **Nastavení eventu** below the selected view. [Current workspace guide](simplification-stage-2.md).

`/` remains the juror entry surface with no administration link. Stage 1 adds direct **Kopírovat odkaz** actions and explicit absent/legacy-link labels; [configuration and transition](simplification-stage-1.md). Phase 5 adds per-juror **Osobní přístup** controls for link issuance/revocation and protected wizard navigation; see [juror entry](juror-wizard.md). Voting configuration is Phase 4; results/dashboard remain later work.

The screens use existing Tailwind tokens and shadcn Button/Input controls, labeled native selects/textareas, keyboard focus, pending/empty/error/retry states and preserved form values on failed mutations. Roster lock information comes from the backend; every write rechecks the lock authoritatively.

## API

All routes below run within `registerAuth`'s cookie/origin scope and inherit `adminGuard`. Mutations require `X-D21-Request: 1` and the approved origin. Responses are no-store. Shared strict Zod contracts validate input and output. Unknown fields, empty patches and malformed UUIDs return 400. Missing or wrong-event resources return 404. Unauthenticated/expired/revoked sessions return 401; juror sessions and forbidden origins return 403.

| Route                                         | Request / response                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /events`                                 | Array of event records, newest creation first with stable ID ordering.                                  |
| `POST /events`                                | `{ name, description }`; 201 event record. Does not automatically create groups.                        |
| `GET /events/:eventId`                        | Event record.                                                                                           |
| `PATCH /events/:eventId`                      | At least one of `{ name, description }`; updated event record.                                          |
| `GET /events/:eventId/roster`                 | Consistent `{ groups, jurors, locked }`; roster jurors add `access: none \| legacy \| stored` metadata. |
| `GET /events/:eventId/jury-groups`            | Group array.                                                                                            |
| `POST /events/:eventId/jury-groups`           | `{ code: 'T' \| 'V', name }`; 201 group record.                                                         |
| `PATCH /events/:eventId/jury-groups/:groupId` | `{ name }`; group record.                                                                               |
| `GET /events/:eventId/jurors`                 | Juror array, ordered by display name and ID.                                                            |
| `POST /events/:eventId/jurors`                | `{ displayName, juryGroupId }`; 201 juror record.                                                       |
| `PATCH /events/:eventId/jurors/:jurorId`      | At least one of `{ displayName, juryGroupId }`; juror record.                                           |
| `DELETE /events/:eventId/jurors/:jurorId`     | 204 only for an unreferenced, unfrozen membership.                                                      |

Records expose event IDs and public display/timestamp fields; no passwords, session tokens or juror-access secrets. `ROSTER_LOCKED`, `GROUP_EXISTS` and `MEMBERSHIP_REFERENCED` are 409 conflicts; wrong-event group assignment returns 400 `INVALID_GROUP`.

## Persistence and future integration

Additive migration `0002_low_talon.sql` adds nullable `events.roster_locked_at`, backfills events with voting/ballot history, and installs freeze triggers. Applied `0000` and `0001` are unchanged. Drizzle metadata tracks the column; the reviewed SQL also maintains the triggers, which schema generation does not model.

Membership mutations lock the parent event row before checking the marker and writing. Roster reads hold a shared event lock for a consistent group/juror snapshot. Voting insert/status changes and ballot insert/event changes set the sticky marker under the same event row lock. Reverting a status to draft or deleting ballots does not clear it. Direct database administration can bypass application policies and is outside the HTTP authorization boundary.

Phase 4 must preserve this lock protocol. Activation must lock the parent event first, validate the approved T/V size and remaining configuration requirements in its transaction, then activate. An invalid activation must roll back without freezing setup. Do not rewrite history or clear the marker to reopen membership editing. No voting lifecycle endpoint was added in Phase 3.

Phase 4 first activation now implements the event-first validation protocol above and is covered by real activation/roster concurrency tests. Admin reopening preserves the sticky roster marker without readiness checks and never reopens roster editing.

Stage 3 changes only **Týmy** to an editable table with spreadsheet paste preview and atomic saving. Juror/group forms, access controls and roster freezes above remain unchanged. [Teams guide](simplification-stage-3.md).
