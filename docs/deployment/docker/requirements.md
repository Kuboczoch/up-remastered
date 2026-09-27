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
