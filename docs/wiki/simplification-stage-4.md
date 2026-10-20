# Simplification Stage 4 — editable Jurors table

**DONE locally.** Authorized 2026-10-18 for local implementation, validation, review and handoff, including automatic T/V groups. Stages 1–3 remain deployed as `a79338c`; Stage 4 has no publication authorization. Actual completion evidence is in [progress](../implementation/progress.md).

**Deployment update, 2026-10-19:** published in separately approved release `4995a2d`, Render deploy `dep-dbat50dg1s2s73dec4a0` (live). Hosted Jurors save/automatic groups and combined-category save/reload checks pass; private pre/post backups and exact original-row preservation pass. Local-only authorization statements describe the original implementation boundary; see the current [release record](../implementation/progress.md#stages-45-release--done-2026-10-19).

## Organizer workflow

Open **Příprava → Porotci**. Edit names and T/V assignments inline, add **Nový porotce**, or use **Vložit ze spreadsheetu**. Each new row receives one random stable membership UUID. Duplicate names remain distinct people in the roster; names never authenticate or match identities. Choose T or V explicitly. New rows can be removed locally; existing memberships are never removed by omitting a table row.

**Uložit tabulku** validates every row and commits all table changes in one transaction, or none. Names retain the trimmed 1–200 character rule. Field errors remain beside inputs and in a focused linked summary until validation runs again. Failed requests retain values and IDs for retry. Pending requests disable editing; 401/403 clear the protected editor. Search hides rows only; saving always includes the complete table, and validation clears search to expose invalid fields.

Spreadsheet input is headerless tab-separated **name, Technická/Veřejná** text; legacy T/V codes remain accepted. It supports quoted tabs/newlines, escaped quotes, Unicode, duplicate names and literal formula-like names. Missing/invalid assignments and interior blank rows remain errors; extra columns or malformed quoting are rejected. Trailing empty records are ignored. Preview and adding the preview write nothing. Each valid preview is explicitly added to the editor and then saved. No XLSX/CSV upload or identity inference. Preview creates no credentials; explicit successful save now creates first links as described below.

Save before leaving. Edits and preview exist only in component memory. A browser unload warning is attempted for dirty rows; browser retention/confirmation is browser-controlled. No autosave or durable local draft is promised.

## Automatic T/V groups

Existing behavior permits one immutable code T and one V per event, with renameable descriptive names and no group deletion. The table creates **only missing groups**, using the existing defaults **Technická porota** and **Druhá část poroty**, during an explicit successful save on an unfrozen event. Existing group UUIDs, names and memberships are preserved. Saving an empty table can explicitly create the missing groups; the UI explains this before saving.

Event creation, GET, preview, navigation, cancelled edits and failed saves create nothing. Group creation and all juror changes roll back together. Legacy group create/rename APIs remain compatible. Existing group rename controls remain separate explicit saves below the table, available when table edits have been saved or discarded.

Once voting starts or any ballot exists, the sticky event roster freeze still rejects additions, reassignment and removal. Frozen historical events with a missing group are **not repaired or unfrozen**. Name corrections still work; an exact retry after a concurrent freeze can confirm already-saved state without writes. Activation still requires equal T/V groups of 5, 7 or 9 and all existing voting readiness conditions; this stage changes none of those rules.

## Current-data comparison and retries

Clean refresh loads current data. Dirty refresh keeps edits and loads the current roster for comparison. A stale save blocks further saving until the organizer explicitly loads and reviews current values, group names/UUIDs and freeze state. Both local and current rows expose IDs to distinguish equal names.

**Použít moje změny po kontrole** keeps locally changed whole rows, adopts current untouched rows and remote additions, and retains local new UUIDs. It does not save; another writer can conflict again. An untouched externally removed member disappears when the current roster is adopted. An edited externally removed saved membership cannot be recreated through comparison. If a concurrent freeze would make local additions/assignments illegal, applying local changes is disabled; discard/load current and re-enter allowed name corrections. Discarding the complete local table separately requires confirmation.

Client UUIDs keep retries addressed to the same memberships. If the complete normalized desired IDs, names and group assignments already equal current state (and automatic groups have been satisfied, or the roster is frozen), replay returns the current snapshot without timestamp or previously-issued credential changes. The current automatic-link update can create only a missing first credential and its issuance audit. Otherwise the exact base fingerprint must match. An uncertain success followed by another write requires comparison; retries never generate replacement IDs automatically.

## API and preservation

- `GET /events/:eventId/jurors/table`: strict empty query, returns `{version, groups, jurors, locked}`. Jurors include only existing public membership fields and `access: none | legacy | stored | revoked` metadata.
- `PUT /events/:eventId/jurors/table`: strict empty query/body `{baseVersion, rows:[{id,displayName,groupCode}]}`. UUIDs normalize to lowercase; duplicate IDs and unknown claims reject. Field-invalid rows return `{status:'invalid', issues:[{rowId,field:'displayName'|'groupCode'}]}` without writes; success returns `{status:'saved',snapshot}`.
- Stale/omitted/foreign-ID conflicts return `409 JUROR_TABLE_CONFLICT`; forbidden membership changes on a current frozen snapshot return `409 ROSTER_LOCKED`. Existing guard codes and sanitized dependency failures remain unchanged. The complete JSON body retains the 64 KiB limit (413); no partial save is attempted.

The SHA-256 snapshot fingerprints event identity, sticky freeze state, existing group IDs/codes/names and stored juror records including precise PostgreSQL update timestamps. Access metadata is excluded from the version, so link operations alone do not create roster conflicts. All reads/saves use the existing event lock, with administration authorization after waits and before completion. Existing juror/group APIs invalidate snapshots through their stored changes. Legacy roster/list response shapes and alphabetical ordering remain compatible; table rows use creation time and ID for stable ordering.

The current [automatic-link update](automatic-juror-links.md) creates first links during explicit saves and removes the Osobní přístup panel. Copy, fallback, direct confirmed replacement/restoration/revocation and confirmed membership removal remain beside saved jurors. Finish table edits before these operations; opening an exceptional link/removal confirmation or group-name form also pauses table editing to prevent delayed refreshes from replacing edits; a new row offers access controls only after saving. Membership removal stays a separate confirmed operation subject to the original freeze and RESTRICT references, never a table omission or cascade. The table creates encrypted links only for members with no credential history; it creates no sessions and never revives revoked access. Existing juror/group IDs, encrypted and legacy links, sessions, ballots, entries and history survive descriptive correction. Read [Stage 1 key/access prerequisites](simplification-stage-1.md).

No migration, database table, dependency, voting-rule, D21, identity, submission, revision, unlock, result/tie/finality or XLSX change. Categories/combined setup/bulk copying/duplication/new readiness remain later work requiring a new explicitly started session. Full screen-reader/native-device/all-browser, load/multi-instance, native spreadsheet and hosted Stage 4 checks are not claimed; see progress for actual checks and limits.
