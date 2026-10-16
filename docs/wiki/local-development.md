# Local development

Phase 2 adds shared-password administration login and sessions to the foundation. Event management and voting workflows remain future work. See [authentication](authentication.md) for the approved model and operator commands.

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

The home page is a juror landing with personal-link instructions. Open [administration login](http://127.0.0.1:5173/admin/login) directly for the shared-password form; the public page has no admin link. Set it with the hidden terminal prompt; there is no seeded/default password. It follows the [Lovable visual reference](design-reference.md), with Czech copy, shared tokens, shadcn controls, loading/error/retry states and mobile layout. Successful login confirms shared administration access; event management is not implemented yet.

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

`npm run check` runs typecheck, lint, formatting, fast tests, and both builds. Run `npm run test:db` separately with PostgreSQL available. Integration tests create a uniquely named `d21_test_<uuid>` database, apply migrations there, test constraints and transactional rollback, and drop only that generated database afterward. They do not migrate, truncate, or delete records in the configured development database. An interrupted run may leave a generated test database; inspect it before manual cleanup.

API tests use Fastify injection. Authentication integration tests exercise the real PostgreSQL session/credential store, login/logout, replacement/revocation, concurrent replacement/login, expiry, secure cookies, origin checks, throttling and juror event isolation. Contract tests exercise structural validation. PostgreSQL tests verify repeatable migrations, event/voting isolation, duplicate ballot protection under concurrency, ±1 values, single entry per item, submission timestamp consistency, and rollback. These foundation tests do not establish D21 methodology or a final submission workflow.

`npm run format` applies formatting. The original supplied brief is excluded to preserve it byte-for-byte. Generated migration SQL/snapshots are excluded from formatting and linting.

## Database migrations

The schema lives in `apps/api/src/db/schema.ts`. Migration SQL and Drizzle metadata are committed source under `apps/api/src/db/migrations/`.

```sh
npm run db:generate
npm run db:migrate
```

Review generated SQL before applying it. Migration history prevents reapplying completed migrations. Do not edit a migration after it is applied in a shared environment; generate a new migration instead. No destructive product operations exist yet, and references currently use RESTRICT.

The foundation migration contains events, users, jury groups, event jurors, votings, allowed groups, voting items, ballots, entries, and audit logs. The additive Phase 2 migration adds shared admin access, juror secret storage and sessions. D21 parameters can be unset in a draft. Activation, authorized-group checks, submission transactions, and domain update timestamps maintained by application operations are responsibilities of subsequent phases. Database constraints alone do not authorize a vote or lock submitted records against direct SQL access.

## Health and builds

- `GET /health`: process liveness, independent of PostgreSQL.
- `GET /ready`: checks PostgreSQL with a bounded connection/query timeout; returns 200 when connected or 503 when unavailable. This is connection readiness, not a check for migration completeness or production readiness.
- Both endpoints expose stable shared schemas and no database details.

`npm run build` emits the API to `apps/api/dist` and the web assets to `apps/web/dist`. Start the built API using `npm run start -w @d21/api`; `npm run preview -w @d21/web` previews the built frontend locally. Full production routing, credentials, containerization, and deployment belong to Phase 13; this is not a deployment guide.

`npm run db:down` stops/removes this project's containers and network while retaining its named data volume. No reset or volume-deletion command is provided.

## Dependency notes

The root esbuild override selects a patched 0.28.x release across development tools. This avoids older vulnerable transitive versions in Drizzle Kit/tsup. Migration generation and application builds are verified against the override. npm may still report deprecation notices for Drizzle Kit's legacy loader packages; those are distinct from vulnerability advisories. Do not run a forced audit downgrade of Drizzle Kit.

Implementation references: [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite), [shadcn Vite setup](https://ui.shadcn.com/docs/installation/vite), [Drizzle migrations](https://orm.drizzle.team/docs/migrations). Package-lock.json records the tested dependency resolution.
