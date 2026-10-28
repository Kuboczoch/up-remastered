import http from "node:http";
import { resolveLocale, localeCookie } from "../src/lib/i18n/locale.ts";

const hopHeaders = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

function endToEndHeaders(headers) {
  const result = { ...headers };
  const nominated = String(headers.connection ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase());
  for (const name of [...hopHeaders, ...nominated]) delete result[name];
  return result;
}

export function mergeVary(value, additions) {
  const tokens = String(value ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.includes("*")) return "*";
  for (const token of additions) {
    if (
      !tokens.some((existing) => existing.toLowerCase() === token.toLowerCase())
    )
      tokens.push(token);
  }
  return tokens.join(", ");
}

// HTTP streams remain streams: no fetch decoding, body buffering or retry of a
// capability-consuming operation. Only final HTML/RSC Vary is augmented.
export function createFinalResponseProxy(upstreamPort) {
  return http.createServer((request, response) => {
    const upstream = http.request({
      hostname: "127.0.0.1",
      port: upstreamPort,
      method: request.method,
      path: request.url,
      headers: endToEndHeaders(request.headers),
    });
    upstream.on("response", (incoming) => {
      const headers = endToEndHeaders(incoming.headers);
      const contentType = String(headers["content-type"] ?? "");
      if (/^(text\/html|text\/x-component)(?:;|$)/i.test(contentType)) {
        headers.vary = mergeVary(headers.vary, ["Accept-Language", "Cookie"]);
        // Static RSC responses can discard middleware response headers.
        const url = new URL(request.url, "http://internal.invalid");
        const internalLocale = /^\/l10n\/(en|pl)(?:\/|\.|$)/.exec(
          url.pathname,
        )?.[1];
        if (internalLocale) headers["content-language"] = internalLocale;
        if (
          url.pathname === "/" ||
          /^\/(?:request|decrypt)\//.test(url.pathname) ||
          (incoming.statusCode === 404 && /\brsc\b/i.test(headers.vary))
        ) {
          // Match Next's cookie decoding and last valid duplicate precedence.
          // Leave the original Cookie header untouched on the upstream request.
          let cookie;
          for (const entry of String(request.headers.cookie ?? "").split(
            /; */,
          )) {
            if (!entry.startsWith(`${localeCookie}=`)) continue;
            try {
              cookie = decodeURIComponent(entry.slice(localeCookie.length + 1));
            } catch {
              // Next ignores malformed percent encoding rather than crashing.
            }
          }
          headers["content-language"] = resolveLocale({
            query: url.searchParams.get("lang"),
            cookie,
            acceptLanguage: request.headers["accept-language"],
          });
        }
      }
      response.writeHead(incoming.statusCode ?? 502, headers);
      incoming.on("error", () => response.destroy());
      incoming.on("aborted", () => response.destroy());
      response.on("close", () => {
        if (!response.writableFinished) incoming.destroy();
      });
      incoming.pipe(response);
    });
    upstream.on("error", () => {
      if (response.headersSent) response.destroy();
      else {
        response.writeHead(502, {
          "Content-Type": "text/plain",
          "Cache-Control": "no-store",
        });
        response.end("Upstream unavailable.\n");
      }
    });
    request.on("aborted", () => upstream.destroy());
    request.on("error", () => upstream.destroy());
    response.on("close", () => {
      if (!response.writableFinished) upstream.destroy();
    });
    request.pipe(upstream);
  });
}
