# Docker Requirements

Docker is the primary deployment target.

Requirements:

- Use Node 24.14.
- Build dependencies with pnpm and the committed `pnpm-lock.yaml`.
- Build Next.js with `output: "standalone"`.
- Copy `public/` into the standalone output and place `.next/static/` beside the deployed standalone server so it serves all browser assets.
- Mount host `./data` to container `/data`.
- Keep SQLite database at `/data/app.db`.
- Keep uploaded files under `/data/uploads`.
- Preserve `/data` across restarts.

The app should be suitable for a VPS, home server, NAS, Coolify, Dokku, or Docker Compose.

Do not assume Vercel/serverless local filesystem behavior.
