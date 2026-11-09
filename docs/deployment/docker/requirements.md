# Docker Requirements

Docker is the primary deployment target.

Requirements:

- Use Node 24.14.
- Build dependencies with pnpm and the committed `pnpm-lock.yaml`.
- Build Next.js with `output: "standalone"`.
- Copy `public/` into the standalone output and place `.next/static/` beside the deployed standalone server so it serves all browser assets.
- Mount host `./data` to container `/data`.
- Allow operators to configure the host data directory, published bind address, and host port without editing the Compose file.
- Pass the public origin and all upload, storage, and expiration limits from Compose configuration to the application.
- Keep SQLite database at `/data/app.db`.
- Keep uploaded files under `/data/uploads`.
- Preserve `/data` across restarts.
- Initialize bind-mount ownership through the one-shot `init-data` Compose service while the app itself remains non-root.
- Expose `/api/health`; the image health check requires both a working SQLite query and a writable upload directory.
- Keep deployment documentation infrastructure-neutral; reverse-proxy examples must not name a specific host or private network.

The app should be suitable for a VPS, home server, NAS, Coolify, Dokku, or Docker Compose.

Do not assume Vercel/serverless local filesystem behavior.

## Build-time public configuration

The homepage, new-request page, management shell, and eligible metadata routes
are prerendered. `UP_PUBLIC_ORIGIN`, `MAX_UPLOAD_SIZE`,
`DEFAULT_EXPIRATION_HOURS`, and `MAX_EXPIRATION_HOURS` are Docker build arguments
as well as runtime environment variables. Compose passes the same values to
every build target and to the app. A plain `docker build` also retains its build
arguments as runner defaults, so generated metadata and API links agree.

Changing any of these values requires rebuilding the image and redeploying it
(`docker compose up --build -d`). A runtime-only override does not regenerate
HTML, canonical/Open Graph URLs, JSON-LD, robots, or the sitemap. Keep the build
and runtime public origin identical; do not use the internal container address
as the public origin.

This is not a static export. Upload/download handlers, capability-token pages,
and database-backed routes remain Node server routes. Runtime API configuration
and validation remain authoritative, including when rejecting requests from an
older browser page with stale baked limits. The request form still validates
the runtime limits before allowing submission.

## Application-owned final-response layer

Production starts through `scripts/start.mjs`, not the generated `server.js`
directly. The launcher starts the unchanged Next standalone server on a private
loopback port and exposes a streaming HTTP proxy on `HOSTNAME` (default
`0.0.0.0`) and `PORT` (default `3000`). It waits for `/api/health` before opening
the public listener and terminates the child on shutdown or startup failure.

- From the repository: `pnpm build && pnpm start`.
- From a copied `.next/standalone` directory: `node scripts/start.mjs`.
- Docker/Compose: the image command already uses `node scripts/start.mjs`.
  Do not override it with `node server.js` or `next start`; those bypass the
  final-response contract.

The proxy augments final HTML and React Server Component responses with the
case-insensitive union of the framework's `Vary` tokens, `Accept-Language`, and
`Cookie`. It preserves `Vary: *`. It does not replace framework headers or
depend on `no-store` to hide a missing cache key. Locale selection and SSR
translations are a separate application concern; these headers alone do not
constitute localization acceptance.

API and raw transfer responses retain their status, body, range/HEAD behavior,
content encoding, validators, capability headers, and cache policy. Bodies are
piped with backpressure, without decoding, buffering or automatic retries.
Client cancellation aborts the upstream stream. This is an HTTP application
proxy, not a WebSocket server. Keep the existing public-origin build/runtime
parity; the private backend address is never a public origin.
