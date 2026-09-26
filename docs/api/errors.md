# API Error Responses

Public API errors are JSON unless the endpoint streams file bytes. Clients must branch on HTTP status and stable `error.code` values, not English messages.

## Upload

`POST /api/upload` returns:

```json
{
  "error": {
    "code": "upload_too_large",
    "message": "Upload exceeds the maximum upload size."
  }
}
```

Stable upload errors:

- `400 empty_body`: request body is absent.
- `400 missing_upload`: body contains no uploadable file or text.
- `400 missing_file_name`: raw non-text upload lacks `X-File-Name`.
- `400 invalid_multipart`: multipart syntax is malformed.
- `400 too_many_files`: request contains more than one file.
- `400 too_many_fields`: request exceeds the metadata-field limit.
- `400 too_many_parts`: request exceeds the multipart-part limit.
- `400 ambiguous_upload`: request supplies competing file and text payloads.
- `400 invalid_expiration`: expiration is malformed, non-positive, or supplied through multiple fields.
- `400 expiration_too_large`: requested expiration exceeds the configured maximum.
- `413 upload_too_large`: payload exceeds the per-upload limit.
- `413 total_storage_limit_exceeded`: accepting the payload would exceed stored-data capacity.

## Upload management

`GET /api/u/{id}/details` returns this for an invalid, expired, or unavailable upload:

```json
{ "message": "File not found.", "success": false }
```

`POST /api/u/{id}/verify` and `DELETE /api/u/{id}` use the same shape:

- `400`: request lacks a valid JSON `accessToken`.
- `403`: token does not authorize this upload.
- `404`: upload is unavailable.

Management error example:

```json
{ "message": "Invalid access token.", "success": false }
```

## Requested uploads

`POST /api/upload-requests` uses the upload error shape and may return:

- `400 invalid_json`: malformed JSON.
- `400 invalid_upload_request`: unknown fields, invalid byte cap, or non-strict/out-of-range expiration.
- `413 request_too_large`: creation body exceeds 1 KiB.

`POST /api/upload-requests/{publicToken}/upload` returns ordinary upload errors plus `404 upload_request_unavailable` when the capability is invalid, expired, revoked, consumed, or already claimed.

`GET` and `DELETE /api/upload-requests/manage` return the same `404 upload_request_unavailable` for absent, malformed, or unknown owner capabilities. This deliberately avoids distinguishing capability states.

## Download

`GET /{id}` and `GET /u/{id}` return plain text `File unavailable.\n` with `404` for malformed IDs, missing or expired metadata, unsafe storage paths, and missing physical files. These cases intentionally share one response to avoid disclosing storage state.

Invalid or unsatisfiable byte ranges return `416` with `Content-Range: bytes */{size}`.

Automated contracts live in `src/app/api/upload.spec.ts`, `src/app/requested-upload.spec.ts`, `src/server/uploads/create-upload.test.ts`, `src/server/uploads/manage-upload.test.ts`, `src/server/upload-requests/requested-upload.test.ts`, and `src/server/downloads/create-download-response.test.ts`.
