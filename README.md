<p align="center">
  <img src="public/brand-mark.svg" alt="Up — Remastered" width="112" height="112">
</p>

<h1 align="center">Up — Remastered</h1>

<p align="center">
  A small, modern, self-hosted service for sharing files that should not live forever.
</p>

<p align="center">
  <a href="https://github.com/Kuboczoch/up-remastered/actions/workflows/ci.yaml"><img src="https://github.com/Kuboczoch/up-remastered/actions/workflows/ci.yaml/badge.svg" alt="CI status"></a>
  <a href="https://github.com/Starchasers/up"><img src="https://img.shields.io/badge/inspired%20by-Starchasers%2Fup-111b2b" alt="Inspired by Starchasers/up"></a>
</p>

## What is it?

**Up — Remastered** is a temporary file-sharing service designed to run on your own server. Upload a file, receive a short link, share it, and let the service remove it when its lifetime ends.

It is a JavaScript and TypeScript reimplementation of [Starchasers/up](https://github.com/Starchasers/up), rebuilt around a modern web stack without the original JVM backend.

## Highlights

- **Temporary by design** — every upload expires.
- **Simple sharing** — compact links with streamed downloads and byte-range support.
- **Flexible uploads** — browser, drag and drop, clipboard, text, API, ShareX, or shell.
- **Requested uploads** — create a one-use link for somebody else to send you a file.
- **Private management capabilities** — delete uploads or manage requests using secret owner links.
- **Self-contained storage** — local files and SQLite, with no external database or object store required.
- **Deployment controls** — configurable upload size, storage quota, and expiration limits.
- **Operations-ready** — health checks, automated cleanup, backups, migrations, and container support.

## Philosophy

Up — Remastered deliberately stays small. It is built for a personal server, VPS, NAS, or similar single-node environment where the operator owns the data and deployment.

It is not an account platform, cloud-storage product, or distributed file service. There are no user accounts or permanent uploads. Public deployments should place it behind a trusted reverse proxy that provides HTTPS and appropriate traffic controls.

## Quick start

A recent Docker installation with Compose v2 is the easiest way to run it:

```bash
git clone https://github.com/Kuboczoch/up-remastered.git
cd up-remastered
cp .env.example .env
docker compose up --build -d
```

Open [http://localhost:3000](http://localhost:3000).

Compose builds the application locally and stores persistent state in `./data`. Before exposing it publicly, set the public origin and review the deployment and operations documentation.

## Integrations

A running instance provides:

- `/sharex` — generated ShareX configuration;
- `/sh` — generated POSIX shell upload helper;
- `/api/upload` — multipart upload endpoint;
- `/api/configuration` — public client configuration;
- `/api/health` — health endpoint.

The service keeps compatibility with the useful public behavior of the original Up project while documenting deliberate differences in the [upstream parity matrix](docs/project/upstream-parity.md).

## Documentation

- [Project overview](docs/project/overview.md)
- [Deployment requirements](docs/deployment/docker/requirements.md)
- [Data, backup, and restore](docs/operations/data-volume.md)
- [Upload clients and public configuration](docs/api/configuration-and-clients.md)
- [Testing strategy](docs/testing/strategy.md)
- [Roadmap](docs/project/roadmap.md)

## Development

The project uses Next.js, React, TypeScript, SQLite, Drizzle ORM, Jest, and Playwright.

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, validation commands, and pull request conventions.
