# Docker Requirements

Docker is the primary deployment target.

Requirements:

- Use Node 24.14.
- Build Next.js with `output: "standalone"`.
- Mount host `./data` to container `/data`.
- Keep SQLite database at `/data/app.db`.
- Keep uploaded files under `/data/uploads`.
- Preserve `/data` across restarts.

The app should be suitable for a VPS, home server, NAS, Coolify, Dokku, or Docker Compose.

Do not assume Vercel/serverless local filesystem behavior.
