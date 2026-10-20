# Local development

Phases 0–12 are complete. Jurors can save and restore category drafts with D21 validation and stale-revision protection across tabs/devices. Draft saves never submit votes. Explicit independent category submission, safe retries, locked confirmation and administrator-only unlocking/history are now implemented; see [submission](ballot-submission.md). See [juror entry](juror-wizard.md), [voting configuration](voting-configuration.md) and [authentication](authentication.md).

## Requirements

- Node.js 22.13 or newer in the 22.x line. Use a current patched 22.x release; `.node-version` selects the major line.
- npm 11.6.2 is the verified installer (`packageManager` in package.json). The host's npm 11.0.0 crashed during peer resolution, so commands below explicitly invoke the verified release without changing the global installation.
- Docker with Compose, or an independently managed PostgreSQL 17 instance. The provided setup uses a local-only Docker port.

## First run

From the project root:

```sh
npx --yes npm@11.6.2 ci
cp .env.example .env
npm run db:up
npm run db:migrate
npm run admin:set-password
npm run dev
```

Copy the example only if `.env` does not already exist; preserve an existing configuration. The example credentials are for this local development database only. All `.env` files except `.env.example` are ignored by Git. Environment variables supplied by the shell take precedence over the file.

Open [the local web app](http://127.0.0.1:5173). The API listens on 127.0.0.1:3001 by default. The frontend development proxy maps `/api/*` to the API's root routes. Both processes stop when the foreground development command is interrupted.

The home page is the juror entry surface. Organizers save jurors to automatically create encrypted reusable links, then use **Kopírovat odkaz** directly and deliver them privately. The Osobní přístup panel is removed; [automatic links](automatic-juror-links.md) preserve legacy/revoked access. Links and juror sessions have no application-imposed timed expiry; administration sessions still expire after 12 hours. Configure the external server encryption key ring for new-link generation/copying using [Stage 1 setup and backup instructions](simplification-stage-1.md); keep existing `.env` credentials intact. `/wizard` and `/wizard/steps/:stepId` restore authenticated category navigation. Open [administration login](http://127.0.0.1:5173/admin/login) directly for the shared-password form; the public page has no admin link. Set it with the hidden terminal prompt; there is no seeded/default password. It follows the [Lovable visual reference](design-reference.md), with Czech copy, shared tokens, shadcn controls, loading/error/retry states and mobile layout. Successful login opens the event list. Direct administration routes are `/admin/events`, `/admin/events/:eventId` and `/admin/votings/:votingId`; see [event/jury management](event-jury-management.md) and [voting drafts and permissions](voting-configuration.md).

## Configuration

| Variable                                        | Purpose                                                                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| DATABASE_URL                                    | PostgreSQL connection used by API and migration commands. Required; never sent to the browser.                                                  |
| POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD | Local Compose database initialization. Match these in DATABASE_URL.                                                                             |
| POSTGRES_PORT                                   | Host port for Compose, default 54329. Update DATABASE_URL if changed.                                                                           |
| APP_ORIGIN                                      | Exact browser origin for authentication and cookie security, default `http://127.0.0.1:5173`; use HTTPS outside local development.              |
| API_HOST                                        | API bind host, default 127.0.0.1.                                                                                                               |
| API_PORT                                        | API port, default 3001; also used by Vite's development proxy.                                                                                  |
| TEST_DATABASE_URL                               | Optional administrative PostgreSQL URL for integration tests; defaults to DATABASE_URL. Must permit creating and dropping disposable databases. |

Compose initialization values only apply to a new volume. Editing the password in `.env` does not change a password already stored by PostgreSQL. Keep the file and existing database consistent; do not delete the volume to solve configuration issues unless its data is disposable.

## Checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:db
npm run build
```

`npm run check` runs typecheck, lint, formatting, fast tests, and both builds. Run `npm run test:db` separately with PostgreSQL available. Integration tests create uniquely named disposable test databases, apply migrations there, test constraints and transactional rollback, and drop only that generated database afterward. They do not migrate, truncate, or delete records in the configured development database. An interrupted run may leave a generated test database; inspect it before manual cleanup.

API tests use Fastify injection. Authentication integration tests exercise the real PostgreSQL session/credential store, login/logout, replacement/revocation, concurrent replacement/login, expiry, secure cookies, origin checks, throttling and juror event isolation. Event/jury integration tests exercise CRUD, strict validation, all endpoint authorization/origin guards, cross-event relationships, pre-freeze removal, RESTRICT conflicts, sticky freezes and migration upgrade/backfill. Contract tests exercise structural validation. PostgreSQL tests verify repeatable migrations, event/voting isolation, duplicate ballot protection under concurrency, ±1 values, single entry per item, submission timestamp consistency, and rollback. Phase 7 also tests draft persistence/restoration, ownership, stale-save races, atomic rollback and lifecycle/session lock waits. Phase 8 additionally covers independent submit, matching/different concurrent requests, administrator-only unlock/history/replacement, legacy/exhausted/cancelled records, rollback and actual session/lifecycle lock waits (167 PostgreSQL checks total).

`npm run format` applies formatting. The original supplied brief is excluded to preserve it byte-for-byte. Generated migration SQL/snapshots are excluded from formatting and linting.

## Database migrations

The schema lives in `apps/api/src/db/schema.ts`. Migration SQL and Drizzle metadata are committed source under `apps/api/src/db/migrations/`.

```sh
npm run db:generate
npm run db:migrate
```

Review generated SQL before applying it. Migration history prevents reapplying completed migrations. Do not edit a migration after it is applied in a shared environment; generate a new migration instead. Phase 3 permits unreferenced juror membership removal only before the roster freezes; references retain RESTRICT. Event/group deletion and archive are not exposed.

The foundation migration contains events, users, jury groups, event jurors, votings, allowed groups, voting items, ballots, entries, and audit logs. The additive Phase 2 migration adds shared admin access, juror secret storage and sessions. Phase 3 migration `0002_low_talon.sql` adds the sticky roster-freeze marker and voting/ballot triggers. Additive Phase 4 `0003_young_starbolt.sql` adds shared teams and same-event item references, backfilling legacy items without merging names or changing ballot references. There are now 14 tables and six migrations: earlier 0004 pins the trigger lookup path; Stage 1 0005 adds encrypted links and nullable juror expiry. D21 parameters can be unset in a draft. Activation and current allowed-group checks are implemented. Phase 6 validates selections; Phase 7 persists drafts under exclusive event locks with expected revisions. Phase 8 submission/unlock uses these same locks/revisions and existing audit_logs history; no schema change. Domain update timestamps are maintained by their application operations. Database constraints alone do not authorize a vote or lock submitted records against direct SQL access.

## Health and builds

- `GET /health`: process liveness, independent of PostgreSQL.
- `GET /ready`: checks PostgreSQL with a bounded connection/query timeout; returns 200 when connected or 503 when unavailable. This is connection readiness, not a check for migration completeness or production readiness.
- Both endpoints expose stable shared schemas and no database details.

`npm run build` emits the API to `apps/api/dist` and the web assets to `apps/web/dist`. Start the built API using `npm run start -w @d21/api`; `npm run preview -w @d21/web` previews the built frontend locally. Phase 13 adds compiled `apps/api/dist/migrate.js` and `operator.js`, bundled workspace packages and opt-in same-origin built hosting. See the [deployment guide](deployment.md) for Linux containers and the approved Render/Supabase test target; the free pilot has passed authenticated live workflows and controlled recovery, with explicit limits in that guide.

`npm run db:down` stops/removes this project's containers and network while retaining its named data volume. No reset or volume-deletion command is provided.

## Dependency notes

The root esbuild override selects a patched 0.28.x release across development tools. This avoids older vulnerable transitive versions in Drizzle Kit/tsup. Migration generation and application builds are verified against the override. npm may still report deprecation notices for Drizzle Kit's legacy loader packages; those are distinct from vulnerability advisories. Do not run a forced audit downgrade of Drizzle Kit.

Implementation references: [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite), [shadcn Vite setup](https://ui.shadcn.com/docs/installation/vite), [Drizzle migrations](https://orm.drizzle.team/docs/migrations). Package-lock.json records the tested dependency resolution.

## Phase 9 review validation

Juror review/confirmation routes are `/wizard/review` and `/wizard/confirmation`; selected final submission is `POST /wizard/final-submit`. [Workflow and recovery](multi-category-review.md). The PostgreSQL suite now has 186 passing checks, including independent selected submits, saved-version integrity, partial-commit recovery, concurrent requests, unlock/replacement and actual event-lock authorization/lifecycle changes. No new dependency/migration. Browser checks used an isolated generated database and temporary services, cleaned up afterward; development data/credentials were preserved.

## Phase 10 dashboard validation

Open an administration event and choose **Průběh hlasování** (`/admin/events/:eventId/dashboard`). Category detail is `/admin/dashboard/votings/:votingId`. Data has a snapshot timestamp and explicit refresh. [Contract and counting rules](operational-dashboard.md). The database test script includes the new dashboard suite: 200 PostgreSQL checks total across six files, with generated databases only. Existing 41 fast tests and full type/lint/format/build checks pass. No migration/dependency. Real-backend browser validation used disposable credentials/data; all temporary services/database were removed and development records/credentials were digest-compared unchanged.

## Phase 11 results validation

Event results are `/admin/events/:eventId/results`; category results are `/admin/results/votings/:votingId`. Both use existing administration session recovery, snapshot times and explicit refresh. [Counting/ranking/finality contract](results-ranking.md). The root PostgreSQL test script now includes `modules/results/results.integration.test.ts`; final evidence/counts are in progress.md. No new dependency/migration. Browser validation used a generated disposable database, with development public-table data and `.env` digest-compared unchanged.

## Phase 12 — 2026-10-18

On event results choose **Stáhnout XLSX**. The protected `/results/export.xlsx?eventId=<UUID>` creates categories, team results and participation sheets with one UTC snapshot time. ExcelJS 4.4.0 is API-only; root override pins its compatible UUID 11.1.1 patch. A clean npm 11.6.2 install passed with zero reported vulnerabilities. The DB script includes `modules/results/operations.integration.test.ts`; final counts/limitations are in progress.md. Deadlines and alerts are excluded by the user. [Full contract](operational-hardening.md).

## Repeatable browser validation — Phase 13

After installing dependencies and making local PostgreSQL available, run `npx playwright install chromium` and `npm run test:e2e`. The suite builds the app and runs desktop, phone and dark reduced-motion landscape projects against its own generated disposable databases/real HTTP server. It exercises compiled migrations twice and uses only disposable credentials; configured development data is not seeded/reset. The test connection must permit CREATE/DROP DATABASE. Do not run this suite against a hosted production database. Run it separately from builds/database integration suites when diagnosing timing failures; final checks must record any failed attempts rather than hiding them. Full screen-reader, native mobile, load and live-provider testing remain separate. Configuration includes opt-in `SERVE_WEB`, explicit `TRUSTED_PROXY_CIDRS`, and optional `MIGRATION_DATABASE_URL`; do not replace `.env` during setup.

Stage 2 uses the same local startup and endpoints. Open an event for **Příprava**, with separate **Porotci**, **Týmy** (`?setup=teams`) and **Kategorie** (`?setup=categories`) views, plus event progress/results links. [Workspace URLs and preserved behavior](simplification-stage-2.md). Stage 1 and Stage 2 remain local and undeployed.

Stage 3 uses the same startup/configuration and adds no migration. Open **Příprava → Týmy** for the editable table and spreadsheet preview. The full database script includes `modules/teams/teams.integration.test.ts`; browser checks include `tests/e2e/teams.spec.ts`. [Save/retry/conflict behavior and request-size limit](simplification-stage-3.md). Stages 1–3 are also deployed on the dedicated free test instance; see [release evidence](../implementation/progress.md#stages-13-release-verification--2026-10-18).
