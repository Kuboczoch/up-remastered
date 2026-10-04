# E2E CI

The `CI` workflow runs Playwright E2E tests on pull requests and pushes to `master`.

The job:

- Installs dependencies with `pnpm install --frozen-lockfile`.
- Caches Playwright browser binaries by the installed `@playwright/test` version.
- Installs Chromium and required system dependencies.
- Runs `pnpm run test:e2e:ci`.
- Uploads `playwright-report` as a workflow artifact.
- Uploads a Markdown summary even when Playwright or Lighthouse fails.

For pull requests, `.github/workflows/pr-e2e-comment.yaml` downloads that summary after CI finishes and creates or replaces one marker-tagged bot comment. The comment contains Playwright totals, Lighthouse category scores when available, the latest failure, and a workflow-run link. The separate `workflow_run` job owns the write token and never checks out or executes pull-request code.

`pnpm run test:e2e:ci` starts two independent production servers from the same already-built standalone artifact through the Playwright `webServer` config. It runs all default browser contracts, including accessibility and Lighthouse, plus the mandatory large-stream cancellation contract, with one test worker. In CI the existing E2E job downloads the production-build artifact; no additional CI job is needed. Locally, `pnpm run check:full` builds before invoking this command. Rebuild after config-only or test-only changes too: `pnpm run build && pnpm run test:e2e:ci`.

The normal `chromium` project uses `http://127.0.0.1:${PORT}` (default port 3000) and defaults upload-related env vars to small local values when they are not already set:

- `DATABASE_URL=file://<repo>/.playwright-data/app.db`
- `UPLOAD_DIR=<repo>/.playwright-data/uploads`
- `MAX_UPLOAD_SIZE=4096`
- `MAX_STORED_BYTES=1048576`
- `DEFAULT_EXPIRATION_HOURS=1`
- `MAX_EXPIRATION_HOURS=24`

The 4096-byte cap includes authenticated-envelope overhead. Oversize endpoint and browser regressions submit 4097 bytes and still require rejection. These defaults keep upload endpoint E2E checks fast while production config can keep the 1 GiB per-upload limit.

The `chromium-stream` project is scoped to `src/app/request-cancel.spec.ts` and selects only the dedicated large actual-stream cancellation test. Normal `chromium` excludes that exact test, not the rest of the cancellation file. The second server listens on `http://127.0.0.1:${PORT + 1}` (default 3001), with its own `.playwright-data/stream/app.db` and `.playwright-data/stream/uploads`, overriding runtime `MAX_UPLOAD_SIZE=1048576` and `MAX_STORED_BYTES=2097152`. Both production servers bind localhost and refuse reuse. The normal 4 KiB upload ceiling is unchanged; do not raise it globally to make the large test pass.

Cancellation tests inspect the upload directory from their project metadata, not the parent process environment. A real API request must return 201 for the requested limit before browser upload starts. The large test still requires actual partial disk bytes and native XHR progress below 100%, cancellation cleanup, successful retry, and a rejected second upload. Both projects feed the existing HTML/JSON report and PR summary in one run.

Development `pnpm run test:e2e` runs the normal project against `next dev`; it does not claim large-stream coverage. To opt in locally, first run `pnpm run build`, then `PLAYWRIGHT_LARGE_STREAM=1 pnpm run test:e2e src/app/request-cancel.spec.ts --workers=1`. The normal server remains dev, while the isolated stream server uses that fresh standalone artifact. Prefer `pnpm run build && pnpm run test:e2e:ci src/app/request-cancel.spec.ts --retries=0` for combined production cancellation evidence. Reserve both ports and use fresh owned data directories when repeating quota-sensitive checks. `test:lighthouse` retains its normal production-only project.
