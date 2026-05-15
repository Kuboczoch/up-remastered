# Download API Requirements

Future route shape:

```txt
/api/download/[token]
```

Before allowing a download:

- Validate token exists.
- Validate expiration.
- Validate password if required.
- Validate download limit.
- Validate physical file exists under the configured upload directory.

Increment `downloadCount` only after authorization succeeds.

Cleanup is not enough. Download routes must reject expired or unavailable files even if cleanup has not run.
