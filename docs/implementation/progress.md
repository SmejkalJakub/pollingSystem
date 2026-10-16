# Progress

Updated 2026-10-16.

## Actual state

**Phases 0–2: DONE. Phase 3: NOT_STARTED.** Phase 2 was started from the supplied handoff in a new session. The user confirmed the authentication/session model, then explicitly changed administration to a shared password with no email or individual accounts. That later instruction governs the implementation.

The npm workspace contains React/Vite/Tailwind/shadcn, Fastify, shared Zod contracts, PostgreSQL/Drizzle, ten foundation tables and three additive authentication tables. Git remains on main without commits or a remote. The original local development servers and database remain available. Temporary browser-test servers and their disposable databases were removed.

## Implemented

- Password-only administration login for admins and guarantors, with the same permissions and shared `Administrace` identity. No email, signup or individual credential model.
- Local hidden-prompt `admin:set-password` command for initial setup/replacement; replacement atomically revokes all admin sessions. `admin:revoke-sessions` keeps the password while revoking existing sessions. No real/default password was seeded during implementation.
- PostgreSQL sessions with 256-bit random tokens stored only as hashes, 12-hour absolute expiry, per-browser login rotation, idempotent logout, expiry/revocation checks and database-backed admin guards.
- HttpOnly/SameSite cookies, Secure host-only HTTPS cookies, exact-origin checks, custom request header, bounded password hashing and login throttling. Generic dependency errors fail closed.
- Additive `0001_regular_warbound.sql` adds singleton `admin_access`, event-scoped `juror_access` secrets, and exactly-one-actor `sessions`. Existing foundation migration and voting constraints remain intact.
- Juror backend preparation: shared typed identities, hashed secret storage, event-safe lookup, session references and tests for duplicate-name/event separation. No public juror-entry endpoint, link issuance workflow or wizard is implemented yet.
- Czech login UI with shared tokens and shadcn Button/Input, password visibility control, loading/error/retry, session restoration/expiry, logout and accessible focus. The authenticated screen confirms access and describes future event management without fake data.
- Root setup instructions, authentication wiki, updated decisions, phase plan and handoff.

Main files: `apps/api/src/modules/auth/{crypto,service,routes,operator}.ts`, `apps/api/src/{app,config,server}.ts`, database schema/migration, `packages/contracts/src/index.ts`, `apps/web/src/modules/auth/AuthScreen.tsx`, UI Input and API transport.

## Validation actually performed

| Check                              | Result                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial baseline `npm run check`   | PASS: four workspace typechecks, lint/format, 6 fast tests and both builds before authentication changes.                                                                 |
| Initial baseline `npm run test:db` | PASS: 14 PostgreSQL checks. The first sandboxed attempt was blocked by local-network permissions; the authorized rerun passed.                                            |
| Final `npm run check`              | PASS: four workspace typechecks, lint/format, 12 fast tests and both production builds.                                                                                   |
| `npm run test:db`                  | PASS: 26 checks: 14 foundation and 12 authentication integration tests, using independent disposable databases.                                                           |
| `npm run db:migrate`               | PASS: reviewed additive migration applied to the existing local development database.                                                                                     |
| `npm run db:generate`              | PASS: no schema drift after generating the additive migration.                                                                                                            |
| Operator CLI                       | PASS against a disposable database: hidden first/repeat prompts, successful set-password without echo, and revoke-sessions command.                                       |
| Manual browser checks              | PASS: real login, incorrect-password feedback/focus, session restoration after refresh, logout, keyboard submit/visibility toggle, unavailable server and retry recovery. |
| Responsive checks                  | PASS: desktop, 375×812 portrait and 812×375 landscape; no horizontal overflow at tested sizes; input/buttons measured 44 px high. Temporary viewport override reset.      |
| Dependency installation audit      | PASS: zero reported vulnerabilities when the two official Fastify plugins were installed.                                                                                 |

No automated browser E2E suite, full accessibility audit, production deployment or multi-instance operations testing was performed. Browser tests used temporary credentials in an isolated database; none were copied into development configuration.

## Review findings and resolutions

- Added row locking and credential-hash rechecks so password replacement and login serialize correctly. If replacement revokes a just-created login session, login returns unauthorized rather than an internal error. A real concurrent integration test covers this boundary.
- Preserved retryable 503 status for password-hashing capacity errors; added a focused regression test. Session-store failures never grant access or expose database details.
- Removed an unnecessary dynamic import after it caused a build warning and then an unused-import typecheck failure. The final static import passes the complete checks without that warning.
- Moved login errors beside the password field, retained entered input, and verified programmatic focus/keyboard behavior.
- Reviewed new source, migration, contracts and scope directly because Git has no baseline commit. No event CRUD, D21 logic, wizard submission or unrelated refactor was introduced.

## Known limits

The development shared password still needs to be chosen by an operator using `npm run admin:set-password`. This is initial setup, not a seeded/demo credential. Shared access cannot identify which person performed an action. Admin and guarantor have equal rights by the user's instruction.

Juror link lifetime, issuance and redemption must be finalized before exposure in the relevant later phase. Q02 and Q04–Q11 remain open for their affected phases. Login throttling is process-local; proxy/hosting configuration and expired-session retention/cleanup remain operational work. The authenticated screen has no event-management features yet.

## Phase Completion Report

**Phase:** 2 — Authentication & Sessions. **Status:** DONE.

**Implemented / Architecture:** Shared-password administration, approved 12-hour server sessions, protected endpoints, operator setup/revocation, login UI, juror backend preparation and additive storage, as detailed above.

**Files / Modules:** API auth, configuration/server, database schema/migration, shared contracts, web auth and shared Input, documentation.

**Validation:** Actual commands/results are in the table. Automated E2E and production operations were not run.

**Review findings:** Concurrent replacement/login, retryable errors, imports and form feedback were reviewed and corrected. No known Phase 2 blockers remain.

**Acceptance criteria:** Login/logout, unauthorized rejection, consistent expiry/revocation, approved shared admin/guarantor permissions, auth tests, shared contracts, juror preparation, usable login UI, validation, review and handoff are complete.

**Next phase:** 3 — Event & Jury Management, only in a new user-started session after the relevant Q05/Q10 decisions. Phase 3 has not started.

**Handoff:** Updated plan.md, progress.md, decisions.md and next-session.md. Suggested commit message: `feat: add shared-password administration and server sessions`. No commit performed.

## Phase 2 routing follow-up — DONE, 2026-10-16

The user requested a juror-first home page and a separate direct admin URL. `/` now renders `JurorLanding`; `/admin/login` renders the existing password/session screen. Neither the public page nor unknown paths exposes an admin navigation link. A shared `AppHeader` keeps branding consistent; browser titles match the page. Link redemption and voting remain later-phase work.

Validation: `npm run check` PASS (four workspace typechecks, lint, formatting, 12 tests and both builds). Browser checks PASS for root-page content/no admin link, direct and refreshed admin login, home navigation, unknown path, and mobile layout. Database tests were not rerun for this frontend-only adjustment; their prior Phase 2 result above remains historical. Review found no authorization changes or new dependencies. Plan, decisions and handoff updated; Phase 3 remains NOT_STARTED. No commit made.
