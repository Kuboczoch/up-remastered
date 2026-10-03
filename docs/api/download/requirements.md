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

## Download admission contract

Finite uploads allow 1–10 eligible GET admissions, shared across `/<id>` and `/u/<key>`; omitted/`unlimited` means no finite cap. SQLite atomically checks availability and increments the counter after file, headers, and range validation, before handing off the body.

Each admitted 200 or 206 counts once, including ranges, repeat/retry requests, and interrupted/cancelled bodies; never refund an admission. This counts requests admitted, not completed files or distinct recipients. HEAD, invalid ranges, missing/expired/exhausted uploads, invalid storage paths, unreadable/missing files, and pre-admission failures consume nothing. Supported ranges are `bytes=start-end` and `bytes=start-`; unsupported/malformed/multiple ranges return 416, not a full-body fallback.

Exhausted uploads return the same no-store 404 as missing/expired uploads, including HEAD and public details/access checks. Public details include the configured `maxDownloads` (null for unlimited), never the internal counter. Cleanup reclaims expired or exhausted files; uploads enforce availability before cleanup runs. An already admitted body retains its open descriptor and can finish after cleanup unlinks the pathname.

Owner deletion atomically claims the metadata before renaming content out of its public path. The same claim fences download admission. Filesystem failure restores the path before releasing that claim; rollback never overwrites the admission counter with a stale snapshot.

Password checks and Nginx delegation remain out of scope.
