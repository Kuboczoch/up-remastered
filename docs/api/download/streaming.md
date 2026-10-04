# Download Streaming

`GET /[id]`, `HEAD /[id]`, `GET /u/[id]`, and `HEAD /u/[id]` use the Node.js runtime:

```ts
export const runtime = "nodejs";
```

The server authorizes the request, opens the stored file, and adapts its Node.js read stream to the web response body. It never reads the complete file into memory.

`HEAD` performs the same availability and metadata checks, closes the file handle immediately, and returns the download headers without creating a response stream.

Before constructing a successful response, the server reads bounded head and tail samples through the same opened file descriptor used for streaming. It selects inline rendering only for verified safe content; it never trusts uploaded MIME metadata for this decision.

Successful responses set:

- `Content-Type` from verified content bytes, falling back to `application/octet-stream`.
- `Content-Length` from the opened file's stat result.
- `Content-Disposition: inline` for verified safe content or `attachment` for active, ambiguous, unsupported, and `?download=1` responses. Both forms include RFC 6266 `filename` and `filename*` parameters.
- `Cache-Control: no-store`.
- `Accept-Ranges: bytes`.
- `X-Content-Type-Options: nosniff`.
- `Content-Security-Policy: sandbox; default-src 'none'`.

The open file descriptor backs both the stat and stream, avoiding a path-swap window between validation and streaming. The stored path is resolved from server metadata under `UPLOAD_DIR`, never from the public route value.

One explicit `bytes=start-end` range returns `206` with `Content-Range`; open-ended ranges are capped at 4 MiB. A valid start at or beyond EOF, malformed, suffix, multi-range, and unsupported-unit headers return `416` with `Content-Range: bytes */size` and no response body. Rejected ranges and `HEAD` do not consume download slots. Every admitted body-bearing `GET`, including a supported range or an interrupted transfer, consumes one slot atomically; see [download requirements](requirements.md).

## Unavailable-file browser navigation

The public GET aliases add presentation **after** the shared download lifecycle returns unavailable. Ordinary document/iframe navigations (`Sec-Fetch-Mode: navigate`, document/iframe destination) that explicitly accept `text/html` receive a small, responsive branded HTML page with Home/Upload another actions. No JavaScript, hydration, remote assets, uploaded metadata or capability is included. The generic possible causes are identical for missing, expired, deleted and exhausted files: the page never identifies the actual cause.

Negotiation honors media-range specificity, valid quality values, explicit `q=0` exclusions and stronger non-HTML preferences. Wildcards alone, missing Fetch Metadata, API/fetch clients, ranges and `?download=1` retain the exact raw unavailable bytes. HEAD remains on the existing unmodified download path and never receives HTML. The current lifecycle uses 404 for all unavailable states; presentation preserves that status (and preserves 410 if supplied), `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. Successful file/range bytes, status, counters and security headers are unchanged.

Initial HTML uses the existing locale resolver: valid `?lang=en|pl`, then `up-locale` cookie, then weighted `Accept-Language`, then English. An explicit valid query persists the locale cookie; Home links preserve the resolved locale. Negotiated raw and HTML responses merge existing `Vary` with `Accept`, `Sec-Fetch-Mode`, `Sec-Fetch-Dest`, `Accept-Language` and `Cookie`. HTML adds `Content-Language`, `noindex, nofollow`, `Referrer-Policy: no-referrer` and a restrictive CSP allowing only its hash-pinned stylesheet. Shared locale dictionaries are not changed; unavailable copy lives in its own server module.

Coverage: negotiation/locale/security unit tests in `src/server/downloads/unavailable-page.test.ts`; production browser tests in `src/app/unavailable-browser.spec.ts` exercise real missing/expired/deleted/exhausted files through both aliases, raw/API/HEAD contracts, mobile Polish initial rendering, query/cookie precedence, keyboard recovery and axe accessibility.

Nginx `X-Accel-Redirect` remains a possible future serving mode and is not required for basic Docker deployments.
