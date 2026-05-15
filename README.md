# up - remastered

`up` is a small self-hosted temporary file hosting service. This repo currently contains only the project foundation: Next.js, TypeScript, linting, Docker, docs, and Cursor guidance.

Feature work is intentionally deferred. Do not implement upload, share, download, cleanup, Drizzle schema, or database behavior as part of this setup step.

## Stack

- Next.js App Router
- TypeScript
- ESLint with Prettier plugin
- npm with committed `package-lock.json`
- Docker with a mounted `/data` volume

Planned later: SQLite metadata with Drizzle ORM, local filesystem uploads under `/data/uploads`, password hashing, streamed uploads/downloads, and cleanup by script.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validation

```bash
npm run lint
npm run build
```

## Runtime Config

Copy `.env.example` to `.env` for local development when feature work starts.

Required future variables:

- `DATA_DIR=/data`
- `UPLOAD_DIR=/data/uploads`
- `DATABASE_URL=file:/data/app.db`
- `MAX_UPLOAD_SIZE`
- `DEFAULT_EXPIRATION_HOURS`
- `BASE_URL`

Future config validation belongs in `src/server/config/env.ts` with Zod.

## Docker

```bash
docker compose up --build
```

The Compose file mounts `./data:/data` so SQLite and uploaded files persist across container restarts.

## Project Docs

Future agents should read `docs/ai/context.md` first, then the narrow docs for the scope being changed. Keep docs specific: prefer `docs/api/download/security.md` over broad files like `docs/security.md`.
