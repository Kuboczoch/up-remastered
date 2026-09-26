# Download Streaming

`GET /[id]`, `HEAD /[id]`, `GET /u/[id]`, and `HEAD /u/[id]` use the Node.js runtime:

```ts
export const runtime = "nodejs";
```

The server authorizes the request, opens the stored file, and adapts its Node.js read stream to the web response body. It never reads the complete file into memory.

`HEAD` performs the same availability and metadata checks, closes the file handle immediately, and returns the download headers without creating a response stream.

Successful responses set:

- `Content-Type` from safe stored metadata, falling back to `application/octet-stream`.
- `Content-Length` from the opened file's stat result.
- `Content-Disposition: attachment` with a sanitized original filename.
- `Cache-Control: no-store`.
- `Accept-Ranges: bytes`.
- `X-Content-Type-Options: nosniff`.

The open file descriptor backs both the stat and stream, avoiding a path-swap window between validation and streaming. The stored path is resolved from server metadata under `UPLOAD_DIR`, never from the public route value.

One explicit `bytes=start-end` range returns `206` with `Content-Range`; open-ended ranges are capped at 4 MiB. A valid start at or beyond EOF returns `416`. Malformed, suffix, multi-range, and unsupported-unit headers deliberately fall back to a full `200`, matching current upstream behavior.

Nginx `X-Accel-Redirect` remains a possible future serving mode and is not required for basic Docker deployments.
