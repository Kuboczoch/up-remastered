# HTTP Response Behavior

The standalone Next.js server compresses compressible framework responses when the client advertises a supported `Accept-Encoding`. Runtime coverage requests raw homepage bytes, verifies gzip explicitly, and accepts gzip or Brotli for multi-encoding negotiation so a framework preference change does not weaken the assertion.

The application is same-origin by default. It does not emit `Access-Control-Allow-Origin: *` for framework pages or public API configuration responses. Add CORS only at a trusted reverse proxy or as an explicit, reviewed application policy.

Already-compressed image assets are served without requiring additional content encoding. Browser metadata icons, the web manifest, and the manifest's local icon files are exercised against the production build.
