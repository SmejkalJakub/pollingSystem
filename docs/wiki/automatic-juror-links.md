# Automatic juror links

Authorized bounded implementation session, 2026-10-19. This supersedes the manual generation/panel workflow in Stages 1 and 4. See [current validation and publication status](../implementation/progress.md). No subsequent phase or publication is authorized.

## Organizer workflow

In **Příprava → Porotci**, add a juror or paste and review rows, then choose **Uložit tabulku**. The successful save creates an encrypted reusable personal link for each membership that has never had a credential. **Kopírovat odkaz** is immediately available beside the saved juror. No **Osobní přístup** entry, panel, status-fetch or separate initial-generation confirmation remains. Link delivery remains private and manual; no bulk distribution is added.

Existing never-issued memberships show that the link will be created on save. The table can be saved for those links even without name/group edits, including on frozen rosters without changing their membership. Existing encrypted links are retained, so saving names, assignments, other jurors or retrying a successful save never rotates those links or revokes sessions. Copy remains a protected read of the same current link. Clipboard failure focuses and selects a labelled read-only fallback; hiding it clears the displayed secret and restores focus.

Every successful initial issuance records `juror_access.issued` with the current shared administration actor and zero replaced links/revoked sessions. It creates no juror session. No token, URL, encryption envelope or key enters roster/list/export/audit responses or browser storage. Plaintext is returned only through the existing dedicated authorized copy/exceptional replacement responses and held transiently.

## Existing and exceptional access

The established Stage 1 transition and revocation policies remain authoritative:

- **Stored:** ordinary saves and copies preserve the exact link and every existing session. A missing decryption key or corrupt envelope is an error; neither saving nor copying silently replaces access.
- **Legacy:** the hash-only link continues working. Its secret cannot be reconstructed. **Nahradit odkaz** opens one direct confirmation explaining that all earlier links and sessions will stop working. Cancelling changes nothing; confirming uses the existing explicit replacement transaction. Then use Copy and privately deliver the new link.
- **Revoked:** roster metadata explicitly reports `revoked`. Saving never restores it. **Obnovit odkaz** uses the same direct consequential replacement confirmation; this is an explicit organizer action, not automatic reactivation.
- **Never issued:** roster metadata reports `none`. An explicit successful table save creates its first credential; reads, event creation, previews, adding unsaved rows and cancellation do not.

**Zrušit odkazy a přihlášení** retains the existing confirmed revocation of all links/sessions for that event juror. Replacement/revocation keep ballots and history. Confirmation pauses table editing, clears any displayed previous fallback and restores focus after cancellation/completion. After a lost exceptional replacement response, cancel the confirmation, refresh the roster and copy the stored link instead of replacing it again.

Membership removal is unchanged: separate confirmation, sticky freeze and restrictive references. Automatic credentials therefore also protect new saved memberships from physical removal. There is no cascade, soft deletion, access/history deletion, event/voting-finish cleanup or new retention policy in this phase.

## Transactions and API

`auth/automatic-juror-link.ts` runs only inside the existing event-first administration transaction. It checks **all credential history**, including revoked records, before generating a fresh random secret, hash, authenticated encrypted envelope and issuance audit. The event lock serializes table saves, creation, replacement, revocation and redemption. Current administration authorization is checked after lock waits and before completion. Invalid fields, stale/conflicting state, foreign IDs, frozen membership changes, missing keys, encryption/storage/audit failure or lost authorization commit no partial roster/group/credential/audit changes.

Table PUT retains strict `{baseVersion, rows:[{id,displayName,groupCode}]}` with stable client UUIDs, full-table atomic validation, omission protection and the 64 KiB request limit. Exact desired-state replay preserves timestamps/identities and all previously issued access. It can create a first link only for a genuinely never-issued member; after successful issuance, retries write nothing. Access metadata is excluded from the roster version and introduces no artificial roster conflict.

The supported individual `POST /events/:eventId/jurors` also creates membership and encrypted link atomically, returning only the public membership record. Its existing `{displayName,juryGroupId}` input remains supported. Clients needing safe creation retries supply optional stable `id`; exact same-event/name/group retries return the same membership/link, including after a freeze or revocation, without reviving access. Reusing that ID with different data or another event returns `409 JUROR_CREATE_CONFLICT`. Requests without an ID create distinct memberships, as before; names never establish identity. PATCH continues to reject identity changes.

Roster/table `access` metadata is `none | legacy | stored | revoked`; the legacy juror list and create/edit responses stay secret-free and keep their public record shape. The existing guarded copy, status, replacement and revoke APIs remain compatible. No schema, migration, dependency, authentication mechanism, jury-size, D21, submission, results or export rule changes.

## Keys and limits

The same externally configured [Stage 1 key ring and separate backups](simplification-stage-1.md#encryption-configuration-and-backup) are required. Missing active keys now also prevent saves that need a first link; the whole transaction rolls back and inputs remain available for retry. Saves containing only credentialed members do not need encryption/decryption and preserve their access when keys are unavailable. Existing hash-based entry, sessions and revocation still work without link encryption keys. Keys are never generated or replaced during normal startup/saving.

Validation uses disposable local PostgreSQL databases and the built app in Chromium across desktop, phone and landscape/reduced motion. Browser cookie retention, full screen-reader/native-device/all-browser/load/multi-instance and hosted validation remain separate limitations. Unsaved edits remain memory-only. [Actual check results, failures, review and handoff](../implementation/progress.md).
