# Project wiki

Persistent project knowledge for independent sessions. Updated 2026-10-18. Phases 0–13 are complete within the approved scope: existing administration is hardened, lifecycle/link changes have atomic audit, and XLSX exports include results/participation. Deadlines and alerts are excluded by user decision. Stages 1–3 are deployed; Stage 4 adds the Jurors table and automatic missing T/V groups locally; it has not been published. Consult progress for current validation and completion status.

| Page                                                    | Purpose                                                                                                                                            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Implementation brief](master-implementation-prompt.md) | Complete, unchanged user-supplied Czech specification, including phase scopes and completion criteria.                                             |
| [Design reference](design-reference.md)                 | Lovable preview, permission to improve its design, observed visual direction, and differences from the specification.                              |
| [Architecture proposal](architecture.md)                | Suggested stack, module boundaries, database integrity, and API contracts. Approved as the Phase 1 baseline; open product choices remain separate. |
| [Open decisions](open-decisions.md)                     | Product questions, options, recommendations, and the phases they affect.                                                                           |
| [Implementation plan](../implementation/plan.md)        | Phase status, dependencies, and acceptance gates.                                                                                                  |
| [Progress](../implementation/progress.md)               | Verified workspace state and validation results.                                                                                                   |
| [Decision log](../implementation/decisions.md)          | Confirmed requirements and proposals, clearly distinguished.                                                                                       |
| [Next session](../implementation/next-session.md)       | Starting point for continuing work without chat history.                                                                                           |
| [Event and jury management](event-jury-management.md)   | Approved roster policy, admin screens, API and migration integration.                                                                              |
| [Voting configuration](voting-configuration.md)         | Implemented voting configuration, teams, lifecycle API/UI and validation.                                                                          |
| [Juror entry and wizard](juror-wizard.md)               | Approved link/session lifecycle, organizer workflow, authorized steps, temporary voting and validation boundaries.                                 |
| [Category submission](ballot-submission.md)             | Atomic per-category submission, retries, locking and administrator-only unlocking/history.                                                         |
| [Authentication](authentication.md)                     | Shared password, operator commands, session/cookie behavior, API and boundaries.                                                                   |
| [Local development](local-development.md)               | Installation, configuration, migrations, checks, and local startup.                                                                                |

Use the user's explicit instructions and approved decisions as authority. Treat the preview as visual guidance. The architecture baseline is approved; recommendations attached to unresolved product questions are not approved requirements.

[Multi-category review and final submission](multi-category-review.md) records the approved Phase 9 contract and recovery behavior.

[Operational dashboard](operational-dashboard.md) defines eligible/current-submitted counting, setup boundaries, factual problems, API consistency and manual refresh.

[Results and ranking](results-ranking.md) records Phase 11 current-submitted-only counts, approved Q06 ranks/cutoff ties/finality, guarded API and responsive internal results screens.

[Operational hardening and XLSX export](operational-hardening.md) records Phase 12 scope, audit, transaction authorization, error handling and workbook/API semantics.

[Linux hosting and colleague testing](deployment.md) describes the Phase 13 container, Render/Supabase setup, backup/restore, local/live E2E and recovery evidence, owner operations and explicit pilot limitations.

- [Simplification Stage 1: untimed juror access, one-click copying and external keys](simplification-stage-1.md)

- [Simplification Stage 2: compact event workspace and focused preparation](simplification-stage-2.md)

- [Simplification Stage 3: editable Teams table, spreadsheet preview and atomic saving](simplification-stage-3.md)

- [Simplification Stage 4: editable Jurors table, automatic missing T/V groups and freeze-safe atomic saving](simplification-stage-4.md)

- [Simplification Stage 5 — combined category preparation](simplification-stage-5.md)
