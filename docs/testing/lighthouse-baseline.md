# Lighthouse Baseline

The public homepage has a repeatable Lighthouse baseline run through Playwright.
It tracks the same browser target as the E2E suite and does not introduce
analytics, real user monitoring, or any external scoring service.

## Command

Run the baseline audit locally:

```bash
npm run test:lighthouse
```

The Playwright test starts the local app through `playwright.config.ts`, launches
Chromium with a remote debugging port, runs Lighthouse against `/`, and attaches
the score JSON to the Playwright test output under `test-results/`.

## Current Baseline

Captured on 2026-05-16 against `http://127.0.0.1:3000/`:

| Category | Score | Minimum |
| --- | ---: | ---: |
| Performance | 99 | 90 |
| Accessibility | 100 | 100 |
| Best practices | 96 | 95 |
| SEO | 100 | 100 |

The minimum score thresholds are intentionally small and explicit. Update this
doc and the matching Playwright threshold in the same change whenever the
homepage baseline changes.
