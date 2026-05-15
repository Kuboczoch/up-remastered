# Cleanup Expired Files Script

Future script:

```txt
scripts/cleanup-expired-files.ts
```

Expected behavior:

- Find expired rows in SQLite.
- Delete physical files from disk.
- Delete or mark database rows.
- Handle missing files gracefully.
- Log useful summary output.
- Be safe to run from cron or a Docker Compose one-shot service.

This is allowed maintenance. Do not replace it with a long-running queue worker or Redis-backed job system unless explicitly requested.

Expiration still must be enforced by download routes.
