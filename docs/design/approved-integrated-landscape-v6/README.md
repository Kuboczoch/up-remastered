# Approved integrated-landscape design

Latest visual reference for issue #96. This preserves the approved white-only design and the selected **Alpine dawn** artwork (option 2 in the second landscape round).

## Review

Open `index.html` in a browser. This is a standalone, self-contained prototype. The collapsed Design review menu below the footer exposes all 33 lifecycle states. Uploads, server expiry, deletion, and request-owner events remain simulated; do not copy simulated behavior into production.

For clipboard tests, serve the directory on localhost or HTTPS. `python3 -m http.server 8765 --directory ..` serves this folder as `/v6-approved/`.

## Image implementation

- Existing non-AI illustration: [Forrest And Mountains Illustration](https://openclipart.org/detail/285129/forrest-and-mountains-illustration), published by GDJ on August 17, 2017, sourced there from Pixabay.
- Distribution basis: [Openclipart public-domain/CC0 policy](https://openclipart.org/share).
- `landscape.webp` is the exact 2000 × 1002 image used in the approved preview. It is retained without a new crop here; the separate 52-image weekly collection will have uniform 1920 × 1080 exports.
- `styles.css` implements the artwork as an absolutely positioned `.scene` with a gradient mask inside the existing upload surface. It contributes no layout height, has no pointer interaction, and uses a mobile-specific crop/mask.
- `build.py` embeds the asset as a data URL in the standalone HTML. Production should use a locally bundled asset instead of hotlinking or duplicating large data URLs in CSS.
- White only; no theme selector. Preserve legibility and touch targets. No separate landscape banner.

## Editable source

`template.html`, `styles.css`, `app.js`, `qrcode.js`, `landscape.webp` → `python3 build.py` → `index.html`.

QR library licensing is in `QR-LICENSE.txt`. Existing app behavior remains a design simulation. Share URLs in production must serve raw safe file bytes or download unsafe/unsupported types, per #82; no custom file-view wrapper.

## Verification

- `check.py`: 33 states at 320, 360, 390, 430, 768, and 1440 px; no horizontal overflow or JavaScript errors; white background even with OS dark preference.
- `interactions.py`: no artwork layout displacement, simulated file/text upload, clipboard copy, independently decoded QR, safe raw text opening, unsupported-type download.
- Reports: `verification.json`, `interaction-verification.json`.
- `screenshots/`: desktop/mobile home, populated history, uploading, success, request, owner waiting, network error, QR, and mobile lifecycle overview.

Requirements for local tests: Python, Playwright/Chromium, Pillow, zxing-cpp; preview server at localhost:8765.

This reference supersedes v2/v3 theme and visual treatments, but not existing backend/security requirements. The weekly rotation request is a separate follow-up; it is not implemented in this saved prototype.
