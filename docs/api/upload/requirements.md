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

- Multipart form data with one `file` part named `file`, e.g. `curl -F file=@example.zip http://localhost:3000/api/upload`.
- Multipart form data with one small text field named `text` when no file part exists, e.g. `curl -F text='hello' http://localhost:3000/api/upload`.
- Raw request bodies for terminal uploads. Non-text raw uploads must include `X-File-Name`, e.g. `curl --data-binary @example.zip -H 'Content-Type: application/octet-stream' -H 'X-File-Name: example.zip' http://localhost:3000/api/upload`.

Response success shape:

```json
{
  "key": "A7K2Q",
  "accessToken": "opaque 128-character token",
  "toDelete": "2026-05-17T14:00:00.000Z",
  "upload": {
    "accessToken": "opaque 128-character token",
    "id": "A7K2Q",
    "originalName": "example.zip",
    "mimeType": "application/zip",
    "size": 123,
    "expiresAt": "2026-05-17T14:00:00.000Z",
    "shareUrl": "http://localhost:3000/A7K2Q"
  }
}
```

Rules:

- No authentication or authorization is required.
- Generate a cryptographically random 128-character `accessToken` for each upload. Return it once and store only its SHA-256 hash in SQLite.
- `key` aliases `upload.id`, and `toDelete` aliases `upload.expiresAt`, for current upstream client compatibility.
- Successful uploads retain the remastered `201 Created` status and nested `upload` object.
- `id` is the only upload identifier used by API, SQLite metadata, and filesystem storage.
- `id` is exactly five characters from `0-9A-Z`, e.g. `A7K2Q`.
- `id` is the SQLite primary key and the basis for the stored filename.
- Generate `id` with Node crypto and retry metadata insertion on a primary-key collision.
- `id` is reusable only after the previous upload's metadata row and stored file are deleted.
- Expiration alone does not release an `id`; cleanup or another deletion path must remove the metadata row.
- Store uploaded bytes under `UPLOAD_DIR`; never store file bytes in SQLite.
- Generate stored filenames on the server and never trust client-provided paths.
- Write SQLite metadata only after storage succeeds.
- Multipart metadata fields are intentionally small; use raw uploads for large text payloads.
- Optional multipart `maxDownloads` must be exactly `unlimited` or a decimal integer string from `1` through `10`. Omission defaults to unlimited (`null` in metadata/results). Reject empty, padded, fractional, signed, out-of-range, or duplicate values with 400 `invalid_max_downloads`. Raw uploads remain unlimited. Store the limit and an initial zero admission counter; do not expose the counter or access-token hash in public details.
- Default expiration is `DEFAULT_EXPIRATION_HOURS`, currently 24h in production config.
- Requested expiration can use strict UTC ISO `expiresAt`, `expiresInHours`, `expiresInMinutes`, or `expiresInSeconds`.
- The effective maximum is the lesser of `MAX_EXPIRATION_HOURS` and 24 hours; legacy deployment settings cannot raise the 24-hour ceiling. The effective default is capped by that maximum.
- Browser choices are 1, 3, 6, 12, and 24 hours. Legacy duration fields retain positive decimal durations within the effective maximum. Supply exactly one expiration field; absolute UTC dates must be real calendar dates.
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
