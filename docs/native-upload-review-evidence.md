# Native upload review evidence

These browser checks exercise the production standalone server, not `next dev`.
Use Node 24.14.x and pnpm 11. Run the two configurations separately: the
large-stream case is mandatory when selected and fails explicitly if
`MAX_UPLOAD_SIZE` is below 1048576. It never silently skips disk evidence.
The default small-file suite is a separate buffered-upload regression; its
100% browser progress is **not** incomplete-stream evidence.

## Reproduce

From the repository root, reserve port 3218 and create a new owned data directory
for each configuration. Keep these variables identical for build and browser run:

```sh
export DATA_DIR=$(mktemp -d "${TMPDIR:?}/native-review-XXXXXX")
export DATABASE_URL="file:$DATA_DIR/app.db"
export UPLOAD_DIR="$DATA_DIR/uploads"
export MAX_UPLOAD_SIZE=1048576 MAX_STORED_BYTES=16777216
export DEFAULT_EXPIRATION_HOURS=1 MAX_EXPIRATION_HOURS=24
export UP_PUBLIC_ORIGIN=http://127.0.0.1:3218
export PORT=3218 HOSTNAME=127.0.0.1 CI=1
set -e -o pipefail
pnpm run build 2>&1 | tee "$DATA_DIR/build.log"
pnpm exec playwright test src/app/requested-upload.spec.ts \
  src/app/request-cancel.spec.ts src/app/upload-ticket-ux.spec.ts \
  --grep 'keeps the request form visible|history-off|default small buffered|dedicated large actual-stream' \
  --workers=1 --retries=0 --repeat-each=3 --reporter=line \
  2>&1 | tee "$DATA_DIR/browser.log"
```

For the default small-file regression, create another fresh `DATA_DIR`, update
`DATABASE_URL` and `UPLOAD_DIR`, set `MAX_UPLOAD_SIZE=4096` and
`MAX_STORED_BYTES=1048576`, and **rebuild** before this run:

```sh
pnpm run build 2>&1 | tee "$DATA_DIR/build.log"
pnpm exec playwright test src/app/requested-upload.spec.ts \
  src/app/request-cancel.spec.ts src/app/upload-ticket-ux.spec.ts \
  --grep-invert 'dedicated large actual-stream' \
  --workers=1 --retries=0 --reporter=line \
  2>&1 | tee "$DATA_DIR/browser.log"
```

The exclusion is only for the independently configured small-file run; both
commands are required for complete evidence. A default unfiltered E2E run with
a 4096-byte ceiling cannot satisfy the mandatory 1 MiB test.

## Verified results

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
