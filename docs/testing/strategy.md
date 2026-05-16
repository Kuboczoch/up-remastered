# Testing Strategy

Use small, focused test tooling as features need it.

Current coverage:

- Jest for component-level homepage checks, including `jest-axe` accessibility scans.
- Playwright for browser-level homepage and future upload, share, and download flows, including `@axe-core/playwright` accessibility scans.

CI runs Jest in jsdom for component tests. CI runs Playwright after `npm run build` so the tests use the production Next.js output.

Future preference:

- Vitest for unit tests around server utilities, config parsing, token generation, path safety, and database helpers.

Prioritize tests where mistakes can lose files, bypass expiration, leak paths, or mis-handle large streams.

Keep tests practical. Avoid heavy test infrastructure until features exist.
