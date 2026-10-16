# Frontend module boundaries

Phase 2 implements the authentication screen. Remaining product modules are introduced in their assigned phases:

- `auth`: login/session UI.
- `admin`: event, jury and voting management.
- `voting-wizard`: authorized juror steps, local interaction, persistence feedback and review.
- `dashboard`: operational progress.
- `results`: category rankings and tie presentation.

Shared visual primitives live in `components/ui`; transport helpers in `lib`; public runtime schemas in `@d21/contracts`. Domain rules belong in `@d21/voting-domain` after methodology approval, not in presentation components.

Phase 2 implements `auth/AuthScreen.tsx`: password-only administration login, session restoration, expiry, logout, accessible feedback and connection retry. It confirms access; event management and juror entry remain future phases.
