# up - remastered

`up` is a small self-hosted temporary file hosting service. This repo currently contains the project foundation: Next.js, TypeScript, Tailwind CSS, shadcn/ui, linting, Docker, docs, Cursor guidance, and SQLite metadata persistence.

Upload, share, download, and cleanup behavior is intentionally deferred.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- ESLint with Prettier plugin
- SQLite metadata with Drizzle ORM
- pnpm with committed `pnpm-lock.yaml`
- Docker with a mounted `/data` volume

Planned later: local filesystem uploads under `/data/uploads`, password hashing, streamed uploads/downloads, and cleanup by script.

## Development

```bash
corepack enable
pnpm install
pnpm run dev
```

Open `http://localhost:3000`.

## Validation

```bash
pnpm run lint
pnpm run build
```

## Database

```bash
pnpm run db:generate
pnpm run db:migrate
```

SQLite stores metadata only at `DATABASE_URL=file:/data/app.db`. Uploaded bytes stay on the local filesystem under `/data/uploads`.

## Runtime Config

Copy `.env.example` to `.env` for local development.

Runtime variables:

- `DATA_DIR=/data`
- `UPLOAD_DIR=/data/uploads`
- `DATABASE_URL=file:/data/app.db`
- `MAX_UPLOAD_SIZE=1073741824`
- `DEFAULT_EXPIRATION_HOURS=24`
- `BASE_URL=http://localhost:3000`

Future config validation belongs in `src/server/config/env.ts` with Zod.

## Docker

```bash
docker compose up --build
```

The Compose file mounts `./data:/data` so SQLite and uploaded files persist across container restarts.

## Project Docs

Future agents should read `docs/ai/context.md` first, then the narrow docs for the scope being changed. Keep docs specific: prefer `docs/api/download/security.md` over broad files like `docs/security.md`.
