# Decision log

Updated 2026-10-16. Explicitly distinguish confirmed instructions from proposals.

| ID  | Status                                   | Problem / options                                         | Decision or proposal                                                                                                                          | Reason and consequences                                                                                                                                                 |
| --- | ---------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | CONFIRMED — brief                        | Implement everything together or one phase per session?   | One phase per session, with validation, review, documentation, and explicit new-session continuation.                                         | Preserves scope and continuity; do not advance beyond the phase the user authorizes.                                                                                    |
| D02 | CONFIRMED — user message                 | Strictly reproduce the preview or allow improvements?     | Use the supplied Lovable preview as design guidance; thoughtful innovation is allowed.                                                        | Written product and accessibility requirements still govern behavior.                                                                                                   |
| D03 | CONFIRMED — brief                        | How should separate sessions recover context?             | Repository-local wiki plus plan, progress, decisions, and next-session documents.                                                             | No existing wiki or repository files were present. Root README and AGENTS point sessions to the persistent sources.                                                     |
| D04 | REQUESTED STACK                          | Monolith or distributed services?                         | React/TypeScript/Vite/Tailwind/shadcn frontend; Node/Fastify backend; PostgreSQL; lean modular monolith.                                      | Matches the user's default stack. No existing technology constrains adoption.                                                                                           |
| D05 | APPROVED — user continuation, 2026-10-16 | Which SQL/validation/workspace tools?                     | Drizzle ORM, Zod, npm workspaces, shared contracts and pure voting-domain package.                                                            | Explicit SQL access, portable schemas, and small shared domain logic. Architecture baseline approved; open product choices remain separate.                             |
| D06 | CONFIRMED — Phase 2 user decisions       | Session and authorization design?                         | Same-origin PostgreSQL sessions, protected cookies and 12-hour absolute expiry; shared admin/guarantor password and event/juror secret links. | Later password-only user instruction supersedes email accounts. Juror entry/link lifecycle remains later-phase work; voting access still requires allowed-group checks. |
| D07 | CONFIRMED — brief                        | May the engine infer D21 methodology or tie rules?        | No: obtain explicit decisions before affected implementation.                                                                                 | Preview examples cannot establish the voting standard.                                                                                                                  |
| D08 | OBSERVED                                 | Does the workspace contain implementation or Git history? | The folder was empty and not a Git repository on initial inspection.                                                                          | No application checks, branch, remote wiki, or prior implementation could be verified. No Git initialization or commit performed in Phase 0.                            |

Full proposed design: [architecture](../wiki/architecture.md). Unresolved choices and implementation gates: [open decisions](../wiki/open-decisions.md).

## Phase 1 decisions (historical)

- User continuation authorizes Phase 1 only. Phase 0 is DONE.
- Keep the specified minimal VotingItem model. Shared event-level Team identity remains Q09, to be resolved before Phase 4; a later additive migration can introduce it. No team CRUD or deletion behavior is implemented.
- D21 configuration columns are nullable in drafts, with basic nonnegative/disabled-negative constraints only. No formulas or activation policy are inferred.
- Per-voting ballots support either future submit workflow. No wizard-wide state or submission endpoint is added while Q04 remains open.
- Users contain identity-independent display information only. Credential and session tables wait for Q03 in Phase 2.
- Foreign keys use RESTRICT as a conservative database baseline. No destructive product endpoint or retention policy is established.
- Git initialized on main with no commits.

- Root packageManager pins npm 11.6.2 after the host’s npm 11.0.0 peer-resolution crash. esbuild is overridden to patched 0.28.x; generation and builds are verified against this resolution.
- The official shadcn Button was added with the CLI, then its imports were adapted to the existing local cn utility and the focused Radix Slot dependency; unused generated dependencies were removed. Review future generated imports before accepting new dependencies.

## Phase 2 decisions — confirmed 2026-10-16

- SUPERSEDED: the initial email/password choice was replaced in the same session by the user’s “just a password protected login, no email” instruction.
- CONFIRMED final model: one shared administration password for admins and guarantors, distributed by the organizer. No email or individual login accounts; both use the same permissions and shared audit identity.
- The user chose unique organizer-issued secret links per juror and event; names are display labels. Phase 2 prepares backend storage; entry UI and wizard integration remain Phase 5.
- The user approved database-backed sessions, protected same-origin cookies, a 12-hour absolute expiry, logout revoking the current session, and an operator command to revoke all administration sessions.
- Admin and guarantor share administrative permissions as permitted by the brief; no expanded RBAC system.
- Implementation scope: authentication only. No event CRUD, wizard, D21, or commit.

- Operator commands set/replace the shared password and revoke sessions. Password replacement revokes all administration sessions in the same transaction. No default password is seeded.
- Native scrypt with the OWASP baseline, hashed random session secrets, strict same-origin cookie/origin protection, bounded hashing and per-process login throttling implement the approved access model.
- Juror secret issuance/redemption and link lifetime are deferred until the relevant roster/entry work; Phase 2 provides storage and an event-scoped lookup only.
- Auth implementation and operator details: [authentication](../wiki/authentication.md).

## Phase 2 routing follow-up — confirmed 2026-10-16

- The user requested the juror page as the default and administration behind a specific URL. Chosen URL: `/admin/login`; no admin link appears on the juror landing.
- `/` provides personal-link instructions without inventing a juror identity form, event status or link-redemption workflow. Functional juror entry remains Phase 5.
- Exact path routing replaces the previous catch-all admin screen. Other paths show not-found content; API authentication remains unchanged.
