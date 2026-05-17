# Stack

Use:

- Next.js App Router for UI and backend routes.
- React Compiler for build-time component memoization.
- TypeScript for all project code.
- Tailwind CSS for styling.
- shadcn/ui for reusable UI components.
- SQLite for metadata.
- Drizzle ORM and `better-sqlite3` for schema, migrations, and queries.
- Local filesystem for uploaded bytes.
- Busboy for streaming multipart upload parsing.
- Docker with `/data` mounted from the host.

Avoid unless explicitly requested:

- Redis.
- BullMQ or queue systems.
- PostgreSQL.
- S3 or cloud object storage.
- Prisma.
- Separate backend frameworks.
- Auth providers.
- Serverless-only design assumptions.

pnpm is the package manager. Keep `pnpm-lock.yaml` committed and set `minimumReleaseAge` to 2880 minutes so new package versions must age for two days before installation. The `resolve` package is excluded from pnpm's age check only because pnpm evaluates its fresh `next` tag before applying overrides; keep the override pinned to the mature `2.0.0-next.6` release. Keep required native/tooling lifecycle scripts explicit in `allowBuilds`.
