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

Before sending bytes, the route must:

- Validate the public ID shape.
- Look up metadata by the unique SQLite `id` primary key.
- Reject uploads whose `expiresAt` is at or before the current time.
- Resolve the server-generated stored name under `UPLOAD_DIR`.
- Verify and open a regular physical file without following symlinks.

The App Router handlers export `runtime = "nodejs"` and only pass route input to server-side download/management logic under `src/server/**`.

`details` returns public filename, MIME, size, and expiration metadata. `verify` and `DELETE` accept JSON `{ "accessToken": "..." }`; malformed bodies return 400, wrong tokens 403, and unavailable uploads 404. Valid verification returns `{ "message": null, "success": true }`; valid deletion returns an empty 200 response.

Deletion renames content out of its public path before removing metadata. Filesystem failure restores both content and metadata, so a failed request does not leave a half-deleted public upload.

Password checks, download limits, cleanup, and Nginx delegation are out of scope. Cleanup is not enough: downloads enforce expiration and availability even when cleanup has not run.
