# Authentication and sessions

Current behavior includes simplification Stage 1, updated 2026-10-18. The Phase 2/5 records below are superseded only where noted. The user's later password-only instruction supersedes the earlier email/password choice.

## Approved access model

Administrators and guarantors share one administration password and identical permissions. No email, username, individual account, signup, invitation, or external identity provider is required. A single display identity (`Administrace`) represents all administration sessions. Individual attribution is therefore unavailable; future audit records must not imply that a named person was identified.

Jurors use unique organizer-issued secret links scoped to a juror and event. Names are display labels and may repeat. The current local automatic-link update creates first links atomically with explicit juror saves, with direct copying and manual private delivery. Existing direct confirmed replacement/revocation policies remain; [workflow and transition](automatic-juror-links.md). Phases 5 and Stage 1 established reusable links **without expiry**, juror sessions **without application-imposed timed expiry**, logout/recovery, regeneration and revocation. Regeneration/revocation invalidates all of that event juror’s links and sessions. The secret is delivered in a URL fragment; new links store an authentication hash plus an encrypted recoverable token for authorized one-click copying. Legacy hash-only links remain usable. See [Stage 1 migration, cookies, keys and backup requirements](simplification-stage-1.md). See [juror entry and wizard](juror-wizard.md) for the approved lifecycle and complete workflow.

## Browser pages

- `/` is the public juror entry page, accepting personal secret links and restoring an existing juror session. It has no administration link or password field.
- `/wizard/review` and `/wizard/confirmation` show protected saved review and current confirmation; selected final submission remains independently authorized per category.
- `/wizard` and `/wizard/steps/:stepId` provide protected welcome/category navigation with current T/V authorization. Draft categories are hidden; closed/archived authorized categories remain visible as unavailable.
- `/admin/login` is the direct administration/guarantor login URL. Refresh and direct navigation work; the brand link returns to the juror home page.
- `/admin/events` and `/admin/events/:eventId` expose the Phase 3 event/roster screens to administrators. Missing sessions use the same login form.
- `/admin/votings/:votingId` exposes Phase 4 voting configuration, T/V permissions and guarded lifecycle actions, with the same session recovery. These APIs remain protected independently of browser routing.
- Other paths show a not-found screen instead of the administration form.

The root/admin separation was explicitly requested by the user. Phase 5 now provides secret-link redemption and the read-only wizard foundation. The administrative API still requires an authenticated session independently of the browser URL.

## Set or replace the shared password

Apply migrations first, then run in an interactive terminal from the project root:

```sh
npm run admin:set-password
```

The command prompts twice with terminal echo suppressed. Use a passphrase of 15–256 characters. Do not pass passwords as command-line arguments or environment variables. The command creates the shared identity on first use; later uses atomically replace the password and revoke all administration sessions. It never prints the submitted password. There is no default password, and the development database was not seeded with a credential during implementation.

To revoke administration sessions while keeping the password:

```sh
npm run admin:revoke-sessions
```

Holders of the current password can sign in again. Replace the password to withdraw future access. Both commands require the local environment/database connection. They are source-run operator tools, independent of the built HTTP server. No public password-management endpoint exists.

## Sessions and authorization

- 32 random bytes form each opaque browser session token. Only its SHA-256 hash is stored in PostgreSQL; tokens are not returned in JSON or stored in browser JavaScript storage.
- Each session has exactly one administration or event/juror owner, database-enforced references, creation time and optional revocation time. Administration has a 12-hour absolute expiry; new juror sessions have null expiry. Migration extends only currently valid, unrevoked juror sessions. Expired/revoked sessions stay invalid. Reads do not extend expiry.
- Cookies use `HttpOnly`, `SameSite=Strict`, `Path=/`, and a 12-hour lifetime for administration. Juror cookies omit Max-Age/Expires; browsers control retention and personal links allow re-entry. HTTPS uses `Secure` and the `__Host-d21-session` name without a Domain attribute. Local HTTP uses `d21-session`.
- `APP_ORIGIN` is the exact browser origin, without a trailing slash. Default: `http://127.0.0.1:5173`. HTTP configuration is restricted to localhost/127.0.0.1. Use an HTTPS origin outside local development.
- State-changing requests require `X-D21-Request: 1`. A supplied Origin must exactly match APP_ORIGIN, and cross-site Fetch Metadata is rejected. No cross-origin CORS access is enabled. This applies to login and logout too. JSON requests through the web client include the required header.
- Login is limited to 10 requests per minute per IP per API process. Password work is capped at two concurrent derivations to bound memory; overload returns a retryable 503. The rate-limit cache is bounded. Shared multi-instance limits and trusted-proxy configuration remain deployment work.
- Password storage uses salted Node scrypt (`N=131072, r=8, p=1`, 64-byte key), constant-time verification, and the same derivation for missing setup. Parameters follow the [OWASP password-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Cookie/expiry choices follow the approved model and [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
- Successful login replaces the browser's prior session. Logout revokes the current session and clears the cookie; repeated logout is safe. Password replacement serializes with login and invalidates previous sessions.
- Administrative requests check database-backed authorization. Juror sessions receive 403 on administration routes. Expired, revoked or fabricated sessions receive 401. Session-store failures fail closed with a generic error.

Future administrative modules must run within the `registerAuth` scope (to inherit cookie parsing and origin checks) and use `adminGuard`. UI visibility is not an authorization boundary. Phase 5 juror category reads check the current allowed jury-group relationship server-side. Later ballot operations must preserve and repeat that check.

## API

| Route                    | Result                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/admin/login` | Strict `{ password }` body; sets cookie and returns authenticated session. Incorrect password: 401; invalid body: 400; disallowed origin: 403; throttling: 429; hash capacity: 503. |
| `GET /auth/session`      | Authenticated principal and `expiresAt` (absolute administration date, null for untimed jurors), or `{ authenticated: false }`; invalid cookies are cleared.                        |
| `POST /auth/logout`      | Revokes current session, clears cookie, returns 204.                                                                                                                                |
| `GET /admin/access`      | Guarded administration identity and `administer` permission; no placeholder event data.                                                                                             |

Auth responses use `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Public health/readiness endpoints are unchanged. `POST /auth/juror/start` is implemented in Phase 5 with strict `{eventId,token}`, a protected session cookie and `{session,wizard}` response. Issuance/revocation and wizard endpoints are documented in [juror entry](juror-wizard.md).

## Storage and validation

`0001_regular_warbound.sql` is additive: it adds `admin_access`, `juror_access`, and `sessions` to the ten foundation tables. The baseline migration is unchanged. Credential rotation and session revocation use transactions; names never identify jurors. No ballot or D21 behavior is introduced.

Tests cover credential verification and salts, bounded password work, contracts, failed dependencies, real login/logout, cookies, expiry, revocation, replacement/concurrent login, origin checks, throttling, duplicate-name jurors and event isolation. Integration tests create and drop only their own generated databases.

Expired/revoked session rows are retained for now. Cleanup/retention, multi-instance rate limiting, hosting and operational auditing remain explicit future operations work. The authenticated workspace now provides [Phase 3 event and jury management](event-jury-management.md).

Phase 5 requires no new migration. Its event-first link/session mutations and shared-event wizard reads preserve the existing storage and sticky roster lock. Session reads inside a transaction use statement-time expiry and the existing connection. Link/session revocation does not delete history or ballots.

Phase 8 administrator ballot listing/unlock routes inherit the same guard/origin/no-store scope and recheck the admin session inside the event-first transaction after lock waits. Jurors cannot unlock through either UI or API. This uses the already approved shared administrator/guarantor identity, without individual attribution or expanded roles. [Submission/unlock details](ballot-submission.md).

Phase 9 adds `/wizard/review` and `/wizard/confirmation` browser pages and protected review/final-submit APIs. They reuse current juror sessions/group checks and inherited no-store/origin/header guards. Review checks expiry after shared event-lock waits; each independently submitted category rechecks authorization after its exclusive event-lock wait. Global authorization loss stops later categories and clears protected UI. No identity/session-lifetime change. [Contract](multi-category-review.md).

Phase 10 dashboard browser routes are `/admin/events/:eventId/dashboard` and `/admin/dashboard/votings/:votingId`; API `/dashboard/overview?eventId=...` and `/dashboard/votings/:votingId` inherit the existing administration guard/no-store scope and recheck session/expiry after shared event-lock waits. No new role, identity or lifetime. Dashboard expiry removes protected data. [Details](operational-dashboard.md).

## Phase 12 — 2026-10-18

Phase 12 binds event/roster/voting/team requests to the cookie and checks current shared-admin access after acquiring the event lock and before committing. Ballot administration/dashboard/results share this helper. Event creation/listing use an authorized transaction. Link mutations audit only counts/identities, never secrets. Export checks authorization again after ZIP generation. No session-lifetime or identity change. [Operational contract](operational-hardening.md).
