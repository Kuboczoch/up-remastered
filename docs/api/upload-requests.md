# Requested Upload Links

Requested-upload links let one person invite one anonymous upload without creating accounts.

## Capability model

`POST /api/upload-requests` accepts only:

```json
{
  "expiresAt": "2026-09-26T19:00:00.000Z",
  "maxBytes": 1048576
}
```

`expiresAt` must be strict UTC ISO-8601, future, and no later than `MAX_EXPIRATION_HOURS`. `maxBytes` must be an integer from 1 through `MAX_UPLOAD_SIZE`. The JSON body is capped at 1 KiB; unknown fields are rejected.

The browser form exposes bounded expiration presets plus a custom local date/time. Upload limits use IEC size presets or an exact numeric B/KiB/MiB/GiB conversion. Decimal quantities are accepted only when they convert to a whole, safe integer byte count within `MAX_UPLOAD_SIZE`; server validation remains authoritative.

Displayed sizes use shared IEC formatting. Expirations pair localized relative text with an absolute local `<time datetime>` value, and relative labels refresh once per minute rather than on a page-wide per-second timer.

A successful `201` response returns:

- `uploadUrl`: uploader capability containing a random 256-bit public token;
- `managementToken`: separate random 256-bit owner capability, shown once;
- `managementUrl`: private owner link carrying that token in its URL fragment;
- `uploadId` and `shareUrl`: the final file identity and share URL, reserved immediately;
- expiration, byte cap, and current status.

Status responses also include `statusChangedAt`, the UTC timestamp for the current revision. Status is one of `active`, `in_progress`, `retry`, `consumed`, `revoked`, or `expired`. `retry` means a failed upload released its claim and the same uploader link can be tried again.

Only SHA-256 token hashes are stored. Tokens never appear in logs or redirect parameters. Reserved upload IDs share one namespace with ordinary uploads and remain reserved after expiration, revocation, file deletion, or cleanup, so a disclosed share URL is never reassigned to different content.
Creation and owner-management responses send `Cache-Control: no-store` because they contain capabilities or capability-protected state.

The creation result offers separate copy actions for the uploader and owner links. The owner page warns that its private link is a bearer capability, can recreate that link for copying after fragment scrubbing, and keeps the imported capability in same-tab session storage so refresh and back navigation remain usable without persisting it across browser sessions.

## Uploader

`GET /request/{publicToken}` displays the request only while active. `POST /api/upload-requests/{publicToken}/upload` accepts one file through the normal streaming upload pipeline. The effective limit is the minimum of request `maxBytes`, global per-upload limit, and remaining global storage quota.

The server atomically claims the request before reading the upload. Concurrent reuse fails with the same non-disclosing `404 upload_request_unavailable` response used for invalid, expired, revoked, consumed, and in-progress links. A failed validation/upload releases the claim for retry. A successful upload consumes the request and uses the ID/share URL reserved when the request was created. If consumption loses a revocation race, the newly created upload is deleted before an unavailable response is returned.

The uploader receives the ordinary upload access token for managing the uploaded file, but never receives the owner management token.

## Owner

Send `Authorization: Bearer {ownerCapability}` to:

- `GET /api/upload-requests/manage` to inspect status and resulting upload ID;
- `GET /api/upload-requests/manage/events` to follow status changes as server-sent events;
- `DELETE /api/upload-requests/manage` to revoke an unused request.

Wrong or malformed owner capabilities receive the same non-disclosing 404 response. Consumed requests cannot be retroactively revoked; the uploader owns the resulting file through its separate upload access token.

The event stream uses the same bearer header rather than placing the owner capability in a URL. It sends an immediate authoritative snapshot, `status` events with deterministic IDs, and accepts `Last-Event-ID` when reconnecting. Terminal `consumed`, `revoked`, and `expired` events close the stream. Non-terminal streams send keep-alive comments and close after 55 seconds so clients reconnect instead of holding unbounded server resources. Responses use `no-store`, disable reverse-proxy buffering, and never include the uploader capability.

The creation result and owner page open one authenticated event stream, announce its connection state, and apply status changes without manual refresh. A dropped non-terminal stream reconnects after a two-second delay; unmounting cancels the request and pending retry. While an upload is in progress, contradictory revocation controls are disabled. A consumed request links directly to the uploaded file.

## Threat and abuse boundaries

- Single use limits each link to one stored upload.
- Strict expiration bounds capability lifetime.
- Per-request and global byte quotas bound storage use.
- Atomic SQLite claims prevent concurrent double use.
- Request creation accepts no redirect URL, origin, filename, or executable content.
- A process crash during an upload can leave that request conservatively locked rather than risk double use. The owner can revoke it and create another request.
- Capability URLs are bearer secrets. Owners should transmit them over HTTPS and revoke leaked links.
- Public deployments should additionally rate-limit request creation at the trusted reverse proxy; the app does not trust spoofable client-IP headers.
