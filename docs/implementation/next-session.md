# Next-session handoff

Updated 2026-10-16.

## Last completed phase and current state

**Phase 2 — Authentication & Sessions: DONE. Phase 3: NOT_STARTED.** Stop after Phase 2; the user must explicitly start a new session for Phase 3.

The working npm workspace has React/Vite/Tailwind/shadcn, Fastify, Zod contracts, PostgreSQL/Drizzle and 13 tables. Authentication uses one shared administration password, with no email or individual login accounts. The user explicitly changed this from the earlier email/password proposal during Phase 2. Admin and guarantor have identical permissions and a shared identity. Jurors will use unique event/juror secret links; only backend preparation exists.

Browser routing: `/` is the public juror landing with personal-link instructions and no administration link; `/admin/login` is the direct password-login URL. Unknown paths show not-found content. This user-requested Phase 2 follow-up does not implement juror link redemption or start a later phase.

Git is initialized on main without commits/remote. Preserve the existing untracked project files. No commit is authorized. Original local servers/database remain running; inspect before starting duplicates. Disposable browser-test services/databases were cleaned up.

## Required starting procedure

Read README.md, AGENTS.md, all implementation documents, the master brief and relevant wiki pages. Inspect actual source, package scripts, Git status and service state. Use [local development](../wiki/local-development.md) and [authentication](../wiki/authentication.md).

Visual reference: [Lovable preview](https://lovable.dev/preview/B5g1pVIhaqERXx1MrD7RrOkKifuxT8Mt). Thoughtful improvements are allowed. Preview codes, counts and demo behavior do not override confirmed requirements.

## Next phase and exact scope

**Phase 3 — Event & Jury Management**, only in a new user-started session:

- Event creation/list/detail/edit API and admin screens.
- Jury-group management and juror creation/list/edit.
- Correct event membership and T/V group assignment.
- Runtime validation, authorization, relational integrity, tests, usable loading/empty/error/mobile states, review and documentation.

Before affected implementation resolve:

- Q05: may jury memberships change once voting starts or ballots exist? Do not silently invalidate eligibility or history.
- Q10: when are equal T/V groups of 5/7/9 enforced? The proposed incomplete-setup/activation validation policy is not yet approved.
- Destructive deletion/archive semantics remain unapproved. Existing references use RESTRICT; do not invent cascade deletion of history.

No voting configuration, D21 engine, ballot saving/submission, full wizard, dashboard or results in Phase 3. Q02/Q04 and other later gates remain open.

## Authentication facts and integration boundaries

- `npm run admin:set-password` prompts twice with echo suppressed, initially creates or later replaces the shared credential, and revokes all prior admin sessions. No default password exists, and none was seeded into development during Phase 2.
- `npm run admin:revoke-sessions` revokes existing admin sessions while retaining the password. Current password holders can log in again.
- PostgreSQL stores session token hashes, one actor, created/expiry/revocation timestamps. Sessions expire absolutely after 12 hours; logout revokes the current session.
- `APP_ORIGIN` defaults to `http://127.0.0.1:5173`. HTTPS origins get Secure `__Host-d21-session` cookies; local HTTP uses `d21-session`. All mutations in the auth scope require `X-D21-Request: 1`; supplied Origin must match exactly.
- Register future admin modules inside `registerAuth`'s encapsulated cookie/origin scope and apply `adminGuard`. A browser screen is not an authorization boundary. Admin and guarantor share `administer` access; do not add email/account flows or expanded RBAC.
- `juror_access` stores hashed event/juror secrets; `resolveJurorAccess` never identifies by name. Sessions can represent a juror, with same-event references and current group lookup. Public issuance/redemption, link lifetime and wizard/category entry remain future work. Confirm link lifecycle before exposing it.
- `POST /auth/juror/start` is deliberately not exposed yet; implement its real wizard/category contract in Phase 5. The web app includes an informational juror landing and confirms administration login at `/admin/login`.

## Important files

- `apps/api/src/modules/auth/{crypto,service,routes,operator}.ts`: password protection, database sessions, guarded routes and operator tools.
- `apps/api/src/modules/auth/{crypto,routes}.test.ts` and `auth.integration.test.ts`: auth behavior and real database coverage.
- `apps/api/src/{app,config,server}.ts`: factory, generic errors, environment and startup; keep testable injection.
- `apps/api/src/db/schema.ts` and migrations: ten foundation tables plus `admin_access`, `juror_access`, `sessions`. Add migrations; never rewrite applied `0000`/`0001` history.
- `apps/api/src/db/schema.integration.test.ts`: disposable database checks, configured connection needs CREATEDB.
- `packages/contracts/src/index.ts`: shared auth schemas and distinct voting/ballot/progress states.
- `apps/web/src/modules/auth/AuthScreen.tsx`, `lib/api.ts`, `components/ui/{button,input}.tsx`, `index.css`: existing UI, transport and semantic tokens.

Keep same-event/same-voting references, one ballot per juror/voting, one ±1 entry per item and future allowed-group server authorization. Foundation constraints do not implement full eligibility, immutable submissions or approved D21 rules.

## Commands and validation

Use Node 22.13+ within 22.x. npm 11.6.2 is the verified installer; the host's older npm had peer-resolution issues.

```sh
npx --yes npm@11.6.2 ci
npm run db:up
npm run db:migrate
npm run admin:set-password
npm run dev
npm run check
npm run test:db
```

Preserve an existing `.env`; copy `.env.example` only when missing. App: http://127.0.0.1:5173. API: http://127.0.0.1:3001. The frontend `/api` proxy preserves the same-origin boundary. Administration login is at http://127.0.0.1:5173/admin/login.

Latest validation: typecheck/lint/format/build PASS; 12 fast tests PASS; 26 real PostgreSQL tests PASS. Additive migration application and regeneration/no-drift PASS. Operator commands verified against disposable data. Browser login/error/focus, refresh persistence, logout, keyboard, desktop, 375px portrait, 812px landscape and server-outage/retry recovery PASS. Automated browser E2E/full accessibility/production operations have not run. The routing follow-up passed `npm run check` and browser route/refresh/home/unknown-path/mobile checks; database tests were not rerun for that frontend-only change. See progress.md for review findings and limitations.

## Phase 3 acceptance criteria

- Admin can create/edit events and view list/detail using real data.
- Admin can manage jury groups and jurors with approved setup/membership rules.
- Correct T/V/event assignments are enforced; invalid combinations and unauthorized access are rejected.
- Shared-password sessions protect all new admin operations.
- Backend/frontend scenarios and responsive states are verified with meaningful tests.
- Typecheck/lint/relevant tests/build pass; review and four implementation documents are updated.
- Stop after Phase 3. Do not advance automatically or commit without authorization.
