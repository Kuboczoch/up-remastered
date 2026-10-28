import http from "node:http";

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
