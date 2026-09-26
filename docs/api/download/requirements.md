# Download API Requirements

Current public route:

```txt
GET /[id]
HEAD /[id]
```

`id` is exactly five characters from `0-9A-Z`. Invalid IDs, missing metadata, expired uploads, unsafe stored paths, and missing physical files all return the same `404 File unavailable` response so availability details are not disclosed.

Before sending bytes, the route must:

- Validate the public ID shape.
- Look up metadata by the unique SQLite `id` primary key.
- Reject uploads whose `expiresAt` is at or before the current time.
- Resolve the server-generated stored name under `UPLOAD_DIR`.
- Verify and open a regular physical file without following symlinks.

The App Router handler exports `runtime = "nodejs"` and only passes the route ID to server-side download logic under `src/server/**`.

Password checks, download limits, cleanup, and Nginx delegation are out of scope. Cleanup is not enough: downloads enforce expiration and availability even when cleanup has not run.
