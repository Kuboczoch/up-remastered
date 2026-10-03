# SQLite Requirements

SQLite stores metadata only. File bytes stay on disk under `/data/uploads`.

The runtime database URL defaults to:

```txt
file:/data/app.db
```

Only `file:` SQLite URLs are supported. Runtime connection and migration code lives under `src/server/db/` and imports `server-only`. The pure Drizzle schema is also under `src/server/db/` but remains importable by Drizzle Kit so migrations can be generated.

Database helpers create the SQLite parent directory before opening or migrating the database. Callers that open SQLite connections own closing them. The standalone Docker image includes the committed `drizzle/` migrations folder under `/app/drizzle` so server-side migration helpers can find migration SQL from the runtime working directory.

Current upload metadata fields:

- `id`
- `accessTokenHash` (nullable only for rows created before the access-token migration)
- `originalName`
- `storedName`
- `mimeType`
- `size`
- `storagePath`
- `createdAt`
- `expiresAt`
- `maxDownloads` (nullable: unlimited; finite values validated 1–10)
- `downloadCount` (non-null, default zero; one atomic increment per admitted GET)
- `encrypted` (boolean, default false; only a ciphertext marker, no key)
- `cleanupClaimId` and `cleanupClaimedAt` (cleanup coordination)

Use Drizzle ORM and `better-sqlite3` for schema, migrations, and queries. Do not introduce Prisma or PostgreSQL.

Upload API behavior:

- Metadata rows are inserted only after uploaded bytes are stored successfully.
- `size` participates in total stored-data quota checks.
- `expiresAt` is set on upload creation so future download and cleanup paths can enforce availability.
- `id` is the only upload identifier, the SQLite primary key that enforces uniqueness, and the basis for the stored filename.
- Upload IDs are exactly five characters from `0-9A-Z`; creation uses Node crypto and retries a metadata insert when a collision occurs.
- `id` can be reused after cleanup or another deletion path removes the previous metadata row and stored file.
- Expiration alone does not release an `id`; the row must be deleted first.

Useful commands:

```bash
pnpm run db:generate
pnpm run db:migrate
```

Expiration and exhausted download limits must be enforced at read/download time. Cleanup is maintenance, not the only availability check. Migration `0007_layered_upload` preserves preexisting rows with unlimited downloads, a zero count, and the unencrypted marker. SQLite performs a single conditional UPDATE to reserve each download, rechecking expiry, cleanup claims, and remaining slots across connections/processes.
