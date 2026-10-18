# Operational hardening and XLSX export

Phase 12, authorized 2026-10-18. See [progress](../implementation/progress.md) for actual validation and completion status.

## Approved scope

The user explicitly excludes deadlines and alerts. The original brief's deadline criterion is superseded by this decision, rather than reported as a passing enforcement check. The nullable legacy `votings.deadline` column stays intact, without an API, UI or enforcement. Existing lifecycle controls determine availability. Existing factual data-problem indicators remain; there are no time or participation-threshold alerts.

Approved interventions are the existing activation, closure/reopening, administrator-only ballot unlocking and juror-link generation/regeneration/revocation. No reset, cancellation, deletion, archive operation, manual winner/tie resolution or publication policy is added. Shared admin and guarantor access remains equal and cannot identify an individual operator.

## Authorization and transactions

The cookie/origin/header/no-store guards still apply. Event, roster, voting and team services now bind the request cookie and recheck the current shared-admin session using the transaction connection after acquiring the event lock and again before committing. Event creation/listing use an authorized transaction without an existing parent row. Ballot administration, dashboard and results reuse the same authorization helper. Expiry uses statement time, including after lock waits. Losing authorization rolls back any writes in that transaction.

Event descriptive updates now take the exclusive event lock, serializing them with dashboard/results/export snapshots. Existing parent-event-first ordering, roster/configuration freezes, approved unrestricted reopening, current submitted-only counts, revision checks and submission/unlock snapshots remain authoritative. No new role, per-admin tenant model, storage table or migration is introduced. Privileged direct SQL is outside this application boundary.

Known connection, capacity and database lock/statement timeout errors return a sanitized retryable `503 DEPENDENCY_UNAVAILABLE`; unexpected failures remain generic 500. Existing domain conflicts and validation errors keep their codes. No automatic mutation retry is introduced.

## Audit

Successful changes append records to existing `audit_logs` atomically with the change. Audit failure rolls back the lifecycle/access mutation; an authorization failure before commit also rolls back the audit. New timestamps use statement time after lock waits.

| Action                 | Target           | Minimal context                           |
| ---------------------- | ---------------- | ----------------------------------------- |
| `voting.activated`     | Voting UUID      | `from`, `to` lifecycle                    |
| `voting.closed`        | Voting UUID      | `from`, `to` lifecycle                    |
| `voting.reopened`      | Voting UUID      | `from`, `to` lifecycle                    |
| `juror_access.issued`  | Event juror UUID | `replacedLinks`, `revokedSessions` counts |
| `juror_access.revoked` | Event juror UUID | `links`, `sessions` counts                |

All carry event UUID and the server-resolved shared administrator identity. These new records contain no link tokens, token hashes, passwords or vote choices. Already-active activation/reopening and already-closed closure create no additional audit record. Revocation with no remaining live links/sessions is a no-op. Each regeneration actually replaces the secret and records that action; Stage 1 encrypted links can be retrieved again after a lost issuance response; copying is read-only and appends no audit record. Legacy hash-only links need an explicit replacement to enable copying. [Details](simplification-stage-1.md).

Existing `ballot.submitted` and `ballot.unlocked` snapshots are preserved unchanged, including their deliberately approved original vote history. They never contribute to current result totals and are not exported. No history-edit endpoint or audit browsing UI is introduced. Older actions are not backfilled or attributed to invented actors.

## Download

Open event **Výsledky hlasování** and choose **Stáhnout XLSX**. This exports the entire event, including setup categories. The action fetches a fresh snapshot; an older on-screen timestamp is not presented as the file's timestamp. Pending feedback, keyboard focus, explicit retry, request cancellation on unmount and authorization-loss clearing are implemented.

`GET /results/export.xlsx?eventId=<UUID>` requires the existing shared administration session. Strict query parsing rejects missing, duplicate, malformed and additional claims. Missing events return 404, invalid/expired/revoked sessions 401 and jurors 403. It returns the XLSX MIME type, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` and an attachment filename based only on the event UUID.

Results and participation are derived from the same event-locked snapshot, reusing the existing dashboard projection and result calculations. All sheets share one ISO UTC data/export timestamp and event identity. The event lock is released before ZIP generation; authorization is checked again before returning the completed file. The export is a dated snapshot, not certification or a permanent final result. Reads create no audit or ballot records.

| Worksheet     | Grain and contents                                                                                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kategorie** | One row per category, including empty/setup categories: UUID, kind, lifecycle, provisional/final label, T/V groups, selected places, eligible/submitted/pending/invalid/locked counts, cutoff-tie flag, reasons and factual problems.       |
| **Výsledky**  | One row per category team/item: current names/descriptions and UUIDs, positive/negative totals, numeric score/rank, shared-rank flag, unresolved/provisional/final selection label. Zero/negative scores and duplicate names are preserved. |
| **Účast**     | One row per currently eligible juror/category assignment: juror and group identity, current saved/submitted progress and UTC timestamps. Setup categories are explicitly labelled concepts and are planned participation.                   |

Only current eligible submitted ballots contribute to scores. Unlock removes current votes until replacement; draft/cancelled/absent/history records never add votes. Empty submissions count participation only. Existing rule-invalid stored submissions remain counted and flagged/provisional; ineligible records are excluded and flagged. Ranking, competition ties and finality match the results screen exactly. No individual choices, ballot revisions, audit snapshots or credentials are included.

The workbook uses numeric count/score cells and literal string cells, including text starting with `=`, `+`, `-` or `@`; there are no formulas, macros or automatic hyperlinks. Fixed worksheet names avoid user-derived Excel names. Frozen header rows, filters, column widths, wrapped text and row heights support reading; very long descriptions retain their full cell value and may require expansion in a spreadsheet application. Empty exports retain metadata and usable headers.

ExcelJS 4.4.0 is a server-only dependency. The compatible UUID 11.1.1 override avoids the reported older UUID advisory; clean install and audit evidence are recorded in progress. No workbook library enters the browser bundle. Export generation is in memory for the current hackathon scale; no large-export/load benchmark, native Excel/LibreOffice application check or background export infrastructure is claimed.

Deployment, hosting, proxy configuration, backups, retention and multi-instance operations remain Phase 13 decisions. Phase 13 requires a new explicitly user-started session.
