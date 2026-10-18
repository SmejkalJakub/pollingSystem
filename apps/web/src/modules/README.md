# Frontend module boundaries

Phase 2 implements the authentication screen. Remaining product modules are introduced in their assigned phases:

- `auth`: login/session UI.
- `admin`: event, jury and voting management.
- `voting-wizard`: authorized juror steps, local interaction, persistence feedback and review.
- `dashboard`: operational progress.
- `results`: category rankings and tie presentation.

Shared visual primitives live in `components/ui`; transport helpers in `lib`; public runtime schemas in `@d21/contracts`. Approved domain rules live in `@d21/voting-domain`, separate from presentation components.

`auth/AuthScreen.tsx` provides password-only administration login, session restoration, expiry, logout, accessible feedback and connection retry. `admin/` provides event/jury management and Phase 4 voting drafts with allowed T/V groups. Shared teams, draft voting entries, closure and admin reopening are implemented. Explicit D21 configuration and validated first activation are complete; Phase 5 adds root secret-link entry, protected `/wizard` and UUID category routes, current-membership server data, URL restoration and accessible responsive navigation. Admin `JurorAccess` provides one-time secret display/copy and confirmed regeneration/revocation. The generic typed transport is shared in `lib/api.ts`; no secret/session is persisted in browser storage. Phase 6 adds temporary voting interactions; ballot persistence/submission remain later phases.

Phase 6 implements shared pure D21 validation/transitions and temporary category controls. The wizard validation endpoint inherits existing event/session/current-group checks and writes no ballot data. Persistence/submission remain later phases; see the juror-wizard wiki.

Phase 7 adds `useBallotDraft` and `DraftPersistence` for explicit category saves, restoration, revision-conflict comparison, retry and unsaved-change feedback. Overview progress comes from saved ballots. Availability refresh preserves edits; recoverable revalidation failures retain the editor. No browser storage or submission UI.

Phase 8 adds `BallotSubmission` for explicit per-category confirmation, restored submitted timestamp/read-only choices and safe retry/conflict recovery using the existing draft hook. Admin `BallotUnlock` provides identity/status listing, explicit administrator-only unlock confirmation and stale-revision feedback. Same-page refresh detects unlock for comparison/load before editing. Other categories remain accessible; review/final-submit is Phase 9. Earlier no-submit/persistence descriptions above are historical phase boundaries. See [submission](../../../../docs/wiki/ballot-submission.md).

Phase 9 adds saved review, explicit selected final submission and refreshable current confirmation in `voting-wizard`; workflow/retries live in `useReviewSubmission`, category presentation in `ReviewCategoryCard`. See the review wiki for partial-commit recovery and authorization boundaries.

Phase 10 `dashboard/` adds event KPI/category cards and category/juror detail, searchable native disclosures, explicit snapshot refresh and focused retry/expiry handling. Event management links to `/admin/events/:eventId/dashboard`; category detail is `/admin/dashboard/votings/:votingId`. Current tokens and metadata-only contracts are reused. No results/ranking or threshold/time alerts.

Phase 11 `results/{Results,ResultCategory,ResultsState}` presents server-calculated category totals/ranks/selection and approved provisional/final/cutoff states. Event/category admin entries and direct URLs restore the existing session. Tables reflow into labelled phone rows; native links/buttons and focused refresh/retry use existing tokens/controls. No client-side ranking or persistent certification. See [results](../../../../docs/wiki/results-ranking.md).

## Phase 12 — 2026-10-18

Phase 12 adds `results/ExportResults.tsx` on event results: XLSX download of category/results/participation snapshots, pending/success/focused error/retry, keyboard focus restoration and authorization-loss clearing. The spreadsheet writer remains server-only. Existing semantic tokens and shadcn Button are reused.

## Simplification Stages 1–2 — 2026-10-18

Stage 1 supersedes the historical one-time-copy and timed-juror-session descriptions above; `CopyJurorLink` retrieves an existing encrypted link directly with accessible clipboard fallback. Stage 2 adds `admin/EventNavigation.tsx` for shared event context and Preparation/Progress/Results links, reused by event/category administration, dashboard and results. EventDetail selects existing juror/team/category components using `setup` query parameters; only that collection mounts. Existing forms, API guards and server calculations remain in their established modules. See the Stage 1/2 wiki guides.

## Simplification Stage 3 — 2026-10-18

`admin/TeamsManager` loads the Teams snapshot. `TeamTable` keeps local edits and handles atomic saving/retry/comparison; `TeamRows` renders labelled fields and retained row errors; `TeamPaste` previews tab-separated clipboard text using `team-table-utils`. Shared contracts validate both the client and server. No identity matching, browser storage, automatic save, table deletion or voting logic. See the Stage 3 wiki guide.
