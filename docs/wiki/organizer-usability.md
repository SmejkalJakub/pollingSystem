# Organizer usability — 2026-11-10

Status: **DONE locally, 2026-11-10**. The user approved implementing the Impeccable review, then supplied [DashHack](https://dashhack-production.up.railway.app) as visual inspiration. This is one bounded organizer-workflow phase; juror submission redesign and post-activation rule/roster overrides are not implemented. No commit, push, deployment or hosted data change is authorized.

## Working in an event

Every event screen has direct **Porotci**, **Týmy**, **Kategorie**, **Průběh hlasování** and **Výsledky** links. Existing deep links still work, and the administration wordmark returns to the event list. Category management selects Kategorie rather than resetting to Porotci.

The shared palette now uses blue actions, a navy header, softer panels and a light workspace. Dark browser preference selects navy surfaces with contrasting blue controls. The DashHack home and its ATT Hackathon Junior 2026 Teams workspace were inspected read-only in the native browser; no event was created or modified there. This reference supplies visual cues only, not voting or access policy.

## Preparation

- Teams, Jurors and category preparation have a sticky save bar above the editor. Saving remains explicit and atomic. Errors, stale-edit comparison and stable-ID retries retain their existing meaning.
- **Zahodit změny** immediately returns to the saved form. **Vrátit změny** restores the discarded local rows/fields and their comparison/error context while that editor remains open. Another edit, reload or successful save ends this single-step undo. Undo does not write to the server or restore older server records. Leaving the editor still loses memory-only drafts/undo; the browser unload warning remains.
- Spreadsheet rows go directly into the editable table using **Přidat řádky do tabulky**. Parsing and field checks still reject malformed input before staging. The table itself is the preview; nothing is persisted until **Uložit tabulku**. Duplicate names retain distinct generated IDs.
- Saved juror links can be copied and the saved roster can be exported while unrelated row edits or comparison are pending. The UI explains that these operations use saved data. New unsaved jurors still need saving before a link exists. Table requests and consequential access panels temporarily pause these controls.
- Copy stays visible. **Další možnosti** contains link replacement/restoration, revocation and membership removal, retaining identity descriptions, confirmations, current authorization, freezes and RESTRICT behavior. These mutations still require finishing/discarding table edits.

## Operating voting

Category cards and category progress detail expose direct **Uzavřít hlasování** / **Znovu otevřít hlasování**. Category administration uses the same component. These reversible actions no longer require a second form; successful close exposes reopen, and successful reopen exposes close. Pending requests disable repeated actions, failures offer actionable feedback, and authorization loss clears the protected workspace. Existing server lifecycle/audit endpoints remain authoritative. Initial activation still has its consequence confirmation because it freezes setup and the roster.

Category progress lists **Odemknout porotci** beside submitted jurors. It reuses the administration unlock confirmation and expected ballot revision. One additional existing protected ballot-list read supplies control identities/revisions; dashboard counts still come exclusively from the existing dashboard response. Refresh updates both resources, and successful unlock refreshes both. No vote choices are added to the dashboard API. The original category-management unlock view remains available.

Frozen category setup is collapsed behind **Nastavení kategorie · uzamčeno**. The progress explanation is optional, and an empty attention section is omitted. Before any submissions, results show a quiet no-votes label instead of repeated tie warnings; API ranking, tie/finality rules and exports are unchanged, and factual data problems remain visible.

## Boundaries

No API, contract, database, migration, dependency, credential, D21, eligibility, sticky freeze, revision, submission, history, counting, ranking or export-format change. Rules/roster overrides need a separate explicit product decision. The juror wizard retains its current save/check/submit/navigation behavior; shared theme improvements also apply there.

## Validation

Workspace/E2E typechecks, lint, 79 fast tests, formatting and builds pass. Full built-app browser checks pass 27/27 without retries; after the final compact dashboard-layout refinement, affected organizer/full-voting/navigation checks pass 9/9 on desktop, phone and dark landscape. Keyboard, Axe A/AA, 44px controls, retained error/conflict behavior and no measured horizontal overflow are covered by these scenarios. Two bounded visual passes and source review are complete. Zero generated local test databases remain. See [implementation progress](../implementation/progress.md) for the exact earlier failures/fixes and sequence. The PostgreSQL integration suite was not rerun for this web-only change; the existing main-bundle size warning remains. Browser scenarios use generated disposable local databases and existing compiled migrations; they do not seed or reset development/hosted records. No hosted, native-device, complete screen-reader or load certification is implied.
