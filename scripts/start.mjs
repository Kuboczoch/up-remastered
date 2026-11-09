import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createFinalResponseProxy } from "./final-response-proxy.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = existsSync(join(root, "server.js"))
  ? join(root, "server.js")
  : join(root, ".next/standalone/server.js");
if (!existsSync(entry)) throw new Error("Run pnpm build before pnpm start.");
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be an integer between 1 and 65535.");

// The backend is never exposed on the public listener. An occupied reservation
// fails startup rather than connecting to a different service or retrying writes.
const reservation = createServer();
await new Promise((resolve, reject) => {
  reservation.once("error", reject);
  reservation.listen(0, "127.0.0.1", resolve);
});
const backendPort = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const child = spawn(process.execPath, [entry], {
  cwd: dirname(entry),
  env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(backendPort) },
  stdio: "inherit",
});
const proxy = createFinalResponseProxy(backendPort);
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  proxy.close();
  proxy.closeAllConnections();
  child.kill("SIGTERM");
  const deadline = setTimeout(() => {
    child.kill("SIGKILL");
  }, 5000);
  deadline.unref();
}
process.once("SIGTERM", () => stop(0));
process.once("SIGINT", () => stop(0));
child.once("error", (error) => {
  console.error(error);
  stop(1);
});
child.once("exit", (code) => stop(code || 1));
proxy.once("error", (error) => {
  console.error(error);
  stop(1);
});
async function ready() {
  return new Promise((resolve) => {
    const request = http.get(
      { hostname: "127.0.0.1", port: backendPort, path: "/api/health" },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      },
    );
    request.setTimeout(1000, () => request.destroy());
    request.once("error", () => resolve(false));
  });
}
try {
  const deadline = Date.now() + 60_000;
  while (!stopping && !(await ready())) {
    if (Date.now() >= deadline)
      throw new Error("Standalone health check timed out.");
    await delay(100);
  }
  if (!stopping) {
    proxy.listen(port, process.env.HOSTNAME ?? "0.0.0.0", () => {
      console.log(`Final-response proxy ready on port ${port}`);
    });
  }
} catch (error) {
  console.error(error);
  stop(1);
}
