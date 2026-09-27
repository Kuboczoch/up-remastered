# Browser Upload Experience

The homepage is a single-file upload client backed by `POST /api/upload`.

Its heading states that the service shares temporary files and text. Supporting copy makes automatic expiry and the lack of an account requirement explicit. This hierarchy shares the upload card's width, keeps one descriptive H1, and wraps without horizontal overflow at narrow viewports.

## Theme

The interface uses one dark-only Graphite + Iris palette, regardless of the operating system's color-scheme preference. The canvas is `#202127`, card/input surfaces are `#2B2C35`, raised controls are `#373946`, and primary actions/focus indicators are `#A49AF5`. Text uses `#F0EFF8` and secondary text uses `#B1B0C4`; borders use `#505363`. Shared CSS tokens also cover success, warning, and error states.

The same palette applies to file/text uploads, results, history, QR dialogs, request pages, and route boundaries. Landscape overlays derive from the surface token. Native controls, initial HTML, browser chrome, and the web manifest advertise the dark scheme before hydration. No light-theme toggle is offered. QR codes retain a white quiet zone for reliable scanning; it is not a light-themed UI surface.

Production browser tests verify the palette with light and dark OS preferences on mobile and desktop, visible keyboard focus, request controls, result/dialog surfaces, QR contrast, overflow, and axe accessibility.

## Inputs

- Choose one file with the native picker.
- Drop exactly one file. A page-wide, fixed-size overlay makes a valid active drop explicit without layout shift; nested drag events cannot flicker it, and leaving the window resets it. Folder entries, oversized files, and ambiguous multi-file drops are rejected before any request.
- Paste one clipboard file or plain text anywhere on the page. Text defaults to UTF-8; selecting UTF-16 little-endian or UTF-16 big-endian in the collapsed, right-aligned Advanced options disclosure changes the bytes and `text/plain` MIME charset used for pasted text. Normal uploads require no advanced interaction.
- Enter text explicitly on narrow/mobile layouts when clipboard events are unavailable. The same encoding selection applies, and the generated text file has no byte-order mark.
- Advanced options uses a native keyboard-accessible disclosure and contains text encoding plus the ShareX and shell integration downloads. Its content consumes no layout space while collapsed and remains within the viewport on narrow layouts.
- The server-rendered maximum upload size is refreshed from `GET /api/configuration`; oversized files are rejected before upload.

## States

The client exposes idle, uploading, error, and success states. Upload progress is announced and mirrored in the document title. Errors receive focus and provide a reset path. A successful upload shows the public URL, size, expiration countdown, and a responsive action hierarchy: Copy URL is primary, Open file and QR are secondary, and Upload another file is a neutral start-over action. Activating Upload another file restores keyboard focus to the file picker.

Short, feedback-driven motion reinforces drag activation, progress changes, error and success entry, Advanced options expansion, and successful URL copying. These transitions do not loop or delay interaction. `prefers-reduced-motion: reduce` reduces every animation and transition to effectively instant feedback.

The one-time access token returned by the upload endpoint is never rendered or logged. Successful uploads, including their deletion tokens, are kept in versioned `sessionStorage` so history survives reloads in the same tab and is discarded when that tab closes; it is never copied to `localStorage`. This is convenience storage, not an XSS boundary: script executing on this origin can read the history and tokens, so the application must maintain its Content Security Policy and avoid unsafe script injection. Deleting a history entry sends its token to `DELETE /api/u/{id}`; a successful deletion, or a `404` for an already-missing file, removes the local entry.

## Verification

- Unit tests cover response validation, structured errors, byte formatting, progress, cancellation, metadata, and axe accessibility.
- Production Playwright tests cover picker upload, clipboard text/file upload, stable drag enter/leave/exit/drop state, ambiguous drop and size rejection, copy/double-click copy, open URL, QR, expiry, reset focus, result-action keyboard order, responsive result actions, upload-title progress, short feedback motion with reduced-motion handling, and the advanced disclosure's collapsed state, keyboard operation, accessible labels, integrations, and narrow layout.
- Lighthouse runs in observed mode on the production standalone server with score floors of 95 performance, 100 accessibility, 95 best practices, and 100 SEO. Explicit budgets additionally require FCP ≤1 s, LCP ≤1.5 s, TBT ≤200 ms, and CLS ≤0.1. Observed mode avoids substituting Lantern estimates for the measured local production build.
- The standalone asset-copy step includes both `public/` and `.next/static/`; without the latter, production HTML renders but cannot hydrate.
