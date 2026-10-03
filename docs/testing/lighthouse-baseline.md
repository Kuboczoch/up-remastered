# Lighthouse Baseline

The public homepage has a repeatable Lighthouse baseline run through Playwright.
It tracks the same browser target as the E2E suite and does not introduce
analytics, real user monitoring, or any external scoring service.

## Command

Run the baseline audit locally:

```bash
pnpm run test:lighthouse
```

The Playwright test builds the production app through `playwright.config.ts`,
launches Chromium with a remote debugging port, runs Lighthouse against `/`, and
attaches the score JSON to the Playwright test output under `test-results/`.

## Current Baseline

Captured on 2026-09-28 from commit
`10113d6baec61423700b41cfe50629ca3c73ba10` against the production standalone
server. Node.js 24.14.0 and Chromium were used. The same audit ran three times
serially with a fresh Lighthouse browser context:

```bash
npm_lifecycle_event=test:lighthouse pnpm exec playwright test \
  src/app/lighthouse.spec.ts --project=chromium --repeat-each=3 --workers=1
```

| Category       | Score | Minimum |
| -------------- | ----: | ------: |
| Performance    |   100 |      95 |
| Accessibility  |   100 |     100 |
| Best practices |   100 |      95 |
| SEO            |   100 |     100 |

All three runs scored identically. Performance audit values were:

|    Run | FCP   | LCP   | TBT  | CLS | Speed index |
| -----: | ----- | ----- | ---- | --: | ----------- |
|      1 | 0.1 s | 0.2 s | 0 ms |   0 | 0.1 s       |
|      2 | 0.1 s | 0.1 s | 0 ms |   0 | 0.1 s       |
|      3 | 0.1 s | 0.2 s | 0 ms |   0 | 0.1 s       |
| Median | 0.1 s | 0.2 s | 0 ms |   0 | 0.1 s       |

These are Lighthouse's displayed values; the current test artifact intentionally
retains rounded audit values rather than raw timing precision.

## Initial JavaScript Payload

A cold Chromium navigation to `/` loaded nine JavaScript resources totaling
555,688 decoded bytes and 161,085 encoded response-body bytes. HTTP headers are
excluded. The route chunk was 39,981 decoded bytes and 13,461 encoded bytes;
the remaining 147,624 encoded bytes (91.6%) came from React, Next.js, and
Turbopack runtime chunks.

For attribution only, a temporary local build enabled production browser source
maps. That setting was removed before the final production build. The route
chunk's largest application sources were:

| Source                                        | Source-map content bytes |
| --------------------------------------------- | -----------------------: |
| `src/components/upload/upload-experience.tsx` |                   24,821 |
| `src/components/upload/upload-history.ts`     |                    4,183 |
| `src/components/upload/client-upload.ts`      |                    3,088 |
| `src/lib/format.ts`                           |                    2,578 |

Source-map content bytes describe original source size, not exact minified byte
ownership. They are useful for ranking targets but must not be presented as
payload savings.

`qrcode` is already isolated in a separate 23,741-byte decoded chunk (8,723
bytes at gzip level 9). It is absent from the initial navigation, but the
current success effect fetches it after every completed upload, whether or not
the user needs to inspect a QR code.

## Ranked Deferral Candidates

1. Defer `qrcode` until an explicit QR disclosure is opened. This can avoid an
   8.7 KB compressed success-path request for users who only copy or download
   the link. Preserve keyboard operation, an accessible control name, loading
   feedback, success-heading focus, and the existing copy/download actions.
2. Measure a success-panel split before adopting it. The large upload component
   contains all phases, so moving success-only rendering behind a dynamic
   boundary could reduce the 13.5 KB compressed route chunk. Expected savings
   are uncertain because state and shared formatting remain eager; reject the
   split if it delays the focused success heading or causes layout shift.
3. Keep history and core upload controls eager. Their source footprint is small,
   and deferral would risk a post-hydration history shift or delayed input. The
   current Lighthouse median already has 0 ms TBT and zero CLS, so framework
   replacement or broad component fragmentation is not justified by evidence.

## QR Deferral Verification

The QR candidate is now implemented. Completing an upload no longer imports
`qrcode`; opening **Show QR code** starts the import and displays an accessible
loading state while the SVG is generated. A generation failure stays inside the
dialog and offers a retry without removing the copy, open, or download actions.

A production Chromium payload measurement after the change recorded 161,205
encoded JavaScript bytes both after the initial navigation and after a completed
upload with the QR dialog closed. Opening the dialog loaded one additional
23,741-byte decoded / 8,819-byte encoded chunk. Compared with the 161,085-byte
initial payload and 8,723-byte QR chunk in the baseline, the normal success path
fell from 169,808 to 161,205 encoded bytes: 8,603 bytes fewer. The initial route
increased by 120 encoded bytes for the loading and retry states.

The same production build then ran the baseline command three times serially:

|    Run | FCP   | LCP   | TBT  | CLS | Speed index |
| -----: | ----- | ----- | ---- | --: | ----------- |
|      1 | 0.1 s | 0.1 s | 0 ms |   0 | 0.1 s       |
|      2 | 0.1 s | 0.1 s | 0 ms |   0 | 0.1 s       |
|      3 | 0.1 s | 0.2 s | 0 ms |   0 | 0.1 s       |
| Median | 0.1 s | 0.1 s | 0 ms |   0 | 0.1 s       |

All three runs retained 100 scores for performance, accessibility, best
practices, and SEO. Median LCP improved from 0.2 s to 0.1 s; median FCP, TBT,
CLS, and speed index were unchanged. HTTPS and HTTP/2 remain deployment-layer
reverse-proxy checks and are not inferred from this local HTTP bundle test.

The minimum score thresholds are intentionally small and explicit. Update this
doc and the matching Playwright threshold in the same change whenever the
homepage baseline changes.
