import "server-only";

import { createHash } from "node:crypto";

// Fail closed: Accept alone is also sent by fetch clients and download tools.
export function acceptsUnavailablePage(request: Request): boolean {
  if (
    request.method !== "GET" ||
    request.headers.get("sec-fetch-mode") !== "navigate" ||
    request.headers.get("sec-fetch-dest") !== "document" ||
    new URL(request.url).searchParams.get("download") === "1"
  )
    return false;

  const accept = request.headers.get("accept");
  if (!accept) return false;
  let html: number | undefined;
  let other = 0;
  const seen = new Set<string>();
  for (const range of accept.split(",")) {
    const [rawType, ...parameters] = range.trim().toLowerCase().split(";");
    const type = rawType.trim();
    if (
      !/^(?:[a-z0-9!#$&^_.+-]+|\*)\/(?:[a-z0-9!#$&^_.+-]+|\*)$/.test(type) ||
      (type.startsWith("*/") && type !== "*/*") ||
      seen.has(type)
    )
      return false;
    seen.add(type);
    let quality = 1;
    let hasQuality = false;
    for (const parameter of parameters) {
      const value = parameter.trim();
      if (value.startsWith("q=")) {
        if (hasQuality || !/^q=(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(value))
          return false;
        hasQuality = true;
        quality = Number(value.slice(2));
      } else if (!hasQuality) {
        // Other advertised media ranges may carry valid representation
        // parameters (Chromium sends signed-exchange;v=b3). Those do not
        // describe our HTML and must not invalidate the entire Accept list.
        if (
          !/^[a-z0-9!#$&^_.+-]+=(?:[a-z0-9!#$&^_.+-]+|"[^"\r\n]*")$/.test(value)
        )
          return false;
        // Only the HTML representation's actual charset is supported.
        if (
          type === "text/html" &&
          value !== "charset=utf-8" &&
          value !== 'charset="utf-8"'
        )
          return false;
      } else if (
        !/^[a-z0-9!#$&^_.+-]+(?:=(?:[a-z0-9!#$&^_.+-]+|"[^"\r\n]*"))?$/.test(
          value,
        )
      )
        return false;
    }
    if (type === "text/html") html = quality;
    else other = Math.max(other, quality);
  }
  return html !== undefined && html > 0 && html >= other;
}

const style = `*{box-sizing:border-box}html{color-scheme:dark;background:#202127;color:#f0eff8;font-family:Arial,Helvetica,sans-serif}body{margin:0;line-height:1.6}header,main,footer{width:min(100% - 40px,800px);margin:auto}header{padding:24px 0;border-bottom:1px solid #505363}header a{color:inherit;text-decoration:none}header small{display:block;color:#b1b0c4}main{padding:64px 0}h1{font-size:clamp(1.7rem,6vw,2.4rem);line-height:1.2}p{max-width:36rem;color:#b1b0c4}.action{display:inline-block;margin-top:20px;padding:12px 20px;background:#a49af5;color:#191527;border-radius:8px;font-weight:bold;text-decoration:none}a:focus-visible{outline:3px solid #b9b1ff;outline-offset:5px}footer{border-top:1px solid #505363;padding:20px 0;color:#b1b0c4;font-size:.85rem}`;
const styleHash = createHash("sha256").update(style).digest("base64");
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>File unavailable · Up - Remastered</title><style>${style}</style></head><body><header><a href="/" aria-label="Up - Remastered home"><strong>↑ Up - Remastered</strong><small>Temporary file sharing</small></a></header><main><h1>File unavailable</h1><p>This link cannot be used. The file may have expired, been deleted, or reached its download limit. The link may also be incorrect.</p><p>Ask the sender for a new link, or return home to share another file.</p><a class="action" href="/">Upload another file</a></main><footer>Files are temporary. Keep a copy of anything important.</footer></body></html>`;

// The shared lifecycle has already decided availability. Never look up metadata
// or consume a download merely to render an error, and never decorate API/HEAD.
export function presentUnavailableFile(
  request: Request,
  response: Response,
): Response {
  if (response.status !== 404 && response.status !== 410) return response;
  const headers = new Headers(response.headers);
  const vary = new Set(
    (headers.get("vary") ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
  for (const name of ["Accept", "Sec-Fetch-Mode", "Sec-Fetch-Dest"])
    vary.add(name);
  headers.set("Vary", [...vary].join(", "));
  if (!acceptsUnavailablePage(request))
    return new Response(response.body, { status: response.status, headers });
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set(
    "Content-Security-Policy",
    `default-src 'none'; style-src 'sha256-${styleHash}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  );
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  return new Response(page, { status: response.status, headers });
}
