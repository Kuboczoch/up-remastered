# Upload API Requirements

Upload API routes must use the Node.js runtime:

```ts
export const runtime = "nodejs";
```

The Edge runtime is not allowed for upload routes because local filesystem streams, SQLite access, and Node crypto/password tooling are Node-only concerns.

Current route:

```txt
POST /api/upload
```

Supported request bodies:

- Multipart form data with one `file` part, e.g. `curl -F file=@example.zip http://localhost:3000/api/upload`.
- Multipart form data with a text field when no file part exists, e.g. `curl -F text='hello' http://localhost:3000/api/upload`.
- Raw request bodies for terminal uploads, e.g. `curl --data-binary @example.zip -H 'Content-Type: application/octet-stream' -H 'X-File-Name: example.zip' http://localhost:3000/api/upload`.

Response success shape:

```json
{
  "upload": {
    "id": "A7k2Q",
    "originalName": "example.zip",
    "mimeType": "application/zip",
    "size": 123,
    "expiresAt": "2026-05-17T14:00:00.000Z",
    "shareUrl": "http://localhost:3000/api/download/A7k2Q"
  }
}
```

Rules:

- No authentication or authorization is required.
- `id` is the only upload identifier used by API, SQLite metadata, and filesystem storage.
- `id` is a 5-character alphanumeric value with no prefix, e.g. `A7k2Q`.
- `id` is the SQLite primary key and the basis for the stored filename.
- `id` is reusable only after the previous upload's metadata row and stored file are deleted.
- Expiration alone does not release an `id`; cleanup or another deletion path must remove the metadata row.
- Store uploaded bytes under `UPLOAD_DIR`; never store file bytes in SQLite.
- Generate stored filenames on the server and never trust client-provided paths.
- Write SQLite metadata only after storage succeeds.
- Default expiration is `DEFAULT_EXPIRATION_HOURS`, currently 24h in production config.
- Requested expiration can use strict UTC ISO `expiresAt`, `expiresInHours`, `expiresInMinutes`, or `expiresInSeconds`.
- Reject requested expiration beyond `MAX_EXPIRATION_HOURS`, currently 24h in production config.
- Enforce `MAX_UPLOAD_SIZE`, currently 1 GiB in production config.
- Enforce `MAX_STORED_BYTES`, currently 10 GiB in production config.
- Stream file and raw uploads; do not buffer entire file/raw request bodies into memory.

Error responses use:

```json
{
  "error": {
    "code": "upload_too_large",
    "message": "Upload exceeds the maximum upload size."
  }
}
```
