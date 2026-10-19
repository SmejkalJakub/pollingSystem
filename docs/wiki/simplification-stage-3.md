# Simplification Stage 3 — editable Teams table

**Release update, 2026-10-18:** deployed with Stages 1–3 as `a79338c` on the existing free test service. Original local-only boundaries below are historical. See [release evidence and limits](../implementation/progress.md#stages-13-release-verification--2026-10-18).

**DONE locally**, approved 2026-10-18 after read-only inspection found no precise prior Stage 3 boundary. This stage covers Teams only. Jurors/categories tables, automatic T/V groups, combined category setup, bulk assignment/copy/duplication and new readiness tools remain later work. All changes stay local; no commit, push, deployment, cloud/live operation, development migration or credential reset.

## Organizer workflow

Open **Příprava → Týmy**. Edit existing names/descriptions directly, or choose **Nový tým**. New rows have stable random IDs and may be removed before saving. Existing teams have no removal control. Duplicate names remain separate identities. Shared descriptive corrections still appear in all categories, including started ones; original voting item snapshots, ballots and history remain intact.

**Uložit tabulku** saves all pending changes in one transaction. Every row must be valid; any validation, conflict, authorization or database error saves nothing from that attempt. Names retain the existing 1–200 trimmed character rule, descriptions the existing 5,000 trimmed character rule. Errors remain beside fields and in a focused linked summary; correcting text retains the errors until validation runs again. Pending requests disable editing. Network failure retains values for retry; authorization loss clears the protected editor.

**Vložit ze spreadsheetu** accepts pasted tab-separated rows without headers: name, then optional description. It supports quoted tabs/newlines and escaped quotes, retains Unicode and duplicate names, and treats spreadsheet formulas as literal text. Malformed quoting or more than two columns is rejected rather than guessed/truncated. Interior blank rows remain invalid; trailing empty rows are ignored. Preview writes nothing. Explicitly add a valid preview to the editor, then save the whole table. This is clipboard text, not XLSX/CSV file upload or identity matching.

Refreshing a clean table loads current values. Refreshing with local edits keeps those edits and opens the current saved table for comparison. A stale save does the same after an explicit current-data read. Compare the current names, descriptions and IDs, then choose either **Použít moje změny po kontrole** or **Zahodit moje změny a načíst aktuální**. Applying local changes retains locally changed _whole rows_, takes current values for untouched rows, and includes newly added IDs from both versions; it does not save. Another concurrent change can conflict again. No automatic merge or last-writer overwrite occurs. Discarding all local edits separately requires confirmation.

Save before leaving. Unsaved values and preview remain in component memory only; a browser unload warning is attempted for dirty table rows, but browser retention/confirmation is browser-controlled. No autosave or durable local draft is promised. Existing Stage 2 page links and Stage 1 link/key/access behavior remain unchanged.

## API and concurrency

- `GET /events/:eventId/teams/table`: strict empty query, returns `{version, teams}`.
- `PUT /events/:eventId/teams/table`: strict empty query/body `{baseVersion, rows:[{id,name,description}]}`. UUIDs are normalized, duplicate IDs and extra claims are rejected. Field-invalid rows return `{status:'invalid', issues:[{rowId,field}]}` without writes; success returns `{status:'saved', snapshot:{version,teams}}`.
- Existing list/create/PATCH team endpoints remain compatible. Their writes also invalidate table snapshots.

The version is a SHA-256 fingerprint of the event ID and ordered stored team records, including precise PostgreSQL update timestamps. Every read/save uses the existing event lock and fresh administration authorization after waits and before completion. The client version is an optimistic concurrency assertion, never authorization. All current existing IDs must be retained; omission cannot delete. A new ID already owned elsewhere causes `409 TEAM_TABLE_CONFLICT` with full rollback. No name-based upsert or migration/receipt table is added.

Client-generated IDs make retries address the same additions. If the complete normalized desired table already equals current stored IDs/names/descriptions, a retry returns the current snapshot without changing timestamps, even with an older base version. Otherwise the base version must match. If another writer changed the table after an uncertain success, retry conflicts and requires comparison; it never creates replacement IDs automatically. Replaying an already-saved table makes no writes and needs no persistent operation receipt.

Authentication, same-origin/custom-header, no-store and strict contracts remain enforced. Missing/expired/revoked administration sessions return 401; juror/forbidden-origin access 403, missing event 404, malformed shape 400, stale/omitted/foreign-ID conflict 409, oversized body 413 and dependency failure sanitized 503. The existing 64 KiB request limit applies to the complete JSON table. An oversized save retains input and asks for shorter descriptions/fewer new rows; no partial save is attempted.

## Validation and limits

Actual source, PostgreSQL, browser, source/visual review and preservation results are recorded in [progress](../implementation/progress.md). Stage 3 is deployed; see the release record above. No new voting, group-size, identity, submission, revision, unlock/history, result/tie/finality or XLSX rule is introduced. [Stage 1 prerequisites](simplification-stage-1.md) still apply, including external keys and additive migration 0005 before any future authorized deployment.

Stage 4 subsequently implements the approved local [Jurors table and automatic missing T/V groups](simplification-stage-4.md). Earlier later-stage boundary statements above describe the original session only.
