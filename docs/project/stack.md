# Stack

Use:

- Next.js App Router for UI and backend routes.
- React Compiler for build-time component memoization.
- TypeScript for all project code.
- Tailwind CSS for styling.
- shadcn/ui for reusable UI components.
- SQLite for metadata.
- Drizzle ORM for future schema, migrations, and queries.
- Local filesystem for uploaded bytes.
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

npm is the package manager. Keep `package-lock.json` committed and do not introduce pnpm, yarn, or bun unless requested.
