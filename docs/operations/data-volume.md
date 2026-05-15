# Data Volume

Persistent state belongs under `/data`.

Expected layout:

```txt
/data/app.db
/data/uploads/
```

Local Docker Compose maps:

```txt
./data:/data
```

Backups should include both SQLite files and uploads. If SQLite WAL mode is enabled later, include:

- `app.db`
- `app.db-shm`
- `app.db-wal`
- `uploads/`

Do not commit local data files.
