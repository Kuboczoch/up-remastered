# Filesystem Storage Requirements

Uploaded file bytes will live on the local filesystem, not in SQLite.

Future defaults:

- Data root: `/data`.
- Upload directory: `/data/uploads`.
- SQLite database: `/data/app.db`.

Rules:

- Never trust client-provided paths.
- Generate stored filenames on the server.
- Base stored filenames on internal storage keys, not reusable public upload IDs.
- Sanitize original filenames for display and `Content-Disposition`.
- Prevent path traversal by resolving paths under `UPLOAD_DIR`.
- Stream large file reads and writes; do not buffer whole files in memory.
- Expect about three concurrent large uploads, not cloud-scale concurrency.
- Keep partially written upload files as temporary files and remove them when validation, streaming, quota, or database persistence fails.
- Enforce `MAX_UPLOAD_SIZE` per upload before commit.
- Enforce `MAX_STORED_BYTES` against stored upload metadata before accepting more bytes.

Current defaults:

- `MAX_UPLOAD_SIZE=1073741824` for a 1 GiB single-upload limit.
- `MAX_STORED_BYTES=10737418240` for a 10 GiB stored-data limit.
