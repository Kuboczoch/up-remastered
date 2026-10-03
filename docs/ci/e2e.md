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

`pnpm run test:e2e:ci` starts the already-built standalone app through the Playwright `webServer` config and runs the browser checks, including the `@axe-core/playwright` accessibility scan. In CI the E2E job downloads the production-build artifact. Locally, `pnpm run check:full` builds before invoking this command.

The Playwright web server defaults upload-related env vars to small local values when they are not already set:

- `DATABASE_URL=file://<repo>/.playwright-data/app.db`
- `UPLOAD_DIR=<repo>/.playwright-data/uploads`
- `MAX_UPLOAD_SIZE=512` (allows authenticated encryption envelope overhead)
- `MAX_STORED_BYTES=1048576`
- `DEFAULT_EXPIRATION_HOURS=1`
- `MAX_EXPIRATION_HOURS=24`

These defaults keep upload endpoint E2E checks fast while production config can keep the 1 GiB per-upload limit.
