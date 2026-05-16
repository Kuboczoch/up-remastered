# E2E CI

The `CI` workflow runs Playwright E2E tests on pull requests and pushes to `master`.

The job:

- Installs dependencies with `npm ci`.
- Caches Playwright browser binaries by the installed `@playwright/test` version.
- Installs Chromium and required system dependencies.
- Runs `npm run test:e2e:ci`.
- Uploads `playwright-report` as a workflow artifact.

`npm run test:e2e:ci` builds the Next app, starts it through the Playwright `webServer` config, and runs the browser checks against the homepage, including the `@axe-core/playwright` accessibility scan.
