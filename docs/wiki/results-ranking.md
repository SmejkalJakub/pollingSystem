# Results and ranking

Phase 11 provides read-only internal results for the existing shared administration/guarantor identity. Open an event and choose **Výsledky hlasování**, or choose **Výsledky kategorie** in category administration. Validation status/evidence are recorded in [progress](../implementation/progress.md).

## Approved Q06 rules

Each team's score is its positive count minus its negative count. Sort highest first. Equal scores share competition rank: 1, 2, 2, 4. A team's rank is one plus the number of teams with a higher score. Equal-score rows use configured display order then item UUID solely for stable presentation; neither names, negative count, UUID nor row position breaks a tie.

`selectedPlaces` means advancing teams in selection rounds and winners in final rounds. A tied score group wholly within the available places is selected together. A group crossing the cutoff is **entirely unresolved**: only teams wholly above it are selected. Example: two places, scores 5, 3, 3, 1 → ranks 1, 2, 2, 4; the first team is selected and both teams at 3 are unresolved. Two places, scores 5, 5, 1 → both leaders are selected with rank 1. Organizers resolve boundary ties outside the application. There is no in-app tie-break, extra winner, runoff or manual resolution record.

A category is **final** only when its lifecycle is closed or archived, eligibility is positive, every eligible juror has a current submission, there are no detected factual data problems and no unresolved cutoff tie. Otherwise it is **provisional**, with reasons. Complete participation while active is still provisional; closure alone cannot finalize incomplete or tied results. Unlock/reopening can return a final projection to provisional. This is derived current state, not permanent certification, publication or a saved result snapshot.

Provisional selected rows are explicitly labelled provisional. Only final selected rows say **Vítěz** / **Postupuje**. All equal-score groups have a textual shared-rank marker, including ties away from the cutoff. No positive-score minimum, mandatory vote usage or new D21 limit is inferred. An unready configuration has no evaluated selection cutoff.

## Count source and integrity

- Aggregate only current `ballots.status='submitted'` entries from currently eligible same-event allowed-group jurors. Each juror/category pair counts once. Group membership, not a display name, determines eligibility. Shared event teams retain distinct identities even with duplicate names; category item identity separates their votes across categories.
- Drafts (valid, invalid or empty), absent/cancelled ballots and historical audit snapshots contribute no votes. Explicit empty submissions count toward participation but add zero votes. Unlock immediately removes that ballot's choices from totals; resubmission contributes only the replacement. Confirmation retries add nothing.
- All category items appear, including teams with zero votes and negative scores. Labels/descriptions come from current shared teams with the existing legacy item fallback; original snapshots remain untouched.
- Reuse the dashboard projection's eligibility, participation and factual problem definitions within the **same shared event lock** as the results queries. The aggregate additionally enforces submitted state and allowed-group membership itself. No per-juror query loop or audit-history read. All app-owned writes use the exclusive parent-event lock; post-wait administration authorization/statement-time expiry are rechecked.
- As in the dashboard, structurally possible but rule-invalid stored submissions remain current submissions and their signs appear in provisional totals, explicitly flagged `INVALID_SUBMISSION`. Ineligible stored ballots are excluded and flagged. Neither case can produce a final result; no silent repair/reclassification/deletion is performed. Privileged SQL can bypass application policy.

## API

| Route                                  | Response                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `GET /results/overview?eventId=<UUID>` | `{event,asOf,categories}` for all event categories, including setup drafts. |
| `GET /results/votings/:votingId`       | `{event,asOf,category}` from the identical event projection.                |

Strict shared Zod schemas validate route/query/output shapes. Categories expose name/kind/lifecycle, selected places, allowed groups, participation counts, factual problem codes, `stage`, provisional `reasons`, `boundaryTie` and `rows`. Rows expose item/team identity, current descriptions, display order, nonnegative `plus`/`minus`, signed `score`, shared `rank`, `tied` and `selection: selected | unresolved | outside`. Selection is a current ranking position whose finality is determined by category stage.

No per-juror identity, choices, ballot/revision/timestamps, secrets or audit contents leave this boundary. Reads create no ballots/history and change no state. Both routes inherit cookie/no-store/admin guards. Anonymous, fabricated, revoked and expired sessions return 401; jurors 403; malformed, duplicate or extra query claims 400; missing event/category 404. Shared administrators retain their existing cross-event access. No migration, dependency or write endpoint is added.

## Screens and refresh

`/admin/events/:eventId/results` shows independent category ranking tables (two columns on desktop). `/admin/results/votings/:votingId` adds descriptions and links to event results, category progress and existing administration/unlock. Direct entry and refresh restore the existing session. Phone rows reflow into labelled cards while preserving table semantics; team UUIDs distinguish duplicate names. Color supplements textual stage/selection/tie labels.

A snapshot timestamp and explicit **Obnovit data** describe freshness; there is no live/polling claim. Pending refresh retains the previous snapshot/time. A failure removes values and focuses retry feedback; recovery focuses the heading; successful keyboard refresh returns focus to the refresh button. Session loss removes protected results. Empty event/category, zero eligibility, unconfigured draft, unavailable category, error/retry and expired-session states are explicit.

Phase 12 excludes deadlines and alerts by user decision and adds the approved existing-action audit/hardening and XLSX event export. The shared administrative transaction helper now rechecks authorization at the end of results reads. [Operational contract and export contents](operational-hardening.md). Deployment/hosting remain Phase 13.

Stage 2 places event/category results in the shared event workspace with **Výsledky** active, alongside same-event **Příprava** and **Průběh hlasování** links. Results, export, refresh and ranking rules above remain unchanged. [Workspace guide](simplification-stage-2.md).
