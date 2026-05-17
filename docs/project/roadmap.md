# Roadmap

1. Repository setup: tooling, docs, Docker, Cursor rules, hello-world homepage.
2. Server foundation: SQLite connection and Drizzle schema are in place; env validation and storage path helpers remain.
3. Upload flow: form, streamed file write, metadata insert, share URL response.
4. Share page: public token lookup, availability states, optional password prompt.
5. Download flow: authorization checks, safe headers, direct streaming mode.
6. Cleanup: script for expired files and docs for cron or Docker Compose invocation.
7. Optional reverse proxy mode: authorize in Next.js, serve file through Nginx `X-Accel-Redirect`.

Keep each step small. Do not add cloud storage, queues, auth providers, or extra services without explicit request.
