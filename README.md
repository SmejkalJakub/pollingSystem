# D21 Hackathon Voting System

Hackathon voting with D21 rules, technical (T) and second (V) jury groups, an administration workspace, a juror wizard, progress monitoring, and results.

Phases 0–13 are DONE within the approved scope. Jurors use organizer-issued reusable links without expiry, with no application-imposed session expiry (administration retains its 12-hour expiry), protected category navigation, D21 controls, server validation and explicit per-category draft saving/restoration. Revision checks and comparison protect edits across tabs/devices. Saved drafts can be valid, invalid or empty; saving never submits votes. Each category can now be submitted independently with atomic validation/storage and safe retries. Submitted choices are locked; only administration can unlock them for juror correction/resubmission, preserving submission history. Administrators can configure selection/final voting, shared teams and entries, explicit positive/negative limits, allowed T/V groups, first activation, closure and unconditional reopening. Activation rejects incomplete configuration and requires equal T/V groups of 5, 7 or 9 jurors each. Review now shows saved choices/validity, safe return to editing, explicit category selection and confirmation with independent outcomes. The administration dashboard now shows real eligible/submitted counts, category and juror detail, pending assignments and factual problems. Open an event and choose **Průběh hlasování**. Refresh explicitly to load current data. Choose **Výsledky hlasování** for current submitted-only scores, shared ranks, multiwinner selection, unresolved cutoff ties and provisional/final labels. Choose **Stáhnout XLSX** on event results for a fresh workbook containing categories, team results, juror participation and export time. Existing admin interventions now have atomic audit records and session rechecks inside their transactions. See the implementation progress document for validation and limitations.

Stage 1 adds **Kopírovat odkaz** directly beside each juror, with repeatable encrypted retrieval and a selectable fallback. Legacy hash-only links keep working but need explicit replacement before they can be copied. Configure a private external encryption key ring before generating new links; see [Stage 1 access, transition and key backups](docs/wiki/simplification-stage-1.md). Browser cookie retention is browser-controlled; personal links remain usable for re-entry. Deployed with Stages 2–3 on the free test instance on 2026-10-18.

Stage 2 organizes administration into a compact event workspace: **Příprava**, **Průběh hlasování** and **Výsledky**. Preparation shows **Porotci**, **Týmy** or **Kategorie** separately; event metadata is under **Nastavení eventu** below the selected view. Existing category links, voting rules, confirmations and Stage 1 access are preserved. [Workspace navigation and stage boundary](docs/wiki/simplification-stage-2.md). Deployed on the free test instance on 2026-10-18.

Stage 3 makes **Příprava → Týmy** an editable table with spreadsheet paste preview and **Uložit tabulku**. Saves are atomic, failed inputs/errors remain visible, and stale edits require comparison before saving again. Retries reuse the same team IDs; duplicate names remain separate teams. [Teams workflow, concurrency and limits](docs/wiki/simplification-stage-3.md). Deployed on the free test instance on 2026-10-18.

Stage 4 adds **Příprava → Porotci** as an editable Jurors table with explicit T/V assignment, spreadsheet preview, atomic save and stale-edit comparison. Successful saves create only missing T/V groups on unfrozen events; existing group names/IDs, personal access, sessions and voting history are preserved. Stage 4 is deployed on the free test instance (2026-10-19); see [workflow and limits](docs/wiki/simplification-stage-4.md) and [actual validation](docs/implementation/progress.md).

Stage 5 combines category name/instructions, explicit rules, T/V permissions and team entries into one **Příprava kategorie** form with atomic saving, retained errors, reviewed conflicts and stable-ID retries. Activation stays separate and existing configuration freezes remain authoritative. Stage 5 is deployed on the free test instance (2026-10-19); see the [category workflow](docs/wiki/simplification-stage-5.md) and [actual validation](docs/implementation/progress.md).

Use Node.js 22.13+ within the 22.x line and Docker. First run, from this directory:

```sh
npx --yes npm@11.6.2 ci
cp .env.example .env
npm run db:up
npm run db:migrate
npm run admin:set-password
npm run dev
```

Preserve `.env` if it already exists. The password command prompts without echo; there is no default password. Admins and guarantors use the same shared password, without an email. The [local home page](http://127.0.0.1:5173) is for jurors. Administrators and guarantors sign in directly at [admin login](http://127.0.0.1:5173/admin/login); there is no public admin link. See [local development](docs/wiki/local-development.md) for configuration, database checks, builds, and troubleshooting.

```sh
npm run check
npm run test:db
npx playwright install chromium
npm run test:e2e
```

- [Linux hosting, Render/Supabase testing and backups](docs/wiki/deployment.md)
- [Operational hardening and XLSX export](docs/wiki/operational-hardening.md)
- [Results and ranking](docs/wiki/results-ranking.md)
- [Operational dashboard](docs/wiki/operational-dashboard.md)
- [Project wiki](docs/wiki/README.md)
- [Design reference and user guidance](docs/wiki/design-reference.md)
- [Original implementation brief](docs/wiki/master-implementation-prompt.md)
- [Event and jury management](docs/wiki/event-jury-management.md)
- [Voting draft preparation and Phase 4 gates](docs/wiki/voting-configuration.md)
- [Juror entry, link lifecycle and wizard](docs/wiki/juror-wizard.md)
- [Multi-category review and final submission](docs/wiki/multi-category-review.md)
- [Category submission and administrator unlocking](docs/wiki/ballot-submission.md)
- [Authentication and password commands](docs/wiki/authentication.md)
- [Local setup and validation](docs/wiki/local-development.md)
- [Implementation plan](docs/implementation/plan.md)
- [Current progress](docs/implementation/progress.md)
- [Next-session handoff](docs/implementation/next-session.md)

Development follows one phase per session. Phase 12 is complete with approved existing-action hardening/audit, XLSX results/participation export, validation and review. Deadlines and alerts are explicitly excluded by the user. Phase 13 is complete with a built same-origin web/API container, Linux Compose, Render configuration, repeatable Playwright/axe checks and live verification. The separate Render Free + Supabase Free test instance is live at [d21-voting-test.onrender.com](https://d21-voting-test.onrender.com), with [admin login](https://d21-voting-test.onrender.com/admin/login). Historical Phase 13 checks of authenticated live voting, T/V permissions, D21 validation, results/XLSX, link revocation, responsive/accessibility checks, database interruption/recovery and service restart/session retention pass. The populated hosted backup also restores into an isolated Linux container with working login/results/XLSX. Three closed, labelled validation events are retained; the existing user event is unchanged. The user authorized multiple Conventional Commits/push; no paid resources or changes to other projects. See the deployment guide and handoff. Stages 1–5 now run source `4995a2d`, with six migrations and every original hosted record preserved. Private pre/post backups and authenticated Jurors/combined-category persistence checks pass. A separate labelled Stages 4–5 draft test event is retained without personal links or votes. See the current release record in the implementation progress document.
