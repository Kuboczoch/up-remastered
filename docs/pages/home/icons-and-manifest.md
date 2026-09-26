# Browser and App Icons

Next.js App Router serves:

- `favicon.ico` for browser tabs and legacy clients.
- `icon.png` as the general 512×512 app icon.
- `apple-icon.png` as the 180×180 Apple touch icon.
- `manifest.webmanifest` for install/share surfaces.

The manifest identifies the service as `up - remastered`, starts at `/`, uses standalone display, and references 192×192 and 512×512 local PNG icons. Assets contain no external URLs and work in offline/self-hosted deployments.
