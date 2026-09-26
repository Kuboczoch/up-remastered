# Public Configuration and Upload Clients

## Public configuration

`GET /api/configuration` exposes non-secret upload limits using the current upstream field names:

- `maxTemporaryFileSize`: bytes.
- `maxFileLifetime`: milliseconds.
- `defaultFileLifetime`: milliseconds.
- `permanentAllowed`: always `false`; remastered uploads must expire.
- `maxPermanentFileSize`: `0` because permanent uploads are disabled.

Values come from the validated server environment. Database paths, storage paths, quotas, and credentials are never returned.

## Generated clients

- `GET /sharex` downloads `up.sxcu` for ShareX image, text, and file uploads.
- `GET /sh` downloads a POSIX shell helper using the configured `UP_PUBLIC_ORIGIN`.

The shell helper quotes the input path, uses `curl --fail-with-body --silent --show-error`, validates the returned five-character key, writes errors to stderr, and exits nonzero on invalid usage, HTTP failure, or malformed responses.

## Admin configuration

No `/api/admin/config` route is exposed. Current upstream removed its authentication mechanism in PR #248 but left those endpoints guarded by an unreachable admin role. Recreating them without authentication would turn dead code into a security vulnerability. Remastered configuration remains deployment-owned through validated environment variables.
