# Upload API Requirements

Future upload API routes must use the Node.js runtime:

```ts
export const runtime = "nodejs";
```

The Edge runtime is not allowed for upload routes because local filesystem streams, SQLite access, and Node crypto/password tooling are Node-only concerns.

Future behavior:

- Accept one file.
- Allow optional expiration.
- Allow optional password.
- Allow optional download limit.
- Enforce configured max upload size.
- Stream file bytes to `/data/uploads`.
- Create SQLite metadata row after storage succeeds.
- Return share URL based on `BASE_URL`.

Do not buffer entire uploads into memory.

Server-side upload failures should follow `docs/operations/logging.md`.
