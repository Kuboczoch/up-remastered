# Testing Strategy

Use small, focused test tooling as features need it.

Current coverage:

- Jest for component-level homepage checks, including `jest-axe` accessibility scans.
- Playwright for browser-level homepage and future upload, share, and download flows, including `@axe-core/playwright` accessibility scans.

Useful commands:

- `npm run check` runs ESLint, TypeScript, and Jest unit tests.
- `npm run check:full` runs `check`, builds the standalone Next.js app, and runs Playwright E2E tests.
- `npm run preview` builds the app and starts the local production server.
- `npm run test:unit:watch` starts Jest in watch mode for local development.
- `npm run test:lighthouse` runs the Playwright-backed Lighthouse homepage baseline from `docs/testing/lighthouse-baseline.md`.
- `npm run test:e2e:ui`, `npm run test:e2e:debug`, and `npm run test:e2e:report` support local Playwright inspection.

CI runs Jest in jsdom for component tests. CI runs Playwright after `npm run build` so the tests use the production Next.js output.

Future preference:

- Vitest for unit tests around server utilities, config parsing, token generation, path safety, and database helpers.

Prioritize tests where mistakes can lose files, bypass expiration, leak paths, or mis-handle large streams.

Keep tests practical. Avoid heavy test infrastructure until features exist.
