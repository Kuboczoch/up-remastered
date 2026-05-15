---
name: up-architecture
description: Applies up - remastered architecture constraints. Use when implementing upload, share, download, storage, SQLite, cleanup, Docker, or docs work in this repository.
---

# Up Architecture

Before feature work, read:

- `docs/ai/context.md`
- The scoped docs for the exact area being changed.
- `.cursor/rules/docs-maintenance.mdc`

Core constraints:

- Next.js App Router owns UI and backend routes.
- TypeScript only.
- npm only; keep `package-lock.json`.
- SQLite stores metadata only.
- Files live under `/data/uploads`.
- Database lives at `/data/app.db`.
- Future upload/download routes must export `runtime = "nodejs"`.
- Use `src/server/**` for filesystem, database, config, security, and file helpers.
- Use `import "server-only"` for server modules that touch private server resources.
- Stream large uploads/downloads; never buffer whole files.
- Enforce expiration in download logic, not only cleanup.
- Cleanup may be a cron/Compose script; do not add queue workers.
- Keep docs updated with every meaningful code, config, CI, Docker, API, storage, security, or operations change.

Do not add Redis, PostgreSQL, S3, Prisma, auth providers, queues, cloud storage, or a separate backend framework unless explicitly requested.

Before finishing, update matching scoped docs or state why no docs changed.
