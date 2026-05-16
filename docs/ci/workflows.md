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
- Run Playwright E2E in its own job after the build job succeeds.

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
- Runs Playwright E2E tests with `pnpm run test:e2e:ci`.
- Uploads the Playwright report artifact.

CI does not:

- Deploy anywhere.
- Target branches other than `master`.
