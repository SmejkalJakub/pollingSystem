# Linux hosting and colleague testing

Phase 13, 2026-10-18. The user approved Linux hosting plus a separate Render/Supabase test instance, with no automatic data deletion. The account owner owns backups/restores. The later user instruction requires **unpaid minor testing only**: Render Free + Supabase Free, without paid upgrades or add-ons. Actual validation and remaining deployment gates are in [progress](../implementation/progress.md). The separate Supabase test database and free Render service are provisioned. The corrected deployment is live; private administrator password setup and authenticated colleague workflows remain.

## One application image

The Dockerfile builds the web and API with Node 22 and npm 11.6.2. Its runtime installs production dependencies, runs as UID 1000, and contains compiled server, migration and password/session-operator entry points. Workspace TypeScript is bundled; no TypeScript loader is needed in production. Applied migration SQL is copied unchanged.

`SERVE_WEB=true` serves the built frontend at `/` and the existing API at `/api`. Direct admin/wizard navigation returns the SPA; missing API routes and assets remain JSON 404s. Auth, same-origin guards, session cookies, no-store responses, XLSX and audit semantics are unchanged. Development retains Vite and the unprefixed internal API. Health/readiness in the combined image are `/api/health` and `/api/ready`; readiness checks database connectivity, not migration completeness.

| Setting                  | Hosting value                                                                 |
| ------------------------ | ----------------------------------------------------------------------------- |
| `DATABASE_URL`           | Server-only PostgreSQL URL; percent-encode password characters in a URL.      |
| `MIGRATION_DATABASE_URL` | Optional direct migration connection; falls back to `DATABASE_URL`.           |
| `APP_ORIGIN`             | Exact browser origin, without trailing slash. HTTPS for remote access.        |
| `SERVE_WEB`              | `true` in the image; defaults to `false` for development.                     |
| `API_HOST` / `API_PORT`  | `0.0.0.0` / `3001` in the image.                                              |
| `TRUSTED_PROXY_CIDRS`    | Empty by default. Optional comma-separated trusted immediate proxy IPs/CIDRs. |

Do not use blanket proxy trust or copy provider outbound IP ranges as proxy ranges. Confirm the immediate inbound proxy and how it sanitizes forwarding headers before setting this variable. Untrusted forwarding headers are ignored. Origin checks, secure-cookie selection and generated links use configured `APP_ORIGIN`, not forwarded host/protocol. With proxy trust empty, login/redemption throttling can group users behind the proxy; verify distinct-client behavior before colleague testing. Limits remain per process; this setup is a single application instance, without distributed throttling or a load-test claim.

## Local Linux Docker setup

Install Docker Engine and Compose v2 on the Linux machine. Use a separate directory/environment from development. From the repository root, copy the hosting example only if the destination does not already exist:

```sh
cp deploy/.env.host.example deploy/.env.host
chmod 600 deploy/.env.host
```

Edit `deploy/.env.host`: choose a long random **hex** PostgreSQL password, retain `APP_ORIGIN=http://localhost:8080` for local access, and choose an unused `HOST_PORT` if necessary. The file is ignored by Git and Docker. Do not reuse development or Story Teller credentials/data. Compose's URL construction expects a URL-safe password; hex avoids URL escaping and Compose interpolation issues.

```sh
docker compose --env-file deploy/.env.host -f compose.host.yaml up -d --build --wait
docker compose --env-file deploy/.env.host -f compose.host.yaml exec app node apps/api/dist/operator.js set-password
```

The second command prompts twice without echo; there is no default administration password. Open `http://localhost:8080/admin/login`. Jurors receive links issued from the roster. The application port binds only to loopback and the database has no host port. The separate `migrate` service waits for PostgreSQL and must succeed before the app starts. Its SQL history is repeatable:

```sh
docker compose --env-file deploy/.env.host -f compose.host.yaml run --rm migrate
docker compose --env-file deploy/.env.host -f compose.host.yaml exec app node apps/api/dist/operator.js revoke-sessions
docker compose --env-file deploy/.env.host -f compose.host.yaml logs --tail=100 app migrate
docker compose --env-file deploy/.env.host -f compose.host.yaml down
```

Normal `down` retains the named database volume. Do not use `down -v` for retained data. An update rebuilds/recreates the app; run migrations explicitly before starting updated application code. Back up before migration, retain the prior image, and check `/api/ready`, login, a juror link and XLSX after an update. Reverting an image does not revert a database migration; restore only into a separate database unless an operator explicitly chooses a recovery plan.

Remote/LAN access needs an approved HTTPS reverse proxy and matching `APP_ORIGIN`. Do not expose local HTTP with session-security workarounds. No arbitrary-domain TLS/proxy deployment is claimed by this local setup.

## Current free test instance

- App: [d21-voting-test.onrender.com](https://d21-voting-test.onrender.com); [administration](https://d21-voting-test.onrender.com/admin/login).
- Render service `srv-dbac88eq1p3s73b4jqm0`, Frankfurt, **Free**, manual deployments. Live deploy `dep-dbacbn6q1p3s73b4uqj0` runs source commit `901c63b` and health path `/api/ready`. Settings match the Blueprint; the service was created directly, without Blueprint synchronization.
- Supabase `d21-polling-test`, ref `ieqmrqctivjiljzyyucn`, Frankfurt, **Free**. SSL enforcement enabled, verified-TLS session pooling, Data API disabled, GraphQL extension absent, no provider-role app-table grants, security advisors clear. Five Drizzle migrations, 14 application tables. The original four SQL files remain immutable; additive 0004 pins the invoker trigger search path.
- Render billing was checked: Hobby, no card, $0 charges and available free allowances. No paid resource/upgrade or shared billing change. Existing projects were inspected only and left unchanged.
- **Before colleague use:** privately choose the shared administration password with the existing hidden operator. No password has been seeded or requested in chat. From this repository's terminal:

  ```sh
  NODE_EXTRA_CA_CERTS=deploy/supabase-root.crt node --env-file=deploy/.env.test apps/api/dist/operator.js set-password
  ```

  The private mode-0600 ignored env file targets only this Supabase project. Then log in through the HTTPS admin address and run the authenticated live checklist below. Do not copy development credentials.

- Current backup: ignored mode-0600 `backups/d21-polling-test-20261018.dump`, with a mode-0700 parent directory on the owner's current Mac. A PostgreSQL 17 custom-format dump of only `public` and `drizzle` was restored into a generated local PostgreSQL database; all 15 tables matched exactly, including five migration records. The generated restore DB and temporary connection file were removed. This is a pre-colleague snapshot, before admin password/event/ballot setup; it does not prove managed-Supabase restore or contain future test data. The owner must refresh the backup before/after each planned test session and before deployments, using the procedure below. No automatic deletion or paid backup service is configured.
- Verified publicly: root/admin HTML navigation, database readiness, no-store/no-referrer/nosniff, protected event API, unknown API/assets JSON 404, wrong-origin login/logout 403, and Secure/HttpOnly/SameSite=Strict host-only logout cookie attributes. The browser displays the live Czech admin page. Authenticated cookie issuance, T/V voting/results/export, provider restart/restore and two-client throttling still await live verification. Proxy trust remains empty; clients may share the proxy's login rate limit. Local E2E passes do not establish these live outcomes.

## Render + separate Supabase test database

This is the approved colleague-testing target. The Blueprint uses one **Free** web instance in Frankfurt and a **Free** Supabase project. Paid instances, add-ons and upgrades are outside the user’s authorization. Confirm a $0 setup and available free quotas before provisioning. Use an account/workspace without a payment method to avoid Render bandwidth/build overage charges; if an existing billing configuration can charge overages, resolve that before deploying. Quota exhaustion should stop testing, not trigger a paid upgrade. Render sleeps after 15 minutes idle and typically takes about a minute to wake; Supabase Free may pause after a week idle and allows two active free projects. These limits fit a planned small testing session, not a production availability promise. [Render free limits](https://render.com/docs/free), [Supabase pricing](https://supabase.com/pricing). Supabase is a **new project**, separate from Story Teller and local development. No Supabase Auth, anon key, service-role key or browser database access is used. The user explicitly authorized the named accounts, multiple Conventional Commits and pushing this repository for the unpaid test deployment. Other projects must remain unchanged.

1. Install/connect the Render and Supabase integrations, or sign into their dashboards. Choose the owning accounts and create a separate test database near the app region. Select connection-string-only access: disable the Supabase Data API and GraphQL exposure **before applying application migrations** and keep automatic table exposure off. This app authorizes access in Fastify; it has no Supabase RLS policies and must not expose application tables through provider APIs. Verify that publishable/anonymous keys cannot read or write the application tables. [Supabase API security guidance](https://supabase.com/docs/guides/api/securing-your-api). Review current free/paid limits first. Supabase Free may pause after inactivity and does not replace owner-managed backups.
2. In Supabase **Connect**, use the **session pooler** PostgreSQL connection on port 5432 for this persistent API when IPv4 compatibility is needed. This differs from Story Teller's serverless transaction-pooler setup. Prefer a separate direct connection for migrations/backup/restore when the network supports it; if unavailable, verify session-pooler migration compatibility on the new test project before deployment. The migration command uses `MIGRATION_DATABASE_URL` when set and otherwise `DATABASE_URL`. Use the actual database password, percent-encoded in the URL. Require certificate-verified TLS using the provider's connection instructions and CA if needed; never disable certificate verification.

   The test project uses a dedicated `d21_app` login, without superuser/create-role/create-database privileges. It owns the application tables and can create schemas in this database for the unchanged Drizzle migrator. Its default table/sequence grants exclude provider API roles; new functions exclude PUBLIC execution. Only the new project's settings are changed. `deploy/supabase-root.crt` is the public Supabase Root 2021 CA linked by the dashboard, valid until 2031-04-26, SHA-256 `807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`. The image includes it, and Render sets `NODE_EXTRA_CA_CERTS=/app/deploy/supabase-root.crt` before Node starts. The connection URL uses `sslmode=verify-full`. For a local Node command, set `NODE_EXTRA_CA_CERTS=deploy/supabase-root.crt` in the process environment before startup; putting it only in Node's `--env-file` did not activate trust in the tested Node 22.13 runtime. [Supabase SSL guidance](https://supabase.com/docs/guides/platform/ssl-enforcement).

3. Make the reviewed code available to Render from the Git remote. This repository currently contains uncommitted earlier phases; committing/pushing requires explicit user authorization. `render.yaml` disables automatic deployments so a later push does not silently publish changes.
4. Import the Blueprint or create an equivalent Docker Web Service. Set secret `DATABASE_URL`, and set `APP_ORIGIN` to the exact allocated `https://…onrender.com` origin. The Dockerfile binds to `0.0.0.0:3001`; Render detects the exposed port. Health path is `/api/ready`. Free services do not provide the paid pre-deploy hook. The Blueprint’s Docker command is `./deploy/start-test.sh`; the executable script runs `node apps/api/dist/migrate.js` before `exec node apps/api/dist/server.js`. Migration failure prevents the server from starting. This avoids inline shell quoting differences in Render. Completed migrations are safe to rerun on each restart/wake. This setting is for the single test service; coordinate schema updates before introducing multiple instances.
5. Leave `TRUSTED_PROXY_CIDRS` empty until the inbound proxy boundary has been confirmed. Verify proxy/client IP behavior before inviting colleagues; set only confirmed ranges. This remains a deployment validation gate, not an invented provider CIDR.
6. Render Free has no interactive service shell. From this repository, build the same image locally and run its existing hidden-password operator against only the new Supabase test project:

   ```sh
   docker build -t d21-voting:test .
   docker run --rm -it --env-file deploy/.env.test d21-voting:test node apps/api/dist/operator.js set-password
   ```

   First create private, Git-ignored `deploy/.env.test` with the **new test project’s** `DATABASE_URL` and exact `APP_ORIGIN`; keep it out of chat and preserve the root development `.env`. This explicit container env file prevents accidentally inheriting the host’s development database environment. The Docker build excludes nested environment files. The command prompts without echo: do not store the administration password in that file, command arguments or logs. Run the operator only after startup has applied the migrations successfully. Share the chosen password privately; distribute juror links privately from the application roster.

7. Run the live checklist below before sharing the test URL. Record the actual deployment URL, region, plan, database identity, TLS/proxy settings, backup location/owner and results in the handoff. No custom domain is required for the provider testing address.

The application does not automatically delete test data, revoke reusable links on a schedule, or implement retention/cleanup. Session/link/audit rows remain retained under the existing model. Remove a test environment only after an explicit owner decision and any required backup. A paused hosting/database plan can interrupt access; choose a suitable plan for the testing window.

## Backup and restore

XLSX is a results snapshot, **not** a database backup. PostgreSQL backups include current ballots, original audit snapshots, credentials and reusable-link/session hashes; keep them private and encrypted off the application host. The owner chooses the backup destination, schedule and retention. No unattended backup schedule has been inferred or installed.

For the local Compose database:

```sh
umask 077
docker compose --env-file deploy/.env.host -f compose.host.yaml exec -T postgres pg_dump -U d21 -d d21 -Fc > d21-backup.dump
docker compose --env-file deploy/.env.host -f compose.host.yaml exec -T postgres createdb -U d21 d21_restore_check
docker compose --env-file deploy/.env.host -f compose.host.yaml exec -T postgres pg_restore -U d21 -d d21_restore_check --no-owner --no-privileges --exit-on-error < d21-backup.dump
```

Verify the restored tables, five migration-history records, current ballots/entries, audit history and counts before relying on a backup. The example restores into a **new** database and does not switch or overwrite the running one. A restored copy contains usable credential/session data; do not expose it as another live instance unintentionally.

For Supabase, follow its [backup guidance](https://supabase.com/docs/guides/platform/backups). Use a version-compatible PostgreSQL client with certificate-verified TLS and `pg_dump -Fc --no-owner --no-privileges`; supply connection details through a private PostgreSQL service file or non-secret PGHOST/PGPORT/PGDATABASE/PGUSER settings with a hidden password prompt. Do not paste database URLs into command arguments or chat. Supabase-managed schemas require provider-specific restore handling: verify an application-schema dump and restore into a separate test project/database, without overwriting provider-managed schemas. A local PostgreSQL restore check does not prove a Supabase restore.

## Live acceptance before inviting colleagues

- HTTPS direct `/admin/login`, `/wizard/review`, asset loading and JSON API 404s work at the real origin; readiness succeeds after migrations.
- Supabase REST/GraphQL cannot bypass application authorization to access tables, credentials, ballots or audit snapshots.
- Secure HttpOnly/SameSite cookies, correct-origin login/logout, rejected foreign-origin writes and protected API 401/403 behavior survive the provider proxy.
- Two distinct clients can sign in/redeem without accidental shared throttling; spoofed forwarding headers cannot bypass the selected trust boundary.
- Create a disposable event with equal T/V rosters, exercise allowed/denied categories, save/reload, selected independent submit, closure, results and XLSX. Unlock/reopen/replacement must remove/replace current contributions while preserving audit history.
- Test mobile and keyboard paths, a service restart/session recovery, database outage/recovery and a backup/restore of the actual hosted environment. Keep findings/limits factual.

The repeatable local browser suite runs `npm run test:e2e` after `npx playwright install chromium` (Linux CI may need Playwright OS dependencies installed by its operator). It builds the combined application, creates only generated disposable databases, runs compiled migrations twice through a dedicated generated migration URL, seeds only disposable credentials, and starts/stops its own local API. The configured database role must permit CREATE/DROP DATABASE. Never point this administrative test URL at Supabase/production. Traces/videos/automatic screenshots are disabled to avoid storing credentials/link fragments; explicit result screenshots contain generated test data.

References checked for this setup: [Fastify proxy trust](https://fastify.dev/docs/latest/Reference/Server/#trustproxy), [Render Blueprint specification](https://render.com/docs/blueprint-spec), [Render web services](https://render.com/docs/web-services), [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing).

The landscape project requests dark browser preference and reduced motion; the application retains its designed light palette. It is not a separately implemented dark theme.
