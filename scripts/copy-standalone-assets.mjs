import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname } from "node:path";

// Next traces the server's hashed external import, not bare maintenance imports.
// Package their small runtime dependency tree at the runner's normal lookup root.
const require = createRequire(import.meta.url);
const sqlitePackage = require.resolve("better-sqlite3/package.json");
// better-sqlite3 v13 loads its bundled native prebuild without runtime packages.
const maintenancePackages = [["better-sqlite3", sqlitePackage]];
for (const [name, packageJson] of maintenancePackages) {
  await cp(dirname(packageJson), `.next/standalone/node_modules/${name}`, {
    recursive: true,
    dereference: true,
  });
}

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
