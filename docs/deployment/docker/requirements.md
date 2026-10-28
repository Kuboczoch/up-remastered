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
