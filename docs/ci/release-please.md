# Release Please

Release Please runs on pushes to `master` and opens release pull requests.

GitHub repository setting required when using the default `GITHUB_TOKEN`:

```txt
Settings > Actions > General > Workflow permissions
```

Enable:

```txt
Allow GitHub Actions to create and approve pull requests
```

If that setting cannot be enabled, create a fine-grained PAT and store it as:

```txt
RELEASE_PLEASE_TOKEN
```

Required token access:

- Contents: read and write.
- Pull requests: read and write.

The workflow uses `RELEASE_PLEASE_TOKEN` when present and falls back to `GITHUB_TOKEN`.
