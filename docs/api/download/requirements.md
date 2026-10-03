# Download API Requirements

Current public routes:

```txt
GET /[id]
HEAD /[id]
GET /u/[id]
HEAD /u/[id]
GET /api/u/[id]/details
POST /api/u/[id]/verify
DELETE /api/u/[id]
```

`id` is exactly five characters from `0-9A-Z`. Invalid IDs, missing metadata, expired uploads, unsafe stored paths, and missing physical files all return the same `404 File unavailable` response so availability details are not disclosed.

Both public download aliases accept `?download=1` on `GET` and `HEAD`. This keeps the verified content type but forces `Content-Disposition: attachment`; other `download` values do not change the normal safe-inline policy.

Before sending bytes, the route must:

- Validate the public ID shape.
- Look up metadata by the unique SQLite `id` primary key.
- Reject uploads whose `expiresAt` is at or before the current time.
- Resolve the server-generated stored name under `UPLOAD_DIR`.
- Verify and open a regular physical file without following symlinks.
- Classify bounded bytes from the opened descriptor instead of trusting the uploaded filename or declared MIME type.

The App Router handlers export `runtime = "nodejs"` and only pass route input to server-side download/management logic under `src/server/**`.

`details` returns public filename, MIME, size, and expiration metadata. `verify` and `DELETE` accept JSON `{ "accessToken": "..." }`; malformed bodies return 400, wrong tokens 403, and unavailable uploads 404. Valid verification returns `{ "message": null, "success": true }`; valid deletion returns an empty 200 response.

Deletion renames content out of its public path before removing metadata. Filesystem failure restores both content and metadata, so a failed request does not leave a half-deleted public upload.

Password checks and Nginx delegation remain out of scope. Downloads enforce expiration and exhaustion even when cleanup has not run. Exhausted or cleanup-claimed uploads return the same unavailable 404, including HEAD and public details.

## Download limit accounting

A download is one admitted body-bearing GET (200 or 206), atomically reserved in SQLite after opening/validating the file and validating the range, immediately before response streaming. Every alias, forced attachment, retry, valid range, and malformed-range fallback goes through the same predicate-and-increment. Concurrent requests cannot admit more than `maxDownloads`; unavailable and 416 responses consume nothing. HEAD and public details consume nothing. Interrupted/aborted/failed streams are not refunded: a request might already have received bytes, and refunds would permit a range/abort bypass. The final admitted stream remains readable via its open descriptor even if cleanup unlinks exhausted storage.

Conditional headers do not cause 304 responses: there is no cache validator path and responses use `no-store`. Such GETs still return a counted body; conditional or range headers cannot create an uncounted ciphertext path. Uploads with null limits are unlimited but successful GETs still increment `downloadCount`.

Encrypted uploads always serve attachment ciphertext with `application/octet-stream`, bypassing plaintext content classification. Public details include only the encrypted marker and configured limit, never key material.
