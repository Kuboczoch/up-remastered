# Release Please

Release Please runs on pushes to `master` and opens release pull requests.

This workflow requires a repository secret:

```txt
RELEASE_PLEASE_TOKEN
```

Use a fine-grained PAT with access to this repository.

Required token access:

- Contents: read and write.
- Pull requests: read and write.

The default `GITHUB_TOKEN` is not used because many repositories block GitHub Actions from creating pull requests.

Alternative repository setting if you want to switch back to `GITHUB_TOKEN` later:

```txt
Settings > Actions > General > Workflow permissions
```

Enable:

```txt
Allow GitHub Actions to create and approve pull requests
```
