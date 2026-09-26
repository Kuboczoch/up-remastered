# Testing Strategy

Use small, focused test tooling as features need it.

Current coverage:

- Jest for component-level homepage checks, including `jest-axe` accessibility scans.
- Jest for server utility, SQLite metadata, and upload persistence/quota tests under `src/server/**` in a Node environment.
- Playwright for browser-level homepage and upload endpoint smoke checks, plus future share and download flows, including `@axe-core/playwright` accessibility scans.

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
