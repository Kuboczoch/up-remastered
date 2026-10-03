# Download Streaming

`GET /[id]`, `HEAD /[id]`, `GET /u/[id]`, and `HEAD /u/[id]` use the Node.js runtime:

```ts
export const runtime = "nodejs";
```

The server authorizes the request, opens the stored file, and adapts its Node.js read stream to the web response body. It never reads the complete file into memory.

`HEAD` performs the same availability and metadata checks, closes the file handle immediately, and returns the download headers without creating a response stream.

For non-encrypted uploads, before constructing a successful response, the server reads bounded head and tail samples through the same opened file descriptor used for streaming. It selects inline rendering only for verified safe content; it never trusts uploaded MIME metadata for this decision.

Successful responses set:

- `Content-Type` from verified content bytes, falling back to `application/octet-stream`.
- `Content-Length` from the opened file's stat result.
- `Content-Disposition: inline` for verified safe content or `attachment` for active, ambiguous, unsupported, and `?download=1` responses. Both forms include RFC 6266 `filename` and `filename*` parameters.
- `Cache-Control: no-store`.
- `Accept-Ranges: bytes`.
- `X-Content-Type-Options: nosniff`.
- `Content-Security-Policy: sandbox; default-src 'none'`.

The open file descriptor backs both the stat and stream, avoiding a path-swap window between validation and streaming. The stored path is resolved from server metadata under `UPLOAD_DIR`, never from the public route value.

One explicit `bytes=start-end` range returns `206` with `Content-Range`; open-ended ranges are capped at 4 MiB. A valid start at or beyond EOF returns `416`. Malformed, suffix, multi-range, and unsupported-unit headers deliberately fall back to a full `200`, matching current upstream behavior.

Nginx `X-Accel-Redirect` remains a possible future serving mode and is not required for basic Docker deployments.
