# Testing Strategy

Use small, focused test tooling as features need it.

Current coverage:

- Jest for component-level homepage checks, including `jest-axe` accessibility scans.
- Playwright for browser-level homepage and future upload, share, and download flows, including `@axe-core/playwright` accessibility scans.

Useful commands:

- `pnpm run check` runs ESLint, TypeScript, and Jest unit tests.
- `pnpm run check:full` runs `check`, builds the standalone Next.js app, and runs Playwright E2E tests.
- `pnpm run preview` builds the app and starts the local production server.
- `pnpm run test:unit:watch` starts Jest in watch mode for local development.
- `pnpm run test:e2e:ui`, `pnpm run test:e2e:debug`, and `pnpm run test:e2e:report` support local Playwright inspection.

CI runs Jest in jsdom for component tests. CI runs Playwright after `pnpm run build` so the tests use the production Next.js output.

Future preference:

- Vitest for unit tests around server utilities, config parsing, token generation, path safety, and database helpers.

Prioritize tests where mistakes can lose files, bypass expiration, leak paths, or mis-handle large streams.

Keep tests practical. Avoid heavy test infrastructure until features exist.
