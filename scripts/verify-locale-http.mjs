// Run against a fresh production build, e.g. PORT=3213 pnpm start.
// This deliberately fails until the documented Next Vary replacement is fixed.
import assert from "node:assert/strict";
const origin = process.env.LOCALE_TEST_ORIGIN ?? "http://127.0.0.1:3213";
const cases = [
  ["pl-PL,en;q=0.4", "pl"],
  ["en;q=0,*;q=0.8", "pl"],
  ["pl;q=0,*", "en"],
  ["pl;q=1.1,en;q=0.2", "en"],
  ["*;q=0", "en"],
];
const results = [];
for (const [header, locale] of cases) {
  const response = await fetch(`${origin}/request/new`, {
    headers: { "Accept-Language": header },
  });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-language"), locale);
  assert.match(html, new RegExp(`<html lang="${locale}">`));
  assert.ok(
    html.includes(locale === "pl" ? "Poproś o plik." : "Request a file."),
  );
  assert.match(response.headers.get("cache-control"), /private/);
  results.push({ header, locale, status: response.status });
}
const preference = await fetch(`${origin}/request/new?lang=en`, {
  headers: { "Accept-Language": "pl", Cookie: "up-locale=pl" },
});
assert.equal(preference.headers.get("content-language"), "en");
assert.match(preference.headers.get("set-cookie"), /up-locale=en/);
const cookie = await fetch(`${origin}/request/new`, {
  headers: { "Accept-Language": "en", Cookie: "up-locale=pl" },
});
assert.equal(cookie.headers.get("content-language"), "pl");
const configuration = await fetch(`${origin}/api/configuration`, {
  headers: { "Accept-Language": "pl" },
});
assert.equal(configuration.headers.get("content-language"), null);
assert.match(configuration.headers.get("content-type"), /application\/json/);
const manifest = await fetch(`${origin}/locale/pl/manifest.webmanifest`);
assert.equal((await manifest.json()).lang, "pl");
const vary = cookie.headers
  .get("vary")
  .toLowerCase()
  .split(",")
  .map((v) => v.trim());
console.log(
  JSON.stringify(
    {
      results,
      explicitPreference: "passed",
      cookiePreference: "passed",
      rawApiIsolation: "passed",
      localizedManifest: "passed",
      actualVary: vary,
    },
    null,
    2,
  ),
);
for (const token of [
  "rsc",
  "next-router-state-tree",
  "accept-language",
  "cookie",
]) {
  assert.ok(vary.includes(token), `final Vary must retain ${token}`);
}
console.log("Locale HTTP acceptance passed");
