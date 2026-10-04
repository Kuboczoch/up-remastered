# Native upload review evidence

These browser checks exercise the production standalone server, not `next dev`.
Use Node 24.14.x and pnpm 11. The current CI config runs both configurations
in one invocation: normal `chromium` keeps the 4 KiB ceiling and isolated
`chromium-stream` enforces the 1 MiB runtime ceiling. The large-stream case
is mandatory in `test:e2e:ci` and never silently skips disk evidence.
The default small-file suite is a separate buffered-upload regression; its
100% browser progress is **not** incomplete-stream evidence.

## Reproduce

From the repository root, reserve ports 3218 and 3219. Use the default small
limits for the build and normal project; the stream server applies its larger
limits at runtime from the same fresh standalone artifact.

```sh
export PORT=3218 HOSTNAME=127.0.0.1
export MAX_UPLOAD_SIZE=4096 MAX_STORED_BYTES=1048576
set -e -o pipefail
pnpm run build
pnpm run test:e2e:ci src/app/request-cancel.spec.ts --retries=0
```

Both cancellation tests run with one worker and write one combined HTML/JSON
report. For all default contracts plus the stream case, use `pnpm run check:full`.
For isolated repeated evidence use fresh owned normal and stream data directories;
the stream backend always uses `.playwright-data/stream` independently of normal
`DATABASE_URL`/`UPLOAD_DIR` overrides. See [E2E CI](ci/e2e.md) for dev opt-in.

## Combined-project verification

With Node 24.14.0 and pnpm 11.1.2, a fresh production build followed by
`pnpm run test:e2e:ci src/app/request-cancel.spec.ts src/app/api/upload.spec.ts src/app/utilities.spec.ts --retries=0`
passed all 8 selected tests with one worker and both projects in the JSON report.
The normal backend retained `MAX_UPLOAD_SIZE=4096`; its oversize-rejection
contract passed. Each cancellation test created a request at its exact bound
and required API 201 from its own backend before upload.

- Small buffered: 4096 bytes; 100% browser progress; cancellation cleanup and
  successful retry; second upload rejected with 404.
- Large actual stream: 1048576 bytes; 2% native XHR progress; 16248 actual partial
  disk bytes before cancellation; no remaining partial file after cancellation;
  successful retry and second upload rejected with 404.
- Typecheck, lint, format check, production build, and diff whitespace check passed.

This focused run does not claim a full-suite run. Test enumeration includes the
large case exactly once alongside all unchanged normal contracts. The existing
CI E2E job/report and `check:full` scripts select both projects without new jobs.

## Historical verified results (before combined-project wiring)

Based on main `31b1fce`, with only the three review specs and this document changed:

- Large production rebuild succeeded. Twelve selected executions passed with no
  retries (four tests repeated three times).
- Each large cancellation observed a real native browser XHR under CDP upload
  rate limiting, with 16248 temporary-file bytes out of 1048576 file bytes and
  cancellation-boundary progress of 2%, 2%, and 3% respectively.
- Cancellation returned the request to `retry` and restored the upload directory
  listing to its pre-upload state. Retry reached `consumed`. A second upload to
  that capability returned 404, retained `consumed`, and did not change disk entries.
- The separately rebuilt 4096-byte production configuration passed all 19
  applicable tests across the three files, with no retries.
- Typecheck and focused ESLint passed.
- Navigation holds the fetched home response until the original heading and form
  are visible with unchanged bounding rectangles and the document request has no
  RSC header. An inert same-origin observer reads the real outgoing document:
  Chromium redirects the navigating tab's automation target to the pending new
  document, so direct locator/CDP reads there stall. The observer does not alter
  the production form or focus logic; the original tab is brought back to front
  before clicking the production link, and the observer is closed afterwards.
- History-off seeds a valid prior entry under
  `up-remastered:upload-history:v1`, records relevant localStorage method calls,
  and verifies zero reads/mutations plus byte-for-byte preservation before upload,
  after upload, and after successful in-memory deletion and its real download 404.

Raw local logs:

- Large build: `/home/brunette/.hermes/cache/scratch/native-review-large-pMsn9H/build.log`
- Large final browser run: `/home/brunette/.hermes/cache/scratch/native-review-large-pMsn9H/browser-final-success.log`
- Small build: `/home/brunette/.hermes/cache/scratch/native-review-small-XIln79/build.log`
- Small browser run: `/home/brunette/.hermes/cache/scratch/native-review-small-XIln79/browser.log`

The aborted large request logs a server-side `AbortError`; browser assertions
still verify claim release, actual partial-byte disposal, and a successful retry.
This work does not resolve or bypass the separately pending locale/Vary security
approval. No production files, PRs, pushes, or merges are involved.

## Concurrent master copy integration

Merged master target `1b3a612e851a661d7135886e2688bb10ae1ba156` onto
`746f9c72fe6468cd89795dea1522e5a0230148db`. The six conflicts were reconciled
against both implementations: typed English/Polish request copy wrappers,
result-generation deletion fences, protected-link handling and native Share
remain intact. Master's separate result/history copy sequences, history
clear/disable invalidation, and accessible focus/click-selected manual input
were retained. Latest-attempt guards were also added to the shared request copy
wrapper and history-entry removal; result/history manual feedback is separate.

Production verification used Node 24.14.0 and pnpm 11.1.2, `CI=true`, port 3226,
fresh owned scratch database/upload directories, and default fixture limits of
4096 bytes, one-hour expiry and a 24-hour maximum. No server was reused.

- `up-merge-full-node24.log`: `check:full` passed; 49 Jest suites / 440 tests,
  11 cleanup tests, production build and 176 browser tests passed, with zero
  skips/flakes/retries. `up-merge-full-results.json` preserves the full browser
  report independently of later focused runs.
- `copy-links.spec.ts`: all 31 tests passed in the full suite, including master's
  18 surface/origin/permission checks and 13 deterministic deferred-copy cases.
- `up-merge-copy-negative.log`: all four selected mutation controls failed at
  the intended stale success/manual-link assertions after disabling sequence
  guards in a separate production snapshot. Main source/build were untouched.
- `up-merge-large-separate.log`: the dedicated large-stream project passed again
  separately with fresh storage; 1 MiB upload, 3% measured cancellation progress,
  32632 actual partial disk bytes before abort, zero partial files after cleanup,
  retry consumed successfully. Its expected disconnect AbortError is logged.
- `up-merge-vary-probe.log`: real HTML and RSC probes still lose
  `Accept-Language` and `Cookie` from Vary in Next 16.3.8. Private/no-store and
  Polish Content-Language remain, but the explicit locale Vary requirement is
  **not fulfilled**. No dependency patch or security bypass was applied; approval
  for the proposed framework patch remains outstanding.

The checked base/current shared copy helpers contain no `execCommand` fallback;
they use feature-detected native clipboard writes followed by manual recovery.
No nonexistent legacy fallback is claimed as retained. Passing the full suite
is regression evidence, not acceptance of the separately documented Vary
blocker or permission to deploy/merge the PR.
