# Contributing

## Local setup

Use Node.js 24.14 and the pnpm version pinned in `package.json`:

```bash
corepack enable
pnpm install
pnpm run dev
```

Open `http://localhost:3000`.

## Validation

Run fast checks while working:

```bash
pnpm run check
```

Before opening a pull request, run the complete local CI equivalent:

```bash
pnpm run check:full
```

`check:full` covers linting, type checking, unit tests, the production build, and Playwright/Lighthouse tests. CI details live in [`docs/ci/workflows.md`](docs/ci/workflows.md) and [`docs/ci/e2e.md`](docs/ci/e2e.md).

## Pull requests

Use a Conventional Commit pull request title. Examples:

- `feat: add upload expiry cleanup`
- `fix(api): reject invalid download tokens`
- `docs: clarify local setup`

Keep changes scoped. Update narrow documentation and automated coverage with behavior changes. Start with [`docs/ai/context.md`](docs/ai/context.md), then read only the documentation relevant to the changed area.
