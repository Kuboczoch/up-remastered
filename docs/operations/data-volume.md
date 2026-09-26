# Data Volume

Persistent state belongs under `/data`:

```txt
/data/app.db
/data/uploads/
```

Local Docker Compose maps `./data:/data`. The `init-data` one-shot service creates the upload directory and repairs ownership for the non-root application user before startup.

## Cold backup

Use a cold backup so SQLite and uploaded bytes represent the same point in time. Do not independently copy live `app.db`, `app.db-wal`, and `app.db-shm` files.

```bash
docker compose stop up
tar -C . -czf "up-backup-$(date +%Y%m%d-%H%M%S).tar.gz" data
docker compose start up
```

Store the archive outside the application host and test restores periodically.

## Restore

Stop the writer, retain the current data as a rollback copy, extract the archive, repair ownership, and validate SQLite before starting the app:

```bash
docker compose stop up
mv data "data.before-restore-$(date +%Y%m%d-%H%M%S)"
tar -C . -xzf up-backup-YYYYMMDD-HHMMSS.tar.gz
docker compose run --rm init-data
docker compose run --rm --no-deps cleanup node -e \
  "const D=require('better-sqlite3');const d=new D('/data/app.db',{readonly:true});const r=d.pragma('integrity_check',{simple:true});d.close();if(r!=='ok'){console.error(r);process.exit(1)}"
docker compose up -d up
```

After startup, verify `docker compose ps` reports the service healthy and download a known retained file. Delete the rollback directory only after application-level verification.

The Drizzle migration history lives inside `app.db`; checked-in migration SQL remains under `drizzle/`. Application startup applies newer migrations idempotently.
