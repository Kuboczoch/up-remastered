# Browser Upload Experience

The homepage is a single-file upload client backed by `POST /api/upload`.

## Inputs

- Choose one file with the native picker.
- Drop exactly one file. Folder entries and ambiguous multi-file drops are rejected before any request.
- Paste one clipboard file or UTF-8 plain text anywhere on the page.
- Enter text explicitly on narrow/mobile layouts when clipboard events are unavailable.
- The server-rendered maximum upload size is refreshed from `GET /api/configuration`; oversized files are rejected before upload.

## States

The client exposes idle, uploading, error, and success states. Upload progress is announced and mirrored in the document title. Errors receive focus and provide a reset path. A successful upload shows the public URL, copy/open actions, QR code, size, expiration countdown, and an upload-another action.

The one-time access token returned by the upload endpoint remains only in component memory. It is not rendered, logged, or persisted in browser storage.

## Verification

- Unit tests cover response validation, structured errors, byte formatting, progress, cancellation, metadata, and axe accessibility.
- Production Playwright tests cover picker upload, clipboard text/file upload, ambiguous drop and size rejection, copy/double-click copy, open URL, QR, expiry, reset, responsive layout, and upload-title progress.
- Lighthouse runs in observed mode on the production standalone server with score floors of 95 performance, 100 accessibility, 95 best practices, and 100 SEO. Explicit budgets additionally require FCP ≤1 s, LCP ≤1.5 s, TBT ≤200 ms, and CLS ≤0.1. Observed mode avoids substituting Lantern estimates for the measured local production build.
- The standalone asset-copy step includes both `public/` and `.next/static/`; without the latter, production HTML renders but cannot hydrate.
