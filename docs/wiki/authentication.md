# Authentication and sessions

Phase 2 implementation, updated 2026-10-16. The user's later password-only instruction supersedes the earlier email/password choice.

## Approved access model

Administrators and guarantors share one administration password and identical permissions. No email, username, individual account, signup, invitation, or external identity provider is required. A single display identity (`Administrace`) represents all administration sessions. Individual attribution is therefore unavailable; future audit records must not imply that a named person was identified.

Jurors will use unique organizer-issued secret links scoped to a juror and event. Names are display labels and may repeat. Phase 2 prepares hashed-secret storage, event-safe lookup, typed juror identities and session ownership. Issuance, link validity/expiry policy, delivery, redemption, category loading and functional link entry are not implemented. Confirm the remaining link lifecycle details before exposing them in Phases 3/5; no delivery mechanism or reusable-link policy has been silently selected.

## Browser pages

- `/` is the public juror landing page, explaining personal access links and organizer assistance. It has no administration link or password field.
- `/admin/login` is the direct administration/guarantor login URL. Refresh and direct navigation work; the brand link returns to the juror home page.
- Other paths show a not-found screen instead of the administration form.

This routing follow-up was explicitly requested by the user. The juror landing is informational; secret-link redemption and the voting wizard remain later-phase work. The administrative API still requires an authenticated session independently of the browser URL.

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
- Each session has exactly one administration or event/juror owner, database-enforced references, creation time, 12-hour absolute expiry and optional revocation time. Reads do not extend expiry.
- Cookies use `HttpOnly`, `SameSite=Strict`, `Path=/`, and a 12-hour lifetime. HTTPS uses `Secure` and the `__Host-d21-session` name without a Domain attribute. Local HTTP uses `d21-session`.
- `APP_ORIGIN` is the exact browser origin, without a trailing slash. Default: `http://127.0.0.1:5173`. HTTP configuration is restricted to localhost/127.0.0.1. Use an HTTPS origin outside local development.
- State-changing requests require `X-D21-Request: 1`. A supplied Origin must exactly match APP_ORIGIN, and cross-site Fetch Metadata is rejected. No cross-origin CORS access is enabled. This applies to login and logout too. JSON requests through the web client include the required header.
- Login is limited to 10 requests per minute per IP per API process. Password work is capped at two concurrent derivations to bound memory; overload returns a retryable 503. The rate-limit cache is bounded. Shared multi-instance limits and trusted-proxy configuration remain deployment work.
- Password storage uses salted Node scrypt (`N=131072, r=8, p=1`, 64-byte key), constant-time verification, and the same derivation for missing setup. Parameters follow the [OWASP password-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Cookie/expiry choices follow the approved model and [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
- Successful login replaces the browser's prior session. Logout revokes the current session and clears the cookie; repeated logout is safe. Password replacement serializes with login and invalidates previous sessions.
- Administrative requests check database-backed authorization. Juror sessions receive 403 on administration routes. Expired, revoked or fabricated sessions receive 401. Session-store failures fail closed with a generic error.

Future administrative modules must run within the `registerAuth` scope (to inherit cookie parsing and origin checks) and use `adminGuard`. UI visibility is not an authorization boundary. Juror voting authorization must still check the current allowed jury-group relationship in later phases.

## API

| Route                    | Result                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/admin/login` | Strict `{ password }` body; sets cookie and returns authenticated session. Incorrect password: 401; invalid body: 400; disallowed origin: 403; throttling: 429; hash capacity: 503. |
| `GET /auth/session`      | Authenticated principal and absolute expiry, or `{ authenticated: false }`; invalid cookies are cleared.                                                                            |
| `POST /auth/logout`      | Revokes current session, clears cookie, returns 204.                                                                                                                                |
| `GET /admin/access`      | Guarded administration identity and `administer` permission; no placeholder event data.                                                                                             |

Auth responses use `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Public health/readiness endpoints are unchanged. `POST /auth/juror/start` remains Phase 5, where its wizard/category response can be implemented truthfully.

## Storage and validation

`0001_regular_warbound.sql` is additive: it adds `admin_access`, `juror_access`, and `sessions` to the ten foundation tables. The baseline migration is unchanged. Credential rotation and session revocation use transactions; names never identify jurors. No ballot or D21 behavior is introduced.

Tests cover credential verification and salts, bounded password work, contracts, failed dependencies, real login/logout, cookies, expiry, revocation, replacement/concurrent login, origin checks, throttling, duplicate-name jurors and event isolation. Integration tests create and drop only their own generated databases.

Expired/revoked session rows are retained for now. Cleanup/retention, multi-instance rate limiting, hosting and operational auditing remain explicit future operations work. The basic authenticated screen confirms access; event management begins in Phase 3.
