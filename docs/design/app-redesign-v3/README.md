# Up Remastered — lifecycle redesign v3

## Open the prototype

Download `index.html` and open it directly in a modern browser. No build, CDN, fonts, or network connection is required at runtime. The collapsed **Design review** panel below the footer selects every state and can play a simulated transfer. Direct states work as `index.html#/success`, `#/request`, etc.

**This is a design reference, not a production build.** Upload progress, request updates, server responses, capabilities, deletion, and example URLs are simulated. No upload is sent to a server. Clipboard copying is real; QR generation is local and real; localStorage history/theme preference are real. Links use the reserved `up.example.com` domain. Stored preview metadata is not evidence of an uploaded file.

## Visual direction

Make v2 roughly 20–30% quieter as a design target, not a measured numerical claim:

- Replace the large split marketing layout with one compact, task-first column.
- Remove benefit badges, prominent history counts, duplicate help panels, decorative circles, oversized upload graphics, and lime accents.
- One restrained green primary action per step; white/off-white surfaces and thin separators.
- History uses unboxed rows. Keep Copy link visible; put QR, opening, removal, and deletion behind an accessible More menu.
- Advanced encoding and integration help stay collapsed, per #89.
- Shorten copy. No "Copy example" labels: normal Copy link/QR controls operate on clearly disclosed prototype URLs.
- Keep the wordmark, native lightweight System/Light/Dark selector, and subtle full-width footer consistent on every view.
- Mobile gets stacked result controls, wrap-safe filenames, 44px action targets, a compact header, and touch-appropriate upload instructions.

## Lifecycle coverage

33 review states cover:

- Home empty/history, text input, drag-over, uploading, success, and QR sharing.
- Interrupted, cancelled, oversized, quota, rate-limit, offline, unavailable-configuration, expired/unavailable-link, deleting, and delete-failure states.
- Request creation; owner waiting, receiving, complete, revoked; sender ready, uploading, complete, expired, and consumed.
- A separate safe text preview/download screen; production must add verified image/PDF/media handling under #82.

## Production contracts (not implemented by this prototype)

- Only successful server responses create history records. Use server-issued URL, ID, and exact `expiresAt`; never infer server success from simulated progress.
- Migrate valid legacy history if supported, prune expired entries, handle corrupted/blocked storage, synchronize cross-tab updates, and do not persist file contents or blob URLs.
- Restore geometry without hydration shifts; reserve history/status slots. Returning from requests must preserve the shell and source content under delayed route data.
- Copy and QR must contain exactly the intended public share or sender URL, never owner/deletion capabilities. Clipboard-denied contexts require manual-copy fallback.
- Separate Remove from list from Delete file. Local removal does not delete server data. Confirm destructive operations and wait for authoritative success; preserve retryable state on error.
- The future public download URL is reserved on request creation and unchanged after fulfillment. Before completion it uses a non-disclosing unavailable response.
- A sender can upload once within limits and never receives management/deletion authority. Request ownership stays with the requester.
- Production owner live status uses authenticated fetch-streaming SSE with visibility-aware bounded polling fallback; snapshot/reconnect is authoritative. No tokens in SSE payloads or query strings.
- Owner management links use a fragment capability, imported client-side and immediately scrubbed from history; Authorization headers carry API authority. They must never enter analytics, metadata, referrers, or shared QR codes.
- Duration controls and unit inputs must respect configuration, support custom time within limits, convert to exact safe integer bytes, and expose both relative and absolute local expiration times. The prototype validates future custom times in local time and retains semantic absolute expiration; server configuration remains authoritative in production.
- Raw downloads remain attachments. Only an explicit allowlisted preview path may render verified safe content under the security conditions in #82. The prototype demonstrates inert text only.
- Do not claim upload speed or ETA unless measured. The prototype progress is explicitly simulated; production cancellation must abort transport and discard partial writes.
- Never retain a stuck request claim after a failed/cancelled upload; honor server retryability.
- Keep fast 100–200ms transitions, reduced-motion handling, keyboard operation, focus management, and screen-reader announcements. Measure actual Next.js hydration/CLS and bundle impact, not this static artifact alone.

## Existing issue alignment

- #78: retain the simplified **up remastered** wordmark; do not bring back the rejected app icon. A matching minimal favicon remains implementation work.
- #79: proper page title/metadata capitalization; lowercase wordmark is intentional.
- #80: localStorage history and pruning; this user requirement supersedes old session-only expectations in #95.
- #81: no framework added for this artifact; production lazy-load QR/preview-heavy code, and rerun bundle/Lighthouse checks.
- #82: separate safe preview and attachment download. Plain-text visual reference included; production safety contract retained.
- #83: Upload another is below the successful link/share area.
- #84: full-zone drag treatment with explicit wording, not color alone.
- #85: replace prior slogans with direct task copy.
- #86/#87/#88: real package version, repository link, shared low-key full-width footer. Prototype captured package version 1.1.0; production reads its current package metadata.
- #89: encoding and CLI/ShareX in Advanced options.
- #90: short motion with a reduced-motion path.
- #91: distinct sender and owner links; owner warning and explicit copy action, private by capability—not by obscurity claims.
- #92: human-readable size/duration controls; custom-time input validates future dates and preserves localized expiry; exact server-limit edge cases still require production integration.
- #93: reserved download URL, owner-kept authority, sender-only completion, and owner status states. SSE backend is not implemented here.
- #94: persistent shell and direct back-navigation; no generic full-screen loading view. Test actual delayed RSC routing in production.
- #95: persistent history/status placement; verify real Next.js first paint/hydration separately.

## Verification

See `verification.json`, `review-verification.json`, `check.py`, and `check-review.py`. Regression checks cover history identity, exact local download bytes, owner-status transitions at a stable URL, Europe/Warsaw custom-expiry validation, and pre-paint theme setup. Tested 33 states at 320, 360, 390, 430, 768, and 1440px; clipboard round-trip; QR decoded using zxing-cpp; QR SVG download; upload completion/cancellation; safe filename rendering; history persistence; UTF-16 encoding; request-size rejection; revocation confirmation; sender/owner separation; themes; reduced motion; absence of JavaScript errors.

These are prototype checks, not production API, browser-compatibility, complete WCAG, or Next.js performance certification.

## Dependencies and license

QR source: `qrcode-generator@1.4.4`, fetched from official `registry.npmjs.org`, with archive SHA-512 integrity verified against published npm metadata. See `dependency-verification.json` and `QR-LICENSE.txt`. The npm archive lacks a standalone license file; its source explicitly declares MIT. Attribution and MIT terms are embedded in the self-contained HTML. No CDN runtime dependency.

The existing app already depends on `qrcode`; use that existing production dependency rather than adding this prototype-only generator to the application.
