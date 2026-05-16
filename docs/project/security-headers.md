# Security Headers

Baseline app routes send these headers through `next.config.ts`:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()`
- `X-Frame-Options: DENY`

The baseline is intentionally small and applies to every app route.

Content Security Policy is a follow-up decision. Next.js emits framework scripts and styles that need a nonce or hash strategy before an enforcing CSP is useful. Add CSP after that strategy is chosen, then document the policy and any deployment requirements here.

Do not add upload/download-specific headers globally. Track those decisions in the scoped upload or download API docs once those routes exist, especially headers such as `Content-Disposition`, cache behavior, and MIME handling for streamed files.
