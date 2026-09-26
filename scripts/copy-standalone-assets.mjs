import { cp, rm } from "node:fs/promises";

const destination = ".next/standalone/public";

await rm(destination, { force: true, recursive: true });
await cp("public", destination, { recursive: true });
