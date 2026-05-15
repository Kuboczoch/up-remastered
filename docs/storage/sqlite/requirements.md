# SQLite Requirements

SQLite stores metadata only. File bytes stay on disk under `/data/uploads`.

Future metadata fields:

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

Use Drizzle ORM later for schema, migrations, and queries. Do not introduce Prisma or PostgreSQL.

Expiration must be enforced at read/download time. Cleanup is maintenance, not the only availability check.
