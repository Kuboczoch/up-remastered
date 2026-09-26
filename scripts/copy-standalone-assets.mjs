import { cp, mkdir, rm } from "node:fs/promises";

const standaloneDirectory = ".next/standalone";
const publicDestination = `${standaloneDirectory}/public`;
const staticDestination = `${standaloneDirectory}/.next/static`;

await rm(publicDestination, { force: true, recursive: true });
await rm(staticDestination, { force: true, recursive: true });
await mkdir(`${standaloneDirectory}/.next`, { recursive: true });
await Promise.all([
  cp("public", publicDestination, { recursive: true }),
  cp(".next/static", staticDestination, { recursive: true }),
]);
