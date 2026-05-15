# Testing Strategy

Do not install test tooling during setup.

Future preference:

- Vitest for unit tests around server utilities, config parsing, token generation, path safety, and database helpers.
- Playwright optional later for browser-level upload, share, and download flows.

Prioritize tests where mistakes can lose files, bypass expiration, leak paths, or mis-handle large streams.

Keep tests practical. Avoid heavy test infrastructure until features exist.
