# CI Workflows

CI runs on pull requests to `master` and pushes to `master`.

Workflow:

```txt
.github/workflows/ci.yaml
```

Reusable dependency action:

```txt
.github/actions/workflow-install-node_modules/action.yaml
```

Checks:

- Check out the repository before using any local action.
- Run the dependency action once with `fail-on-cache-miss: false` to install dependencies with `npm ci` and populate the cache.
- Use the same dependency action in each check job with `fail-on-cache-miss: true`.
- The dependency action also checks out the repository, then sets up Node.js and restores `node_modules`.
- Run ESLint in its own job with `npm run lint`.
- Run TypeScript in its own job with `npm run typecheck`.
- Run Next.js build in its own job with `npm run build`, then upload the `.next` build as an artifact.
- Run Playwright E2E in its own job after the build job succeeds.

Playwright job:

- Restores the shared dependency cache.
- Downloads and extracts the Next.js build artifact from the build job.
- Caches Playwright browser binaries.
- Runs Playwright E2E tests with `npm run test:e2e:ci`.
- Uploads the Playwright report artifact.

CI does not:

- Deploy anywhere.
- Run unit tests yet.
- Target branches other than `master`.

Unit tests should be added later with Vitest once server utilities exist.
