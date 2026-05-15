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

Future config validation belongs in:

```txt
src/server/config/env.ts
```

Use Zod there later to validate `DATA_DIR`, `UPLOAD_DIR`, `DATABASE_URL`, `MAX_UPLOAD_SIZE`, `DEFAULT_EXPIRATION_HOURS`, and `BASE_URL`.
