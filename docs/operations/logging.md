# Logging And Error Reporting

Server-side failures should use structured console logging. Container runtimes and local process managers can collect stdout and stderr without requiring any external logging service.

Do not add hosted logging, tracing, or error reporting dependencies unless they are explicitly chosen later.

## Baseline Policy

Log unexpected server-side failures with:

- `level`: `error` for failed operations, `warn` for denied or unavailable operations that are expected in normal use.
- `event`: stable machine-readable event name, such as `upload.failed` or `download.denied`.
- `requestId`: per-request identifier when available.
- `route`: route pattern, not the full request URL.
- `tokenId` or metadata row id when needed for correlation, not the raw share token.
- `reason`: coarse failure category, such as `validation_failed`, `storage_failed`, `expired`, `limit_reached`, `missing_file`, or `unauthorized`.
- `status`: HTTP status code returned to the client.

Logs must not include:

- Filesystem paths.
- Raw share tokens.
- Passwords, password hashes, or password presence details beyond coarse authorization state.
- Raw filenames or original upload names.
- Request bodies.
- Full URLs, query strings, headers, cookies, IP addresses, or user agents unless a future documented policy allows them.
- Stack traces in structured fields that can expose sensitive local paths. Development-only console output may still show normal framework errors.

## Upload Failures

Future upload routes should log server-side failures after the client response category is known.

Allowed upload fields:

- `event`: `upload.failed`.
- `requestId`.
- `route`: upload route pattern.
- `reason`.
- `status`.
- `sizeBytes` when already validated and needed for debugging limits.
- `expirationPolicy`, such as requested duration bucket, when it does not expose client-provided free text.
- `hasPassword`: boolean only.

Disallowed upload fields:

- Raw filename.
- Temporary or final filesystem path.
- Raw password.
- Request body or multipart field contents.
- Client-provided description or free-text metadata.

## Download Failures

Future download routes should log denied or failed download attempts without revealing whether a token maps to a specific local file.

Allowed download fields:

- `event`: `download.denied` or `download.failed`.
- `requestId`.
- `route`: `/api/download/[token]`.
- Metadata row id or internal token id when one exists.
- `reason`.
- `status`.
- `hasPassword`: boolean only when metadata was already found.
- `downloadCount` and `downloadLimit` when metadata was already found and needed to debug limit handling.

Disallowed download fields:

- Raw token.
- Raw filename.
- Filesystem path.
- Password input.
- Distinct details that would let logs expose file existence to a broader audience than the application response.

## Error Reporting

The default error reporting destination is process logs. Operators should inspect container logs, systemd logs, or local terminal output depending on how the app is hosted.

External error reporting may be added later only as an explicit operations decision, with documented redaction rules before any integration is introduced.
