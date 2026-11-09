import { describe, expect, it } from "@jest/globals";
import {
  acceptsUnavailablePage,
  presentUnavailableFile,
} from "./unavailable-page";

const navigation = {
  "sec-fetch-mode": "navigate",
  "sec-fetch-dest": "document",
};
function request(
  accept: string,
  extra: Record<string, string> = {},
  url = "http://localhost/ZZZZZ",
) {
  return new Request(url, { headers: { ...navigation, accept, ...extra } });
}

describe("unavailable document negotiation", () => {
  it.each([
    "text/html",
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "text/html;q=0.8,text/plain;q=0.5",
    "text/html;charset=UTF-8",
    "text/html;q=1;extension=value",
  ])("accepts %s", (accept) => {
    expect(acceptsUnavailablePage(request(accept))).toBe(true);
  });
  it.each([
    "",
    "*/*",
    "text/*",
    "application/json",
    "text/html;q=0,*/*;q=1",
    "text/html;q=0;text=ok,*/*",
    "text/html;charset=utf-8;q=0,*/*",
    "text/html;q=0.5,text/plain;q=1",
    "text/html;q=0.5,*/*;q=0.8",
    "text/html;q=.8",
    "text/html;q=1.1",
    "text/html;q=NaN",
    "text/html;q=0.1234",
    "text/html;q=1;q=0",
    "text/html,text/html;q=0",
    "text/html;unsupported=true",
    'text/html;q=1;broken="',
    "*/html",
    "text/html; q = 0",
  ])("rejects %s", (accept) => {
    expect(acceptsUnavailablePage(request(accept))).toBe(false);
  });
  it.each<Record<string, string>>([
    { "sec-fetch-mode": "cors" },
    { "sec-fetch-dest": "empty" },
    { "sec-fetch-dest": "iframe" },
    { "sec-fetch-mode": "" },
  ])("requires top-level navigation %j", (extra) => {
    expect(
      acceptsUnavailablePage(
        request("text/html", extra as Record<string, string>),
      ),
    ).toBe(false);
  });
  it("does not treat Accept alone or forced downloads or HEAD as HTML", () => {
    expect(
      acceptsUnavailablePage(
        new Request("http://localhost/ZZZZZ", {
          headers: { accept: "text/html" },
        }),
      ),
    ).toBe(false);
    expect(
      acceptsUnavailablePage(
        request("text/html", {}, "http://localhost/ZZZZZ?download=1"),
      ),
    ).toBe(false);
    expect(
      acceptsUnavailablePage(
        new Request("http://localhost/ZZZZZ", {
          method: "HEAD",
          headers: { ...navigation, accept: "text/html" },
        }),
      ),
    ).toBe(false);
  });
  it.each([404, 410])(
    "preserves %i and security while merging Vary for both representations",
    async (status) => {
      for (const accept of ["text/html", "text/plain"]) {
        const response = presentUnavailableFile(
          request(accept),
          new Response("File unavailable.\n", {
            status,
            headers: {
              "cache-control": "no-store",
              "x-content-type-options": "nosniff",
              vary: "Origin",
            },
          }),
        );
        expect(response.status).toBe(status);
        expect(response.headers.get("vary")).toBe(
          "Origin, Accept, Sec-Fetch-Mode, Sec-Fetch-Dest",
        );
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
        if (accept === "text/html") {
          expect(response.headers.get("content-security-policy")).toContain(
            "default-src 'none'",
          );
          expect(response.headers.get("referrer-policy")).toBe("no-referrer");
          expect(await response.text()).toContain("File unavailable");
        } else expect(await response.text()).toBe("File unavailable.\n");
      }
    },
  );
  it.each([200, 206, 400, 403, 416, 500])(
    "leaves status %i and bytes untouched",
    (status) => {
      const response = new Response("original", { status });
      expect(presentUnavailableFile(request("text/html"), response)).toBe(
        response,
      );
    },
  );
});
