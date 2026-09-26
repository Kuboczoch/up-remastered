# Cleanup Expired Files

`pnpm run cleanup:expired` removes expired upload files and SQLite metadata. Download routes still enforce expiration at read time; cleanup only reclaims disk, quota, and public IDs.

## Lifecycle safety

Each expired row is atomically claimed in SQLite before filesystem work. Claims are leases:

- concurrent cleaners cannot process the same row;
- claims older than ten minutes may be recovered after a crashed process;
- live rows are never claimable;
- the stored file is unlinked before metadata is deleted;
- quota and the five-character public ID remain reserved until metadata deletion succeeds;
- a missing file is treated as already removed and its expired row is deleted;
- other filesystem failures release the claim, preserve metadata/quota, and make the command exit nonzero;
- rerunning the command is safe and idempotent.

Unsafe stored paths are failures. Cleanup never follows a path from request input and never logs IDs, filenames, tokens, or paths.

## Local invocation

Set the same storage variables as the application:

```bash
DATABASE_URL=file:./data/app.db \
UPLOAD_DIR=./data/uploads \
pnpm run cleanup:expired
```

The command applies checked-in migrations before cleanup. It writes one JSON summary:

```json
{"event":"expired_upload_cleanup_complete","examined":3,"claimed":3,"deleted":2,"missing":1,"failed":0,"freedBytes":2048}
```

Exit status is `0` when `failed` is zero and `1` when any row could not be cleaned or startup failed.

## Docker Compose and cron

One-shot cleanup uses the same bind-mounted `./data` directory:

```bash
docker compose run --rm cleanup
```

Example host cron entry, every 15 minutes:

```cron
*/15 * * * * cd /srv/up-remastered && docker compose run --rm cleanup >> /var/log/up-remastered-cleanup.log 2>&1
```

Run only one schedule per deployment. Concurrent accidental invocations remain safe because SQLite claims serialize each row.
