# Browser Upload Experience

The homepage is a single-file upload client backed by `POST /api/upload`.

Its heading states that the service shares temporary files and text. Supporting copy makes automatic expiry and the lack of an account requirement explicit. This hierarchy shares the upload card's width, keeps one descriptive H1, and wraps without horizontal overflow at narrow viewports.

## Inputs

- Choose one file with the native picker.
- Drop exactly one file. Folder entries and ambiguous multi-file drops are rejected before any request.
- Paste one clipboard file or plain text anywhere on the page. Text defaults to UTF-8; selecting UTF-16 little-endian or UTF-16 big-endian in the text-upload controls changes the bytes and `text/plain` MIME charset used for pasted text.
- Enter text explicitly on narrow/mobile layouts when clipboard events are unavailable. The same encoding selection applies, and the generated text file has no byte-order mark.
- The server-rendered maximum upload size is refreshed from `GET /api/configuration`; oversized files are rejected before upload.

## States

The client exposes idle, uploading, error, and success states. Upload progress is announced and mirrored in the document title. Errors receive focus and provide a reset path. A successful upload shows the public URL, size, expiration countdown, and a responsive action hierarchy: Copy URL is primary, Open file and QR are secondary, and Upload another file is a neutral start-over action. Activating Upload another file restores keyboard focus to the file picker.

The one-time access token returned by the upload endpoint is never rendered or logged. Successful uploads, including their deletion tokens, are kept in versioned `sessionStorage` so history survives reloads in the same tab and is discarded when that tab closes; it is never copied to `localStorage`. This is convenience storage, not an XSS boundary: script executing on this origin can read the history and tokens, so the application must maintain its Content Security Policy and avoid unsafe script injection. Deleting a history entry sends its token to `DELETE /api/u/{id}`; a successful deletion, or a `404` for an already-missing file, removes the local entry.

## Verification

- Unit tests cover response validation, structured errors, byte formatting, progress, cancellation, metadata, and axe accessibility.
- Production Playwright tests cover picker upload, clipboard text/file upload, ambiguous drop and size rejection, copy/double-click copy, open URL, QR, expiry, reset focus, result-action keyboard order, responsive result actions, and upload-title progress.
- Lighthouse runs in observed mode on the production standalone server with score floors of 95 performance, 100 accessibility, 95 best practices, and 100 SEO. Explicit budgets additionally require FCP ≤1 s, LCP ≤1.5 s, TBT ≤200 ms, and CLS ≤0.1. Observed mode avoids substituting Lantern estimates for the measured local production build.
- The standalone asset-copy step includes both `public/` and `.next/static/`; without the latter, production HTML renders but cannot hydrate.
