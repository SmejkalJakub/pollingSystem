# D21 Hackathon Voting System

Hackathon voting with D21 rules, technical (T) and second (V) jury groups, an administration workspace, a juror wizard, progress monitoring, and results.

Phases 0–12 are DONE; Phase 13 is IN_PROGRESS. Jurors use organizer-issued reusable links without expiry, with 12-hour sessions, protected category navigation, D21 controls, server validation and explicit per-category draft saving/restoration. Revision checks and comparison protect edits across tabs/devices. Saved drafts can be valid, invalid or empty; saving never submits votes. Each category can now be submitted independently with atomic validation/storage and safe retries. Submitted choices are locked; only administration can unlock them for juror correction/resubmission, preserving submission history. Administrators can configure selection/final voting, shared teams and entries, explicit positive/negative limits, allowed T/V groups, first activation, closure and unconditional reopening. Activation rejects incomplete configuration and requires equal T/V groups of 5, 7 or 9 jurors each. Review now shows saved choices/validity, safe return to editing, explicit category selection and confirmation with independent outcomes. The administration dashboard now shows real eligible/submitted counts, category and juror detail, pending assignments and factual problems. Open an event and choose **Průběh hlasování**. Refresh explicitly to load current data. Choose **Výsledky hlasování** for current submitted-only scores, shared ranks, multiwinner selection, unresolved cutoff ties and provisional/final labels. Choose **Stáhnout XLSX** on event results for a fresh workbook containing categories, team results, juror participation and export time. Existing admin interventions now have atomic audit records and session rechecks inside their transactions. See the implementation progress document for validation and limitations.

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

Development follows one phase per session. Phase 12 is complete with approved existing-action hardening/audit, XLSX results/participation export, validation and review. Deadlines and alerts are explicitly excluded by the user. Phase 13 now adds a built same-origin web/API container, Linux Compose, Render configuration and repeatable Playwright/axe checks. The separate Render Free + Supabase Free test instance is live at [d21-voting-test.onrender.com](https://d21-voting-test.onrender.com), with [admin login](https://d21-voting-test.onrender.com/admin/login). Private operator password setup and authenticated live voting checks remain before colleague use. HTTPS/readiness/origin guards, provider isolation and a hosted-data backup restored into a generated local database have been checked. The user authorized multiple Conventional Commits/push; no paid resources or changes to other projects. See the deployment guide and handoff.
