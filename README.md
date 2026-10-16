# D21 Hackathon Voting System

Hackathon voting with D21 rules, technical (T) and second (V) jury groups, an administration workspace, a juror wizard, progress monitoring, and results.

Phase 2 provides a shared-password administration login, protected API access, database-backed sessions and operator tools on the React/Fastify/PostgreSQL foundation. Event management and voting workflows begin in later phases.

Use Node.js 22.13+ within the 22.x line and Docker. First run, from this directory:

```sh
npx --yes npm@11.6.2 ci
cp .env.example .env
npm run db:up
npm run db:migrate
npm run admin:set-password
npm run dev
```

Preserve `.env` if it already exists. The password command prompts without echo; there is no default password. Admins and guarantors use the same shared password, without an email. The [local home page](http://127.0.0.1:5173) is for jurors. Administrators and guarantors sign in directly at [admin login](http://127.0.0.1:5173/admin/login); there is no public admin link. See [local development](docs/wiki/local-development.md) for configuration, database checks, builds, and troubleshooting.

```sh
npm run check
npm run test:db
```

- [Project wiki](docs/wiki/README.md)
- [Design reference and user guidance](docs/wiki/design-reference.md)
- [Original implementation brief](docs/wiki/master-implementation-prompt.md)
- [Authentication and password commands](docs/wiki/authentication.md)
- [Local setup and validation](docs/wiki/local-development.md)
- [Implementation plan](docs/implementation/plan.md)
- [Current progress](docs/implementation/progress.md)
- [Next-session handoff](docs/implementation/next-session.md)

Development follows one phase per session. Phase 0 is approved. Phase 2 completion and Phase 3 decision gates are recorded in the progress and handoff documents. No commits have been made.
