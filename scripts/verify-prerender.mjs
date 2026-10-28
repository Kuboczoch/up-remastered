import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(`.next/${path}`, "utf8");
const manifest = JSON.parse(await read("prerender-manifest.json"));
for (const route of [
  "/",
  "/request/new",
  "/request/manage",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
]) {
  assert.ok(manifest.routes[route], `${route} must be prerendered`);
  assert.equal(manifest.routes[route].initialRevalidateSeconds, false);
}
for (const route of [
  "/[id]",
  "/u/[key]",
  "/request/[token]",
  "/api/configuration",
]) {
  assert.equal(manifest.routes[route], undefined, `${route} must stay dynamic`);
}
const origin = new URL(process.env.UP_PUBLIC_ORIGIN || "http://localhost:3000")
  .origin;
const maxBytes = Number(process.env.MAX_UPLOAD_SIZE || 1073741824);
const maxHours = Math.min(Number(process.env.MAX_EXPIRATION_HOURS || 24), 24);
const defaultHours = Math.min(
  Number(process.env.DEFAULT_EXPIRATION_HOURS || 24),
  maxHours,
);
const home = await read("server/app/index.html");
const rsc = await read("server/app/index.rsc");
assert.equal(
  new URL(home.match(/rel="canonical" href="([^"]+)"/)?.[1] || "invalid").href,
  `${origin}/`,
  "canonical origin",
);
assert.equal(
  new URL(home.match(/property="og:url" content="([^"]+)"/)?.[1] || "invalid")
    .href,
  `${origin}/`,
  "Open Graph origin",
);
const jsonLd = JSON.parse(
  home.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1] ||
    "null",
);
assert.equal(jsonLd?.url, `${origin}/`, "JSON-LD origin");
assert.ok(rsc.includes(`"initialMaxBytes":${maxBytes}`), "baked upload limit");
assert.ok(
  rsc.includes(`"initialExpirationHours":${defaultHours}`),
  "baked expiration default",
);
assert.ok(
  rsc.includes(`"maxExpirationHours":${maxHours}`),
  "baked expiration maximum",
);
const request = await read("server/app/request/new.html");
assert.ok(
  request.includes(`data-max-bytes="${maxBytes}"`),
  "request upload limit",
);
assert.ok(
  request.includes(`data-max-hours="${maxHours}"`),
  "request expiration maximum",
);
assert.ok(
  (await read("server/app/robots.txt.body")).includes(`${origin}/sitemap.xml`),
);
assert.ok(
  (await read("server/app/sitemap.xml.body")).includes(`<loc>${origin}/</loc>`),
);
console.log(
  `Prerender verified: 6 static routes; 4 runtime routes; origin=${origin}; bytes=${maxBytes}; expiration=${defaultHours}/${maxHours}h`,
);
