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
- `token`
- `originalName`
- `storedName`
- `mimeType`
- `size`
- `storagePath`
- `createdAt`
- `expiresAt`
- `passwordHash`
- `downloadLimit`
- `downloadCount`

Use Drizzle ORM and `better-sqlite3` for schema, migrations, and queries. Do not introduce Prisma or PostgreSQL.

Upload API behavior:

- Metadata rows are inserted only after uploaded bytes are stored successfully.
- `size` participates in total stored-data quota checks.
- `expiresAt` is set on upload creation so future download and cleanup paths can enforce availability.

Useful commands:

```bash
pnpm run db:generate
pnpm run db:migrate
```

Expiration must be enforced at read/download time. Cleanup is maintenance, not the only availability check.
