# Download Streaming

`GET /[id]` and `HEAD /[id]` use the Node.js runtime:

```ts
export const runtime = "nodejs";
```

The server authorizes the request, opens the stored file, and adapts its Node.js read stream to the web response body. It never reads the complete file into memory.

`HEAD` performs the same availability and metadata checks, closes the file handle immediately, and returns the download headers without creating a response stream.

Successful responses set:

- `Content-Type` from safe stored metadata, falling back to `application/octet-stream`.
- `Content-Length` from the opened file's stat result.
- `Content-Disposition: attachment` with a sanitized original filename.
- `Cache-Control: private, no-store`.
- `X-Content-Type-Options: nosniff`.

The open file descriptor backs both the stat and stream, avoiding a path-swap window between validation and streaming. The stored path is resolved from server metadata under `UPLOAD_DIR`, never from the public route value.

Nginx `X-Accel-Redirect` remains a possible future serving mode and is not required for basic Docker deployments.
