# Session continuity

Before making changes, read README.md, all documents in docs/implementation/, and the relevant wiki pages. Check the actual files and Git status; do not assume documentation alone proves implementation.

The user-supplied specification is preserved in docs/wiki/master-implementation-prompt.md. Follow its phase boundaries: one implementation phase per session, with validation, review, updated documentation, and a handoff. A subsequent phase requires a new session explicitly started by the user. Do not start Phase 1 until the Phase 0 architecture proposal is approved.

The visual reference is recorded in docs/wiki/design-reference.md. The user permits thoughtful design improvements. Preview data, authentication mechanics, jury sizes, and voting rules are illustrative and do not override the written requirements or unresolved product decisions.

Keep docs/implementation/{plan,progress,decisions,next-session}.md accurate. Never mark unrun checks as passing. Do not invent D21 limits, identity mechanisms, submission semantics, or tie-breaking rules. Record unresolved questions and obtain a decision before implementing the affected behavior.

Do not commit without explicit authorization. Preserve other sessions' changes; re-read relevant files before editing shared documentation.
