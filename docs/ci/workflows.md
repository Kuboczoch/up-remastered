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

- Check pull request titles against Conventional Commits with `thehanimo/pr-title-checker`.
- Check out the repository before using any local action.
- Run the dependency action once with `fail-on-cache-miss: false` to install dependencies with `pnpm install --frozen-lockfile` and populate the cache.
- Use the same dependency action in each check job with `fail-on-cache-miss: true`.
- The dependency action also checks out the repository, then sets up Node.js, enables Corepack, and restores pnpm-backed `node_modules`.
- Run ESLint in its own job with `pnpm run lint`.
- Run TypeScript in its own job with `pnpm run typecheck`.
- Run Jest unit tests in their own job with `pnpm run test:unit:ci`.
- Run Next.js build in its own job with `pnpm run build`, then upload the `.next` build as an artifact.
- Build the production Docker image in its own job with `docker build --pull --tag up-remastered:ci .`.
- Run Playwright E2E in its own job after the build job succeeds.
- Publish the latest Playwright and Lighthouse summary through one updatable pull request comment.

Pull request title job:

- Runs only for pull request events.
- Re-runs when the pull request title is edited.
- Uses `.github/pr-title-checker.config.json`.
- Requires titles like `feat: add upload expiry cleanup` or `fix(api): reject invalid download tokens`.

Jest job:

- Restores the shared dependency cache.
- Runs unit tests with `pnpm run test:unit:ci`.
- Picks up unit tests named `*.test.ts` or `*.test.tsx` under `src/`.

Playwright job:

- Restores the shared dependency cache.
- Downloads and extracts the Next.js build artifact from the build job.
- Caches Playwright browser binaries.
- Runs Playwright E2E tests with `pnpm run test:e2e:ci`: normal `chromium` contracts retain the 4 KiB default cap, while `chromium-stream` runs the mandatory 1 MiB cancellation case against a second isolated standalone server on port + 1. One worker and one combined report cover both projects; see [E2E CI](e2e.md).
- Uploads the Playwright report artifact.

Docker image job:

- Checks out the repository.
- Builds the production Docker image locally.
- Does not publish or deploy the image.

CI does not:

- Deploy anywhere.
- Publish Docker images.
- Target branches other than `master`.

## Dependency updates

Dependabot checks pnpm and GitHub Actions dependencies every Monday at 06:00 `Europe/Warsaw`. npm updates use a two-day cooldown to match `pnpm-workspace.yaml`'s `minimumReleaseAge`; the pinned `resolve` override remains excluded from automated updates. Dependency pull requests still pass the same title and CI checks as other pull requests.
