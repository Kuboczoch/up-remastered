import { describe, expect, it } from "@jest/globals";
import { presentUnavailableDownload } from "./unavailable-page";

function request(
  accept = "text/html",
  extra: Record<string, string> = {},
  query = "",
) {
  return new Request(`http://localhost/ZZZZZ${query}`, {
    headers: {
      Accept: accept,
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Dest": "document",
      ...extra,
    },
  });
}
function unavailable() {
  return new Response("File unavailable.\n", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "RSC",
    },
  });
}
describe("unavailable navigation presentation", () => {
  it.each([
    "text/html",
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "TEXT/HTML;Q=1",
    "text/html;charset=utf-8",
    'text/html;charset="UTF-8";q=1',
    "text/html;q=1;extension=value",
    "text/html;q=0.8,text/plain;q=0.2",
    "text/html;q=0.5,text/*;q=0,*/*;q=1",
  ])("accepts HTML navigation %s", async (accept) => {
    const response = await presentUnavailableDownload(
      request(accept),
      unavailable(),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("vary")).toContain("RSC");
    expect(response.headers.get("vary")).toContain("Accept-Language");
    expect(await response.text()).toContain("Upload another file");
  });
  it.each([
    "",
    "*/*",
    "text/*",
    "application/json",
    "text/html;q=0,*/*;q=1",
    "text/html;q=0;extension=value,*/*;q=1",
    "text/html;charset=iso-8859-1,*/*",
    "text/html;q=bogus,text/html;q=1",
    "text/html;q=0,text/*;q=1",
    "text/html;q=0.5,text/plain;q=1",
    "application/json;q=1,text/html;q=0.5",
    "application/*;q=1,text/html;q=0.5",
    "text/html;q=bogus",
    "text/html;q=1.001",
    "text/html;q=0.0000",
    "text/html;q=0.5;q=1",
    "text/html;q=0,text/html;q=1",
  ])("retains raw bytes for %s", async (accept) => {
    const response = await presentUnavailableDownload(
      request(accept),
      unavailable(),
    );
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(await response.text()).toBe("File unavailable.\n");
  });
  it.each<Record<string, string>>([
    { "Sec-Fetch-Mode": "cors" },
    { "Sec-Fetch-Dest": "empty" },
  ])("rejects non-navigation metadata %j", async (extra) => {
    expect(
      await (
        await presentUnavailableDownload(
          request("text/html", extra),
          unavailable(),
        )
      ).text(),
    ).toBe("File unavailable.\n");
  });
  it("does not infer navigation from Accept alone, ranges or forced downloads", async () => {
    for (const req of [
      new Request("http://localhost/ZZZZZ", {
        headers: { Accept: "text/html" },
      }),
      request("text/html", { Range: "bytes=0-1" }),
      request("text/html", {}, "?download=1"),
    ]) {
      expect(
        await (await presentUnavailableDownload(req, unavailable())).text(),
      ).toBe("File unavailable.\n");
    }
  });
  it.each([
    ["pl-PL,en;q=0.5", "", "", "pl"],
    ["pl", "up-locale=en", "", "en"],
    ["en", "up-locale=en", "?lang=pl", "pl"],
    ["pl", "up-locale=bad", "?lang=bad", "pl"],
  ])("locale precedence %s %s %s", async (header, cookie, query, locale) => {
    const response = await presentUnavailableDownload(
      request(
        "text/html",
        { "Accept-Language": header, Cookie: cookie },
        query,
      ),
      unavailable(),
    );
    expect(response.headers.get("content-language")).toBe(locale);
    expect(await response.text()).toContain(`<html lang="${locale}">`);
  });
  it("preserves 410 and does not render HEAD, POST or other error responses", async () => {
    const gone = await presentUnavailableDownload(
      request(),
      new Response("File unavailable.\n", { status: 410 }),
    );
    expect(gone.status).toBe(410);
    expect(await gone.text()).toContain('<div class="code">410</div>');
    for (const method of ["HEAD", "POST"]) {
      const response = unavailable();
      expect(
        await presentUnavailableDownload(
          new Request(request(), { method }),
          response,
        ),
      ).toBe(response);
    }
    for (const status of [400, 403, 416, 500]) {
      const response = new Response("not unavailable", { status });
      expect(await presentUnavailableDownload(request(), response)).toBe(
        response,
      );
    }
  });
  it("does not interpolate hostile URL/query/cookie/Accept values", async () => {
    const response = await presentUnavailableDownload(
      request(
        "text/html",
        {
          Cookie: "up-locale=<script>alert(1)</script>",
          "Accept-Language": "<img>",
        },
        "?lang=%3Cscript%3E&accessToken=private-token",
      ),
      unavailable(),
    );
    const html = await response.text();
    expect(html).not.toContain("private-token");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img>");
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "style-src 'sha256-",
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("preserves successful bytes, headers and status", async () => {
    const response = new Response("hello", {
      status: 206,
      headers: { "Content-Range": "bytes 0-4/10" },
    });
    expect(await presentUnavailableDownload(request(), response)).toBe(
      response,
    );
    expect(await response.text()).toBe("hello");
  });
});
