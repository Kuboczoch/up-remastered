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
- Default expiration is `DEFAULT_EXPIRATION_HOURS`, currently 24h in production config.
- Requested expiration can use strict UTC ISO `expiresAt`, `expiresInHours`, `expiresInMinutes`, or `expiresInSeconds`.
- Reject requested expiration beyond the smaller of `MAX_EXPIRATION_HOURS` and the hard 24-hour maximum, regardless of duration units or absolute `expiresAt`. Default expiration is also capped at this maximum.
- Multipart `maxDownloads` is omitted or `unlimited` for no limit; otherwise accept only decimal integer strings `1` through `10`. Invalid values return 400 `invalid_max_downloads`.
- Multipart `encrypted` is omitted/`false` for normal uploads, or exactly `true` for client-encrypted bytes. Invalid values return 400 `invalid_encrypted`. This marker is not a cryptographic guarantee; encryption occurs entirely in the browser.
- Encrypted uploads store only ciphertext, generic filename `encrypted.bin`, and `application/octet-stream`; the server does not receive or store decryption keys or original archive names.
- `upload` also returns `maxDownloads` (integer or null) and `encrypted` (boolean). Encrypted `shareUrl` is `/decrypt/{id}` with no key; the browser appends its fragment locally. The existing `/{id}` and `/u/{id}` routes serve raw ciphertext, never decrypted bytes.
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
