# Project Overview

`up - remastered` (`up`) is a self-hosted temporary file hosting service and a JavaScript/TypeScript rewrite of `Starchasers/up` without a Kotlin/JVM backend.

Current capabilities:

- responsive browser upload, drag/drop, clipboard, and encoded text input;
- streamed uploads with configurable byte, storage, and expiration limits;
- anonymous tab-lifetime upload history and authenticated deletion;
- expiring single-use requested-upload links with separate uploader and owner capabilities;
- five-character share IDs, safe attachment delivery, byte ranges, and management APIs;
- SQLite metadata with checked-in Drizzle migrations;
- lease-safe expired-upload cleanup for cron or Docker Compose;
- standalone Next.js deployment, Docker health checks, persistent `/data`, and automated CI/E2E/Lighthouse coverage.

The design targets VPS, home server, NAS, Coolify, Dokku, and Docker Compose deployments. It deliberately avoids serverless ephemeral filesystems, cloud storage, queues, account providers, and JVM runtime dependencies.
