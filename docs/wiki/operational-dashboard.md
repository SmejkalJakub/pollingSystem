# Operational dashboard

Phase 10 implements a read-only dashboard for the existing shared administration/guarantor identity. Validation evidence and current completion status are in [progress](../implementation/progress.md).

## Screens and refresh

Open an event in administration and choose **Průběh hlasování**. `/admin/events/:eventId/dashboard` shows the selected event, current submitted/expected ballots, completed categories, distinct pending jurors, categories requiring review, category cards and searchable juror details. `/admin/dashboard/votings/:votingId` shows eligible jurors, saved/submitted timestamps, T/V progress and factual problems, with links back to the dashboard and existing category administration/unlock controls. Direct URLs and refresh work through existing session recovery.

A saved snapshot timestamp and explicit **Obnovit data** describe freshness. There is no background polling, push synchronization or simulated live indicator. Pending refresh retains the previous timestamp/data until the response arrives; a failed refresh clears displayed data and offers a focused retry. Successful explicit refresh restores button focus; successful error recovery focuses the heading. Expiry/authorization loss removes protected data. Search and native expandable juror rows work with the keyboard; color supplements text labels. There is no results/ranking screen in this phase.

## Counting rules

- A category's expected count is the number of current event jurors in its configured allowed same-event T/V groups. Each juror/category pair counts once. A both-group category adds the two disjoint memberships. Names never establish identity; UUIDs distinguish duplicates.
- Submitted counts use only eligible **current** ballots with `status='submitted'`. Explicit empty submissions count once. Drafts, invalid drafts, cancelled ballots and historical audit snapshots do not count. Unlock immediately removes the current submission from progress; later resubmission restores exactly one current submission.
- Pending is expected minus submitted. Event-wide pending jurors is the distinct set with any unsubmitted authorized non-draft category, including unavailable categories. People without an authorized non-draft category are not pending assignments.
- All categories appear for administration. Draft category cards/detail show planned eligibility and setup issues, but drafts contribute nothing to event-wide operational counts, completed categories, pending jurors or attention-category KPI.
- Zero expected ballots never means 100% or completion. The UI shows the zero counts and an explanatory empty state instead of an indeterminate progress bar.
- `done` / **Hotovo** means a non-draft category has at least one eligible juror, all expected current ballots are submitted and no factual problem is detected. It never closes voting or freezes additional state. A draft with no detected problem is `ready` / **Připraveno**; activation still performs its full existing readiness checks, including roster sizes. Any category with a detected problem is `problem`; otherwise non-draft categories are `in_progress`. Stored lifecycle status is shown separately.
- A structurally possible but rule-invalid current submission remains counted as submitted storage state and is flagged `INVALID_SUBMISSION`; it cannot make the category `done`. Ineligible stored ballots are excluded and flagged. No repair, cancellation or deletion policy is inferred.

## Saved progress and factual problems

Juror states match the existing wizard: absence → `not_started`; saved rule-valid draft (including empty) → `in_progress`; rule-invalid draft → `invalid_draft`; current submission → `submitted`; existing cancelled record → `locked`. Submitted records remain locked to juror edits. Category availability is separate: closure does not make a valid saved draft invalid. The existing pure D21 validator derives saved-choice validity with availability removed, using actual category item IDs and stored limits.

The attention section reports only stored-data facts: invalid drafts, existing cancelled/locked ballots, closed/archived categories with pending assignments, missing/invalid rule configuration or candidate counts, unlinked items, zero eligible jurors, ineligible stored ballots and rule-invalid current submissions. Draft setup problems remain on their cards/detail. There are no time-based, low-participation, last-vote or deadline alerts. The Phase 12 user decision excludes deadlines and alerts; Q11 confirms existing interventions and XLSX results/participation export. No messaging integration or automatic organizer action.

## API and integrity

| Route                                    | Response                                                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /dashboard/overview?eventId=<UUID>` | `{event,asOf,categories,totals}`. Categories include allowed groups, counts, per-group counts, state, factual problem codes and eligible juror progress/timestamps. |
| `GET /dashboard/votings/:votingId`       | `{event,asOf,category}` using the same event projection/counting rules.                                                                                             |

Strict shared Zod schemas validate query/route identifiers and output. Missing/duplicate/malformed event IDs, extra query/ownership claims and malformed category IDs return 400. Missing event/category returns 404. Both routes inherit existing cookie/no-store scope and administration guard; anonymous/expired/revoked/fabricated sessions return 401, jurors 403. Shared administrators have the existing cross-event permissions; this is not per-admin tenant isolation.

Reads hold a shared parent-event lock across batched event/group/roster/category/permission/item/current-ballot queries. Administration sessions and statement-time expiry are rechecked after acquiring the lock using the transaction connection. Existing app-owned roster/configuration/lifecycle/ballot writes acquire the exclusive event lock, so one response cannot mix their pre/post-commit states. Category detail intentionally reuses the complete event projection; there are no per-juror query loops. Direct privileged SQL can bypass app policy.

Entries are read internally only to derive validity; no choices, vote counts/signs, rule snapshots, secrets, revisions or audit contents appear in dashboard responses. Read operations create no ballots/history and mutate no state. No new dependency, table or migration; existing 14 tables/four immutable migrations suffice. Phase 11 now reuses this locked metadata projection and independently enforces current eligible submitted-only vote aggregation under the same lock. Approved Q06 rules govern its ranking/tie/finality behavior; see [results](results-ranking.md).

Phase 12 reuses the shared administrative transaction helper, adding an authorization check at the end of reads. [Operational hardening/export](operational-hardening.md).

Stage 2 places event/category progress in the shared event workspace with **Průběh hlasování** active. **Příprava** and **Výsledky** remain directly reachable for the same event; the event name is the page heading and the progress/category title is a section heading. Snapshot/counting/error semantics above are unchanged. [Workspace guide](simplification-stage-2.md).
