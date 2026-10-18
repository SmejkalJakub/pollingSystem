# Simplification Stage 2 — compact event workspace

**Release update, 2026-10-18:** deployed with Stages 1–3 as `a79338c` on the existing free test service. Original local-only boundaries below are historical. See [release evidence and limits](../implementation/progress.md#stages-13-release-verification--2026-10-18).

Authorized 2026-10-18. This stage reorganizes local administration into one event workspace. Stage 1 access and all existing voting rules remain authoritative. No backend, contract, migration, dependency or hosting change is introduced.

## Navigation

Every event overview and category detail shares the event name and three links: **Příprava**, **Průběh hlasování**, **Výsledky**. The active section has an underline and `aria-current="page"`. Navigation uses ordinary links, supports keyboard activation, refresh and browser Back/Forward, and always carries the current event ID. These are page links rather than ARIA tabs. The global **Eventy** link remains available during loading/errors; **Odhlásit se** stays in the compact application header. A keyboard skip link focuses the main content.

| View                                                  | Local administration URL                    |
| ----------------------------------------------------- | ------------------------------------------- |
| Preparation, jurors (default)                         | `/admin/events/:eventId` or `?setup=jurors` |
| Preparation, teams                                    | `/admin/events/:eventId?setup=teams`        |
| Preparation, categories                               | `/admin/events/:eventId?setup=categories`   |
| Voting progress                                       | `/admin/events/:eventId/dashboard`          |
| Results and XLSX export                               | `/admin/events/:eventId/results`            |
| Category setup and existing lifecycle/unlock controls | `/admin/votings/:votingId`                  |
| Category progress                                     | `/admin/dashboard/votings/:votingId`        |
| Category results                                      | `/admin/results/votings/:votingId`          |

Preparation displays one management view at a time: **Porotci**, **Týmy**, **Kategorie**. Only the selected view loads its roster/team/category collection. Unknown `setup` values fall back to jurors and perform no action. Category setup's **Všechny kategorie** returns to the category list. Category progress/results retain their event-level return links and use the matching primary section. Existing URLs remain valid; there is no redirect migration.

Event description/editing is under **Nastavení eventu**, after the selected preparation content. Group management remains in Porotci; roster refresh is beside its heading. Existing per-item forms and explicit saves, validation, retained failed input, link controls and consequential confirmations are reused. Navigation does not save a form; save or cancel before leaving. Stage 1 personal links remain transient and clear on page navigation.

Progress and results retain their current read APIs, explicit refresh and snapshot timestamps, errors/retry and session recovery. They do not poll or imply live synchronization. Results retain the protected fresh XLSX export. Event/category headings no longer compete with a separate global section bar. Shared semantic colors, readable text and wrapping links retain the recorded warm, restrained design; controls remain at least 44px tall.

## Preserved behavior and boundary

Untimed juror sessions, dated administration expiry, encrypted same-link copying/fallback, legacy handling, generation/replacement/revocation and external key requirements are unchanged. Read the [Stage 1 guide](simplification-stage-1.md) before operating this version.

No D21 limit/formula, actual-cast negative eligibility, optional use, activation readiness, T/V permissions, sticky roster/configuration freeze, independent submission, revision/replay/unlock/history, current-only counts, shared ranks, cutoff ties or provisional/final rule changes. Preparation navigation never activates a draft, writes a ballot or appends audit history. Existing guarded endpoints remain authoritative.

Editable tables, batch/spreadsheet preview, one-save-per-table workflows, automatic T/V creation, combined category setup, bulk assignment/copy/duplication and new readiness tooling remain later-stage work, requiring a new user-started session. No commit, push, deployment or cloud/live-data action is authorized by Stage 2.

## Validation

See [progress](../implementation/progress.md) for actual source, PostgreSQL and browser results, review, preservation and limitations. Browser cases use generated local databases and compiled local servers. Stages 1–3 are now deployed as recorded above; the original local validation remains separate from hosted release checks.

Stage 3 subsequently introduces the approved [Teams-only editable table, paste preview and atomic save](simplification-stage-3.md). Other later-stage work listed above remains unimplemented.
