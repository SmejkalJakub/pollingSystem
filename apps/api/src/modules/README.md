# API module boundaries

Phase 2 implements `auth/` alongside infrastructure routes. It owns shared-password authentication, PostgreSQL sessions, operator commands and authorization guards. Register future admin modules inside its protected cookie/origin scope and apply `adminGuard`. See [authentication](../../../../docs/wiki/authentication.md). Add remaining modules in their assigned phases:

- `auth`: admin and juror identity, server sessions, authorization context (Phase 2).
- `events`, `jurors`: event lifecycle, jury groups, membership (Phase 3).
- `votings`: configuration, allowed groups, items and lifecycle (Phase 4).
- `ballots`: wizard data, draft ownership, validation and submission (Phases 5–9).
- `dashboard`, `results`: read-only projections over authoritative data (Phases 10–11).

Keep substantial domain behavior out of HTTP handlers. Share public schemas through `@d21/contracts`. Do not import web components into the API or expose database records as public contracts automatically.
