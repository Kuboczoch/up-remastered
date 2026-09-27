# Browser and App Icons

Next.js App Router serves:

- `public/brand-mark.svg` as the canonical monochrome logo and visible header mark.
- `favicon.ico` for browser tabs and legacy clients.
- `icon.png` as the general 512×512 app icon.
- `apple-icon.png` as the 180×180 Apple touch icon.
- `manifest.webmanifest` for install/share surfaces.

The mark uses a dark rounded square and white upload arrow, preserving contrast against both light and dark browser chrome. All raster and ICO files are generated from the SVG with `pnpm run brand:icons`; ImageMagick 7 is required only when regenerating those checked-in assets.

The manifest identifies the service as `Up - Remastered`, starts at `/`, uses standalone display, and references 192×192 and 512×512 local PNG icons generated from the same source. Assets contain no external URLs and work in offline/self-hosted deployments.

Production browser tests verify the visible SVG mark at its normal rendered size, follow every generated browser icon link, and request every manifest icon. This covers the resolution-independent on-page mark plus normal- and high-density raster assets.
