# Download Security

Public download IDs are generated with Node crypto as exactly five characters from `0-9A-Z`. SQLite enforces uniqueness through the upload metadata `id` primary key, and upload creation retries when insertion reports an ID collision.

Download rules:

- Treat `UPLOAD_DIR` and its parent directories as an operator-controlled filesystem boundary; users with permission to replace those directories already control stored application data.
- Treat the route ID only as a metadata lookup key; never as a filesystem path.
- Resolve the stored filename from trusted metadata under `UPLOAD_DIR` and reject names containing a path.
- Open files without following symlinks and require a regular file.
- Reject expired records before opening a file.
- Return the same unavailable response for malformed IDs, unknown IDs, expiration, unsafe paths, and missing files.
- Sanitize original filenames before building `Content-Disposition`.
- Accept only syntactically safe `type/subtype` media types in `Content-Type`; otherwise use `application/octet-stream`.
- Send downloads as attachments with `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`.

Password protection and download limits are not implemented yet. Download URLs remain excluded from `sitemap.xml` and must not be made indexable without an explicit crawler review.
