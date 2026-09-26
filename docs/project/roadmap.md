# Roadmap

## Complete

- Repository, TypeScript, Next.js, Docker, SQLite, migrations, environment validation, and storage foundations.
- Browser and API upload flows, public share/download routes, management APIs, and requested-upload links.
- Safe attachment headers, range requests, anonymous history, cleanup leases, health checks, CI, Playwright, and Lighthouse verification.
- Complete upstream capability and issue parity matrix.

## Optional future work

- Password-protected uploads, if a concrete product requirement is approved.
- Reverse-proxy offload through Nginx `X-Accel-Redirect`, if deployment measurements justify the additional operational complexity.

Do not add cloud storage, queues, auth providers, or extra services without an explicit requirement.
