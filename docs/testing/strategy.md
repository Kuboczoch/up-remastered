# Testing Strategy

Use small, focused test tooling as features need it.

Current coverage:

- Jest for component-level homepage checks, including `jest-axe` accessibility scans.
- Jest for server utility, SQLite metadata, and upload persistence/quota tests under `src/server/**` in a Node environment.
- Playwright for browser-level homepage and upload endpoint smoke checks, plus future share and download flows, including `@axe-core/playwright` accessibility scans. Homepage coverage records browser `layout-shift` entries and heading/upload-control geometry across mobile and desktop refreshes with restored history, delayed or failed configuration, and offline initialization.

Current-result deletion coverage:

- `current-result-deletion.test.tsx` verifies no-history capability deletion,
  cancellation and focus containment, duplicate submission suppression, exact
  management confirmation, and retry after HTTP, proxy, network and abort failures.
- `browser-options.test.tsx` verifies the real uploader exposes deletion with
  history off and removes every sharing action after confirmation.
- `current-result-deletion.spec.ts` uses real disposable plain and key-protected
  uploads, cancellation, failure interception followed by real deletion, terminal
  focus, no history writes, and validated cleanup. Traces, screenshots and video
  are disabled to avoid capturing owner capabilities or fragment keys. Browser
  execution requires an approved runtime/production build; discovery is not a pass.

Useful commands:

- `pnpm run check` verifies formatting and JVM absence, then runs ESLint, TypeScript, and unit tests.
- `pnpm run check:full` runs `check`, builds the standalone Next.js app, and runs Playwright E2E tests.
- `pnpm run preview` builds the app and starts the local production server.
- `pnpm run test:unit:watch` starts Jest in watch mode for local development.
- `pnpm run test:lighthouse` runs the Playwright-backed Lighthouse homepage baseline from `docs/testing/lighthouse-baseline.md`.
- `pnpm run test:e2e:ui`, `pnpm run test:e2e:debug`, and `pnpm run test:e2e:report` support local Playwright inspection.
- `pnpm exec jest --selectProjects server src/server/db/database.test.ts --runInBand` runs the focused SQLite migration and insert/read verification path.
- `pnpm exec jest --selectProjects server src/server/uploads/create-upload.test.ts --runInBand` runs focused upload streaming, quota, and expiration checks.

CI runs Jest with separate app and server projects: app/component tests use jsdom, while `src/server/**/*.test.ts` runs in Node. CI runs Playwright after `pnpm run build` so the tests use the production Next.js output.

Prioritize tests where mistakes can lose files, bypass expiration, leak paths, or mis-handle large streams.

Keep tests practical. Avoid heavy test infrastructure until features exist.
