# Request-flow ticket evidence

Scope: #145, #146, #147, #148, request-side #150, request-side #143, request-side #153. Read the full `up-all-open-issues.json` before implementing. This branch changes only request components/tests and required server upload lifecycle behavior; it does not change upload-experience UI, footer, locale files, or routing.

## Per-ticket acceptance

| Ticket       | Implementation and verification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #145         | Real XHR transport with measured upload progress and separate finalizing state, ref-based duplicate-submit protection, disabled file replacement, abort/unmount disposal, retained selection and retry. Real raw and multipart stalled streams now dispose exactly once, remove temporary files, release claims, and accept retry. A production Chromium throttled 256 KiB upload showed 6% progress and 16,248 actual partial bytes on disk before cancellation; directory contents returned to the pre-upload baseline, owner status became `retry`, and retry became `consumed`. |
| #146         | Shared owner presentation gives human-readable statuses and limits. The waiting URL is labeled as a reserved, unavailable code value, not an open-file action. Only consumed requests offer open/download/copy actions. SSE, reload, navigation recovery, revoked and expired owner states are tested. Terminal states cannot revoke.                                                                                                                                                                                                                                               |
| #147         | Recipient-safe server projection distinguishes invalid, expired, revoked, consumed, in-progress, active and retry states without exposing owner capabilities, hashes or reserved IDs. Unavailable states explain what to do next. Available forms show IEC limits, relative lifetime and exact localized timestamps. A Los Angeles timezone production browser test verifies the exact timestamp without hydration errors.                                                                                                                                                          |
| #148         | Recipient success identifies filename, readable size, file expiry and requester delivery. Copy works; opening the real file produces its contents; downloading produces the correct filename and exact bytes. Upload access credentials are explained inside a closed Advanced / API disclosure. Recipient output never includes the owner capability.                                                                                                                                                                                                                              |
| #150 request | Native modal confirmation explains permanent revocation, defaults focus to Keep request, traps focus, supports Keep/Escape cancellation with trigger focus restoration, prevents duplicate operations, and preserves status on server failure. Successful revocation and reload show the terminal state. Axe scans of request content and the confirmation have no violations.                                                                                                                                                                                                      |
| #143 request | Successful clipboard writes alone announce success. Permission rejection or API absence offers a labeled, selectable, complete manual link. Owner copies reconstruct the fragment from retained capability state after history scrubbing, including after reload. A real insecure mapped HTTP hostname proves clipboard absence, manual recovery, no false copied message, and no owner capability in network URLs. Existing success-path clipboard browser tests also pass.                                                                                                        |
| #153 request | Request navigation links, fields and buttons have 44px minimum height with visible keyboard focus. 320px and 390px browser tests exercise new, recipient and owner pages and verify no horizontal overflow.                                                                                                                                                                                                                                                                                                                                                                         |

## RED evidence

Real failing runs were saved under `/home/brunette/.hermes/cache/scratch/`:

- `request-red.log`: original form has no abortable transport; both new form tests fail.
- `request-browser-red.log`: original owner presentation and 18px request navigation fail four production browser checks.
- `request-server-red.log`: recipient-safe availability projection is absent.
- `request-abort-red.log`: original raw and multipart cancellation remain stalled after abort instead of rejecting and releasing the claim.
- `request-exact-limit-red.log`: original multipart upload rejects a file exactly at its advertised cap.
- `request-copy-red.log`: rebuilt baseline owner component fails the real insecure-origin manual-copy check. The fixed component was restored before final verification.

## Final verification

Node 24.14.0 was prepended to PATH; pnpm 11 frozen installation completed. Tests used production standalone builds with `PORT=3212 HOSTNAME=127.0.0.1 CI=true`, one worker, no retries. Fresh isolated scratch database/upload directories prevent repeated large-file runs from exhausting the fixture's storage quota.

- `pnpm lint`: pass — `request-lint.log`.
- `pnpm exec tsc --noEmit`: pass — `request-tsc.log`.
- `pnpm test`: 42 suites / 325 Jest tests plus 11 real cleanup tests passed — `request-all-unit.log`.
- `pnpm build`: pass — `request-build-green.log`.
- Request production browser suite (flow, clipboard, cancellation, existing requested-upload and static navigation): 20 passed — `request-browser-green.log`.
- Large real cancellation run with `MAX_UPLOAD_SIZE=262144`: 1 passed — `request-slow-large.log`. This additionally verifies partial disk bytes and exact pre/post-cancellation directory equality.

The large cancellation run logs Next's expected disconnected-client `AbortError` / `ResponseAborted`; cleanup and retry assertions pass. No implementation blocker remains.

## Merge coordination

- The upload worker owns `src/lib/copy-link.ts`. Request code currently uses the analogous local `src/app/request/copy-request-link.tsx`; reconcile its helper with the shared utility during integration. Do not lose the manual fallback UI or owner-fragment reconstruction.
- `src/server/uploads/create-upload.ts` has one bounded shared adjustment: Busboy's cutoff is `byteLimit + 1` because its truncation flag fires at equality. The existing byte validator still rejects oversize uploads. A real exact-cap multipart test and the complete upload test suite pass. Reconcile this small adjustment with any upload-worker edits.
- Copy is clean English in request-owned components, ready for the locale worker. No locale files were changed.
