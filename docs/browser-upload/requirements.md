# Browser Upload Experience

The homepage is a single-file upload client backed by `POST /api/upload`.

Its heading states that the service shares temporary files and text. Supporting copy makes automatic expiry and the lack of an account requirement explicit. This hierarchy shares the upload card's width, keeps one descriptive H1, and wraps without horizontal overflow at narrow viewports.

## Theme

The interface uses one dark-only Graphite + Iris palette, regardless of the operating system's color-scheme preference. The canvas is `#202127`, card/input surfaces are `#2B2C35`, raised controls are `#373946`, and primary actions/focus indicators are `#A49AF5`. Text uses `#F0EFF8` and secondary text uses `#B1B0C4`; borders use `#505363`. Shared CSS tokens also cover success, warning, and error states.

The same palette applies to file/text uploads, results, dormant history, QR dialogs, request pages, and route boundaries. Landscape overlays derive from the surface token. Native controls, initial HTML, browser chrome, and the web manifest advertise the dark scheme before hydration. No light-theme toggle is offered. QR codes retain a white quiet zone for reliable scanning; it is not a light-themed UI surface.

Production browser tests verify the palette with light and dark OS preferences on mobile and desktop, visible keyboard focus, request controls, result/dialog surfaces, QR contrast, overflow, and axe accessibility.

## Inputs

- Choose one file with the native picker.
- Drop exactly one file. A page-wide, fixed-size overlay makes a valid active drop explicit without layout shift; nested drag events cannot flicker it, and leaving the window resets it. Folder entries, oversized files, and ambiguous multi-file drops are rejected before any request.
- Paste one clipboard file or plain text outside editable fields and Advanced options. Text uses UTF-8. Normal uploads require no advanced interaction.
- Enter text explicitly on narrow/mobile layouts when clipboard events are unavailable. The generated UTF-8 text file has no byte-order mark.
- Advanced options opens an attached side wing on wide desktops, an attached lower wing at intermediate widths, and a modal bottom sheet on mobile. It never moves/resizes the front card. The sheet uses a scrim, background inertness, contained keyboard focus, Escape/Done dismissal and trigger-focus restoration. ShareX and shell downloads live in the subdued footer.
- Save history is an enabled native checkbox switch, false when the localStorage preference flag is absent. Expiration offers 1, 3, 6, 12 and 24 hours (default 24) and applies to every upload entry point. Download limit is an enabled slider offering 1–10 or Unlimited, with the selected value announced by its output and aria-valuetext and submitted as maxDownloads for finite limits. Key protect is opt-in direct AES-256-GCM encryption in secure contexts up to 32 MiB; the complete fragment-key link opens a browser receiver. Text encoding remains a native-disabled UTF-8 placeholder with 0.5 opacity. Disclosure, Done, close, Escape, and focus restoration remain functional and undimmed.
- The server-rendered maximum upload size is refreshed from `GET /api/configuration`; oversized files are rejected before upload.

## States

The client exposes idle, uploading, error, and success states. Upload progress is announced and mirrored in the document title. Errors receive focus and provide a reset path. Offline status uses a fixed toast so connectivity initialization cannot move the upload workspace; retained browser history stays hidden without restoration. Configuration warnings remain inside the upload card without changing its dimensions. A successful upload shows the public URL, size, expiration countdown, and a responsive action hierarchy: Copy URL is primary; Open file, forced Download file, and QR are secondary; and Upload another file is a neutral start-over action. The result download action uses the documented `?download=1` server contract rather than relying on browser filename or MIME behavior. Activating Upload another file restores keyboard focus to the file picker. Keyboard focus on the visually hidden picker is projected onto its visible Choose file label. The QR overlay uses a native modal dialog: the background is inert, Tab/Shift+Tab remain inside, Escape/close/backdrop dismiss it, and focus returns to Show QR code. Body scrolling is restored after dismissal.

Short, feedback-driven motion reinforces drag activation, progress changes, error and success entry, Advanced options expansion, and successful URL copying. These transitions do not loop or delay interaction. `prefers-reduced-motion: reduce` reduces every animation and transition to effectively instant feedback.

The one-time access token returned by the upload endpoint is never rendered or logged. While Save history is disabled, uploads do not persist records or tokens and mount/event paths make zero history storage calls. Existing local/session data remains untouched. Records are shown only while history is enabled; disabling hides the list without changing stored records.

## Local history and privacy

Save history restores only the `up-remastered:history-enabled` localStorage flag on mount (exact `true` enables; absent defaults false), ignoring legacy consent. Enabling stores `true`; disabling removes the flag and never stores `false`. Disabled mount/upload/event paths make zero history record storage calls, with the preference lookup as the sole mount exception; no migration, synchronization, or automatic removal runs. Enabled mounts and enabling read local records without ordinary migration or pruning. Disabling hides the list and preserves stored records, while successful upload completion saves only if currently enabled. Blocked preference storage leaves a safe in-page setting with an actionable warning; uploads must not crash. Saved metadata includes fragment-free share URLs and deletion tokens, readable by same-origin site scripts in browser localStorage; encryption keys are never saved. Enabled history reads scrub fragments and extra fields from legacy local records as a narrow security exception to ordinary read-only access. No cookies or binary upload payloads are saved. Manual list actions are available only while enabled. See [Browser upload options](../browser/upload-options.md) for the complete contract. Paste into editable fields remains normal editing, not immediate upload.

## Verification

- Unit tests cover response validation, structured errors, byte formatting, progress, cancellation, metadata, axe accessibility, disabled Advanced controls and absence of history migration/storage writes.
- Production Playwright tests cover picker upload, clipboard text/file upload, stable drag enter/leave/exit/drop state, ambiguous drop and size rejection, copy/double-click copy, open URL, forced-download links, QR, expiry, reset focus, result-action keyboard order, responsive result actions, upload-title progress, disabled history across restarts/storage events, unchanged legacy records, native-disabled Advanced settings and uniform opacity across mobile/desktop, short feedback motion with reduced-motion handling, and the advanced disclosure's collapsed state, keyboard operation, accessible labels, integrations, and narrow layout. Raw-response browser regressions verify native inert-text and raster-image display plus attachment handling for active content. Refresh regressions seed browser history before scripts execute and require zero application-caused layout shift plus stable heading/upload-card bounds across repeated mobile and desktop reloads with delayed configuration, failed configuration, and offline initialization.
- Lighthouse runs in observed mode on the production standalone server with score floors of 95 performance, 100 accessibility, 95 best practices, and 100 SEO. Explicit budgets additionally require FCP ≤1 s, LCP ≤1.5 s, TBT ≤200 ms, and CLS ≤0.1. Observed mode avoids substituting Lantern estimates for the measured local production build.
- The standalone asset-copy step includes both `public/` and `.next/static/`; without the latter, production HTML renders but cannot hydrate.
