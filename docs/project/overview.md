# Project Overview

`up - remastered` (`up` for short) is a small self-hosted temporary file hosting service.

The goal is boring durability: run on a VPS, home server, NAS, Coolify, Dokku, or Docker Compose without depending on Vercel/serverless filesystem behavior.

Current setup scope:

- Next.js App Router foundation.
- TypeScript enforced.
- One hello-world homepage.
- Docker baseline with `/data` persistence.
- Scoped docs and Cursor rules for future work.

Deferred:

- Upload UI and API.
- Share pages.
- Download authorization and streaming.
- SQLite schema and Drizzle migrations.
- Cleanup script.
