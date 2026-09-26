# Code Organization

Keep server-only feature logic under `src/server/`:

```txt
src/server/db/
src/server/storage/
src/server/config/
src/server/security/
src/server/files/
```

Route handlers should stay thin. They should validate request shape, call server modules, and format responses. Do not scatter SQLite, filesystem, path, password, token, or env logic directly inside route handlers.

Server modules that access filesystem, database, env vars, password hashing, or tokens should import:

```ts
import "server-only";
```

Server environment validation lives in:

```txt
src/env.ts
```

Its Zod schema is the single parsing and defaulting boundary for `DATA_DIR`, `UPLOAD_DIR`, `DATABASE_URL`, upload quotas, expiration limits, and `UP_PUBLIC_ORIGIN`. Server config modules consume the validated values; route handlers must not read `process.env` directly.
