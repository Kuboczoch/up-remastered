# Logging and Error Reporting

`up` uses process output as its operational log. Write structured JSON objects to `stdout` for lifecycle events and `stderr` for unexpected server failures. Docker and Compose collect those streams. No external logging or error-reporting service is part of the baseline.

## Event format

Emit one JSON object per line. Use stable machine-readable values rather than prose.

```json
{
  "level": "error",
  "event": "upload_failed",
  "operation": "upload",
  "error_code": "storage_unavailable",
  "status": 500
}
```

Every application event should include `level`, `event`, and `operation`. Add a stable `error_code` and HTTP `status` when relevant. The container runtime supplies timestamps; do not add a second timestamp unless logs run outside that runtime.

## Upload and download failures

- Do not log expected upload validation failures such as malformed input, unsupported expiration, or quota rejection.
- Do not log missing, expired, invalid, or unavailable download IDs. Their identical `404` response is intentional and must not become an enumeration side channel.
- Log one sanitized error event when an unexpected upload or download failure reaches the route boundary.
- Do not log successful requests individually. Aggregate metrics are out of scope until explicitly requested.

## Allowed fields

- Stable event and operation names.
- Severity, HTTP status, and application error code.
- Sanitized runtime error name and Node.js error code, such as `EACCES`.
- Numeric byte counts, duration, and configured limits when useful.
- A generated correlation ID that carries no user data.

## Never log

- Filesystem or database paths.
- Upload IDs, share URLs, tokens, passwords, cookies, or authorization headers.
- Raw filenames, MIME payloads, file contents, text uploads, request bodies, or query strings.
- Client IP addresses or user-agent strings unless a documented security requirement is approved.
- Raw exception messages when they can contain any prohibited value.

Return stable public error codes and messages. Keep stack traces out of responses. Development-only framework traces may remain visible to the local developer; production logs must use sanitized fields and operators must protect log access.

## Operations

Use `docker compose logs up` or the container platform equivalent. Retention, rotation, and access control belong to the host. Adding Sentry, OpenTelemetry exporters, analytics, or another remote sink requires an explicit architecture decision and privacy review.
