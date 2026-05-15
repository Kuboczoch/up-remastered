# Filesystem Storage Requirements

Uploaded file bytes will live on the local filesystem, not in SQLite.

Future defaults:

- Data root: `/data`.
- Upload directory: `/data/uploads`.
- SQLite database: `/data/app.db`.

Rules:

- Never trust client-provided paths.
- Generate stored filenames on the server.
- Sanitize original filenames for display and `Content-Disposition`.
- Prevent path traversal by resolving paths under `UPLOAD_DIR`.
- Stream large file reads and writes; do not buffer whole files in memory.
- Expect about three concurrent large uploads, not cloud-scale concurrency.

The setup step does not create upload logic.
