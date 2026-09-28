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
- Ignore the uploaded filename and declared MIME type when deciding whether content may render inline. Classify bounded head and tail samples from the opened file descriptor.
- Render only verified raster images, PDF, audio, video, and inert UTF-8 text inline with a server-selected `Content-Type`. Active text formats (including HTML, XML, and SVG), ambiguous/polyglot samples, invalid UTF-8, and unsupported binaries use `application/octet-stream` plus attachment disposition.
- Send all successful responses with `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, and `Content-Security-Policy: sandbox; default-src 'none'`. The sandbox is defense in depth for inline inert documents; classification and `nosniff` remain the primary content boundary.
- Build `Content-Disposition` according to RFC 6266: an ASCII-sanitized `filename` fallback plus UTF-8 `filename*`. Strip paths and neutralize control characters before encoding either value.
- Let clients force any otherwise safe inline response to attachment with `?download=1`. Forced download does not bypass classification or alter availability, range, or expiration checks.

Password protection and download limits are not implemented yet. Download URLs remain excluded from `sitemap.xml` and must not be made indexable without an explicit crawler review.
