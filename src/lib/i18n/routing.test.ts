import { describe, expect, it } from "@jest/globals";
import { localizedPath, requestLocale } from "./routing";

describe("locale UI routing boundary", () => {
  it.each([
    "/",
    "/request/new",
    "/request/manage",
    "/request/secret",
    "/decrypt/key",
  ])("rewrites UI %s only", (path) => {
    expect(localizedPath(path, "pl")).toBe(
      `/l10n/pl${path === "/" ? "" : path}`,
    );
  });
  it.each([
    "/api/upload",
    "/api/upload-requests/secret",
    "/u/key",
    "/secret",
    "/pl",
    "/sharex",
    "/sh",
    "/robots.txt",
    "/_next/static/a.js",
    "/request/token/upload",
  ])("preserves raw contract %s", (path) => {
    expect(localizedPath(path, "pl")).toBeNull();
  });
  it("keeps query choice ahead of cookie and browser hints", () => {
    expect(requestLocale(new URL("https://up.test/?lang=pl"), "en", "en")).toBe(
      "pl",
    );
    expect(
      requestLocale(new URL("https://up.test/?lang=invalid"), "pl", "en"),
    ).toBe("pl");
    expect(requestLocale(new URL("https://up.test/"), undefined, "pl-PL")).toBe(
      "pl",
    );
  });
});
