# up - remastered

`up` is a small self-hosted temporary file hosting service. It uses a TypeScript/Next.js backend instead of the original Kotlin service.

Implemented today:

- streamed anonymous uploads through `POST /api/upload`;
- responsive picker, drop, clipboard, text, progress, recovery, QR, and result UI;
- five-character share IDs and streamed/ranged downloads from `/{ID}` and `/u/{ID}`;
- one-time hashed access tokens with details, verify, and delete routes;
- public configuration plus generated ShareX and POSIX shell clients;
- SQLite metadata and local filesystem storage;
- upload-size, total-storage, and expiration limits;
- Docker/Compose deployment and automated CI checks.

Password-protected uploads and expired-file cleanup remain planned work. See the [browser upload requirements](docs/browser-upload/requirements.md) and [upstream parity matrix](docs/project/upstream-parity.md).

## Stack

- Next.js App Router and TypeScript
- Tailwind CSS and shadcn/ui
- SQLite with Drizzle ORM
- pnpm with committed `pnpm-lock.yaml`
- Docker with a mounted `/data` volume

## Local development

Use Node.js 24.14 and the pnpm version pinned in `package.json`:

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm run dev
```

Review `.env` before starting. Its `/data` paths target the default self-hosted layout and must be writable by the current user. Open `http://localhost:3000`.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for pull request conventions.

## Validation

Run fast checks while working:

```bash
pnpm run check
```

Run the full local CI equivalent before opening a pull request:

```bash
pnpm run check:full
```

`check:full` covers linting, type checking, unit tests, the production build, and Playwright/Lighthouse tests.

## Runtime configuration

Zod validates server configuration at startup through `src/env.ts`. `.env.example` documents every variable:

- `DATA_DIR=/data`
- `UPLOAD_DIR=/data/uploads`
- `DATABASE_URL=file:/data/app.db`
- `MAX_UPLOAD_SIZE=1073741824`
- `MAX_STORED_BYTES=10737418240`
- `DEFAULT_EXPIRATION_HOURS=24`
- `MAX_EXPIRATION_HOURS=24`
- `UP_PUBLIC_ORIGIN=http://localhost:3000`

## Database

Generate a migration after changing the Drizzle schema, then apply committed migrations manually when needed:

```bash
pnpm run db:generate
pnpm run db:migrate
```

SQLite stores metadata at `DATABASE_URL`; uploaded bytes stay under `UPLOAD_DIR`.

## Docker Compose

Build and start the service:

```bash
docker compose up --build -d
docker compose logs -f up
```

Open `http://localhost:3000`. Stop containers with:

```bash
docker compose down
```

Compose bind-mounts `./data:/data`. Container recreation and `docker compose down` therefore preserve:

```txt
data/app.db
data/uploads/
```

Back up both the SQLite files and uploads. See [`docs/operations/data-volume.md`](docs/operations/data-volume.md).

## Project documentation

Start with [`docs/ai/context.md`](docs/ai/context.md), then read only the narrow documentation for the changed scope. Examples:

- [`docs/project/upstream-parity.md`](docs/project/upstream-parity.md)
- [`docs/api/upload/requirements.md`](docs/api/upload/requirements.md)
- [`docs/api/configuration-and-clients.md`](docs/api/configuration-and-clients.md)
- [`docs/api/download/security.md`](docs/api/download/security.md)
- [`docs/pages/route-boundaries.md`](docs/pages/route-boundaries.md)
- [`docs/operations/logging.md`](docs/operations/logging.md)
- [`docs/ci/workflows.md`](docs/ci/workflows.md)
