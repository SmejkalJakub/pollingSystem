# Simplification Stage 1 — juror access and copying

**Release update, 2026-10-18:** deployed with Stages 1–3 as `a79338c` on the existing free test service. Original local-only boundaries below are historical. See [release evidence and limits](../implementation/progress.md#stages-13-release-verification--2026-10-18).

Approved 2026-10-18. This local session supersedes the earlier Phase 2/5 juror 12-hour session and one-time-only link-display decisions. Phases 0–13 remain completed historical work. No subsequent simplification stage, commit, push, deployment, cloud operation or live data change is authorized by this session.

## Juror sessions

New juror sessions have `sessions.expires_at = NULL` and public `expiresAt: null`. There is no application-imposed absolute or inactivity timeout. Administration sessions still have their unchanged 12-hour absolute expiry, in PostgreSQL, contracts, cookies and the administration UI.

Juror cookies retain HttpOnly, SameSite=Strict, host-only Path=/ and Secure/`__Host-` on HTTPS. They omit Max-Age and Expires (browser-session cookies), so the application substitutes no arbitrary cookie timeout. Browsers may clear cookies on closing, restart, privacy cleanup or browser policy; indefinite browser retention is not promised. A retained cookie restores the database session after an application restart. If the browser loses it, the same active personal link allows re-entry and saved ballots are restored normally. No tokens are put in browser storage.

Logout still revokes only the current session. Replacing or revoking a juror's access invalidates that event juror's links and all sessions. Other jurors/events remain isolated. Current membership/group permissions and transaction-time authorization checks remain authoritative, including after lock waits. Voting closure prevents new saves/submissions; it never becomes an access timeout. All D21, roster/configuration freezes, revision/replay, results/ties and ballot/audit history rules are unchanged.

## Migration and existing sessions

Additive `0005_chief_pretty_boy.sql` makes expiry nullable, retains the dated-expiry integrity check and requires non-null expiry for administration sessions. It adds nullable `juror_access.encrypted_token` and converts only **unrevoked juror sessions whose expiry is still in the future when the migration runs** to null. Previously expired and revoked sessions retain their original dates/revocation and remain unusable; they are never automatically revived. Existing admin expiry, ballots, entries and audit history are preserved.

An old browser cookie can still retain its original 12-hour browser expiration even after the corresponding server session becomes untimed. Re-enter using the same active personal link to receive the new cookie behavior. Migration cannot edit cookies already stored in a browser. No automatic redemption, secret recovery from hashes or mass logout occurs. The migration runs once through Drizzle history; repeating the migrator does not extend or revive older sessions.

Apply it before starting the updated API. Do not roll back to code that requires non-null juror expiry after migration; retain the prior image and database backup for a separately planned recovery. Never edit existing migrations 0000–0004.

## Organizer workflow

Every roster row has **Kopírovat odkaz** directly beside the juror. One activation fetches and copies the current active link, without opening a panel or confirmation. Repeating it returns the same secret and makes no writes, audit additions or session changes. Success is announced through an atomic status message; clipboard failure exposes, focuses and selects a labelled read-only link for Ctrl+C/⌘C. **Skrýt odkaz** clears it and returns focus. Links remain in transient memory only; no automatic link-bearing screenshots, telemetry or browser storage.

Current deployed update: explicit juror saves automatically create only first links; the **Osobní přístup** panel is removed. Rows distinguish never-issued, legacy, stored and revoked access. Replacement/restoration and revocation use direct confirmed row actions. Opening/cancelling changes nothing; failed writes roll back the complete transaction. See [automatic links and transition](automatic-juror-links.md).

Legacy hash-only links keep working for entry and recovery. Their original secrets cannot be reconstructed. To enable future copying, an organizer must explicitly choose **Nahradit odkaz**, confirm that earlier links/sessions will stop working, and privately deliver the replacement. No copy action silently upgrades/replaces a link. A lost new-issuance response can now be recovered through Copy; do not replace access merely to copy it.

## Encryption configuration and backup

New links retain their SHA-256 authentication hash and add an AES-256-GCM encrypted copy of the random token. Each encryption uses a fresh random 96-bit nonce and 128-bit authentication tag. The versioned envelope includes a key ID; authenticated associated data binds it to the event UUID, juror UUID and token hash. Tampered or swapped envelopes and wrong/missing keys fail closed. Redemption authenticates hashes and does not depend on the encryption keys.

Set these **server-only process environment variables**, or load them from a private environment file **outside the repository/checkout**:

- `JUROR_LINK_KEYS`: JSON object mapping stable key IDs to independently generated random 32-byte keys encoded as 64 hex characters.
- `JUROR_LINK_ACTIVE_KEY_ID`: the ID used for new encryption; it must exist in that object. IDs contain 1–64 letters, digits, `_` or `-`.

There is no default or startup-generated key. Both absent allows the app to run: existing entry/sessions and revocation still work; generation/replacement and copying encrypted links return sanitized `503 LINK_STORAGE_UNAVAILABLE`. They never return a partial secret or silently rotate access. Supplying incomplete or malformed configuration stops startup with variable names only. Restore the correct keys to recover copying. A legacy link returns `409 LEGACY_LINK`, not a misleading key error.

For local setup, create a private external key file once (the command prints no key and refuses to overwrite an existing file):

```sh
mkdir -p "$HOME/.config/d21"
node --input-type=module -e 'import {randomBytes} from "node:crypto"; import {writeFileSync} from "node:fs"; import {homedir} from "node:os"; writeFileSync(homedir()+"/.config/d21/link-keys.env", "JUROR_LINK_KEYS="+JSON.stringify({initial:randomBytes(32).toString("hex")})+"\nJUROR_LINK_ACTIVE_KEY_ID=initial\n", {mode:0o600,flag:"wx"})'
```

Run the API with `node --env-file="$HOME/.config/d21/link-keys.env" apps/api/dist/server.js` after building/migrating. For Vite development, run `node --env-file="$HOME/.config/d21/link-keys.env" node_modules/concurrently/dist/bin/concurrently.js --kill-others -n api,web "npm run dev -w @d21/api" "npm run dev -w @d21/web"`; child processes inherit the private variables. Root `.env`/credentials remain untouched. With Compose add the external file after the normal host settings: `docker compose --env-file deploy/.env.host --env-file "$HOME/.config/d21/link-keys.env" -f compose.host.yaml up -d --build --wait`. The checked-in Blueprint declares private variables for a future authorized deployment; no live setting was changed here.

Back up **both** PostgreSQL and the external key ring. Store key backups separately from database dumps and source control, with restricted permissions/encrypted storage and owner-controlled recovery. Database-only restore preserves link entry (hashes), ballots/history and sessions, but cannot recover encrypted secrets without matching keys. Keep the exact keys and IDs across application/host restarts and restores. Changing a key's value under the same ID breaks recovery.

For rotation, add a new random key under a new ID, keep all old keys, then change only the active ID. Older ciphertext remains decryptable. There is no automatic re-encryption or key retirement job. Do not delete old keys while any retained live link or backup may require them. A lost key does not revoke a link; explicit replacement is a separate consequential organizer decision.

Personal links grant juror access. Deliver them privately. Keys, plaintext tokens and ciphertext never enter ordinary roster/status/results-export responses, audit context or routine application logs. Initial issuance and the dedicated authorized copy response return a fragment URL. The later [2026-10-20 event-flexibility update](event-flexibility.md) additionally provides an explicit private juror-links XLSX containing existing plaintext links; it is separate from results export. Response caching is disabled. Do not add analytics/request-body/response logging around these routes.

## Protected copy API

`POST /events/:eventId/jurors/:jurorId/access/copy`, strict `{}` body and empty query, returns strict `{url}`. It requires the current administration cookie, same-origin/custom-header checks, scoped event/juror lookup and fresh administration authorization after the shared event lock and before transaction completion. Missing session: 401; juror: 403; wrong origin/header: 403; malformed/extra claims: 400; wrong-event/missing membership: 404; no active link: `409 NO_ACTIVE_LINK`; legacy hash-only: `409 LEGACY_LINK`; unavailable keys/corrupt ciphertext: sanitized `503 LINK_STORAGE_UNAVAILABLE`. GET is unavailable. The read shares the existing event-lock boundary with replacement/revocation, returns no stale pre-lock secret and changes no data.

Roster jurors add metadata `access: none | legacy | stored | revoked`; individual juror create/edit/list contracts remain unchanged and contain no secret. `stored` means ciphertext exists, not that the deployment has its required decryption key; key availability is checked by the protected copy operation.

## Validation and limits

Actual commands, failures, results, review and cleanup are recorded in [progress](../implementation/progress.md). Browser checks use disposable local databases and private in-memory test keys; they do not validate a live deployment. Browser retention, full screen-reader/native-device coverage, multi-instance rate limiting and owner backup operations are not guaranteed by these tests. Next-stage workspace/table changes require a new user-started session.
