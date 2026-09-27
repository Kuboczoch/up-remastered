# AI Context

Read this before future implementation work.

Project: `Up - Remastered`, short name `up`.

Intent: small self-hosted temporary file hosting service, written in TypeScript with Next.js App Router.

Hard constraints:

- Use pnpm and commit `pnpm-lock.yaml`.
- Keep `minimumReleaseAge` set to 2880 minutes for dependency installs.
- Keep the `resolve` override pinned while it is excluded from the age check.
- Use Node.js runtime for upload/download APIs.
- Store metadata in SQLite only.
- Store uploaded bytes on local filesystem under `/data/uploads`.
- Keep database at `/data/app.db`.
- Do not use Redis, PostgreSQL, S3, Prisma, queue systems, auth providers, or cloud storage unless explicitly requested.
- Keep server-only code under `src/server/`.
- Use `import "server-only"` in server modules that touch filesystem, database, env vars, password hashing, or tokens.
- Keep route handlers thin.
- Keep docs scoped to exact app area and concern.
- Maintain docs during every meaningful change. Update matching scoped docs for behavior, config, CI, Docker, API, storage, security, or operations changes.

Most useful docs:

- `docs/project/code-organization.md`
- `docs/storage/filesystem/requirements.md`
- `docs/storage/sqlite/requirements.md`
- `docs/api/upload/requirements.md`
- `docs/api/download/requirements.md`
- `docs/api/download/streaming.md`
- `docs/api/download/security.md`
- `docs/operations/logging.md`
- `.cursor/rules/docs-maintenance.mdc`
