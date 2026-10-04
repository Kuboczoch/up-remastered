import "server-only";

import { createHash } from "node:crypto";
import { siteDescription, siteName } from "@/config/site";
import { translateMessage } from "@/i18n/messages";
import {
  isLocale,
  localeCookie,
  mergeVary,
  resolveLocale,
} from "@/i18n/locale";
import { unavailableMessages } from "./unavailable-messages";

// Only explicit, valid HTML acceptance can opt in. Specific media ranges
// override wildcards; conflicting duplicate ranges use the lower quality so
// exclusions are never undone. Malformed q-values never become implicit q=1.
function acceptsHtml(header: string | null): boolean {
  if (!header || header.length > 8192) return false;
  const ranges = header.split(",").flatMap((member) => {
    const [media, ...parameters] = member.split(";");
    const match =
      /^\s*([a-z0-9!#$&^_.+-]+|\*)\/([a-z0-9!#$&^_.+-]+|\*)\s*$/i.exec(media);
    if (!match || (match[1] === "*" && match[2] !== "*")) return [];
    const type = `${match[1]}/${match[2]}`.toLowerCase();
    let q = 1;
    let seenQuality = false;
    for (const parameter of parameters) {
      const parsed =
        /^\s*([a-z0-9!#$&^_.+-]+)\s*(?:=\s*([a-z0-9!#$&^_.+-]+|"[^"\r\n]*"))?\s*$/i.exec(
          parameter,
        );
      // Fail closed for malformed preferences, including malformed exclusions.
      if (!parsed) return [{ type, q: 0 }];
      const name = parsed[1].toLowerCase();
      const value = parsed[2];
      if (name === "q") {
        if (
          seenQuality ||
          !value ||
          !/^(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(value)
        )
          return [{ type, q: 0 }];
        q = Number(value);
        seenQuality = true;
      } else if (!seenQuality) {
        // Our HTML and raw text representations are UTF-8. Unsupported media
        // parameters cannot match; parameters after q are Accept extensions.
        if (
          name !== "charset" ||
          value?.replace(/^"|"$/g, "").toLowerCase() !== "utf-8"
        )
          return [{ type, q: 0 }];
      }
    }
    return [{ type, q }];
  });
  const quality = (type: string) => {
    for (const candidate of [type, `${type.split("/")[0]}/*`, "*/*"]) {
      const matches = ranges.filter((range) => range.type === candidate);
      if (matches.length) return Math.min(...matches.map((range) => range.q));
    }
    return 0;
  };
  const html = quality("text/html");
  return (
    html > 0 &&
    ranges.some((range) => range.type === "text/html") &&
    html >= quality("text/plain") &&
    !ranges.some(
      (range) =>
        range.type !== "*/*" &&
        range.type !== "text/*" &&
        range.type !== "text/html" &&
        quality(range.type) > html,
    )
  );
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}

const styles = `:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#080c12;color:#e8edf5;font:16px/1.6 system-ui,sans-serif}header,main{max-width:48rem;margin:auto;padding:1.5rem}header{border-bottom:1px solid #293345}a{color:#b2d4ff;display:inline-flex;align-items:center;min-height:44px;padding:.65rem 1rem;border-radius:.5rem;text-decoration:underline;text-underline-offset:.2em}a:focus-visible{outline:3px solid #b2d4ff;outline-offset:4px}header a{padding-left:0;font-weight:700}main{padding-top:clamp(2rem,8vh,6rem)}.code{color:#b2d4ff;font-size:.875rem;letter-spacing:.12em}h1{font-size:clamp(1.8rem,6vw,3rem);line-height:1.2;overflow-wrap:anywhere}p{max-width:40rem;color:#bdc8d9}nav{display:flex;gap:1rem;flex-wrap:wrap;margin-top:2rem}.primary{background:#b2d4ff;color:#080c12;font-weight:600}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}`;
const styleHash = createHash("sha256").update(styles).digest("base64");

/** Presentation only: call from public GET aliases, never API or HEAD routes.
 * Successful files/ranges and explicit downloads remain exactly untouched.
 */
export async function presentUnavailableDownload(
  request: Request,
  response: Response,
): Promise<Response> {
  if (
    request.method !== "GET" ||
    ![404, 410].includes(response.status) ||
    request.headers.has("range") ||
    new URL(request.url).searchParams.get("download") === "1"
  )
    return response;

  const headers = new Headers(response.headers);
  headers.set(
    "Vary",
    mergeVary(
      headers.get("Vary"),
      "Accept",
      "Sec-Fetch-Mode",
      "Sec-Fetch-Dest",
      "Accept-Language",
      "Cookie",
    ),
  );
  if (
    request.headers.get("sec-fetch-mode") !== "navigate" ||
    !["document", "iframe"].includes(
      request.headers.get("sec-fetch-dest") ?? "",
    ) ||
    !acceptsHtml(request.headers.get("accept"))
  ) {
    // Even the raw representation varies: preserve its status and exact bytes.
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const query = new URL(request.url).searchParams.get("lang");
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((member) => member.trim())
    .find((member) => member.startsWith(`${localeCookie}=`))
    ?.slice(localeCookie.length + 1);
  const locale = resolveLocale(
    request.headers.get("accept-language"),
    isLocale(query) ? query : cookie,
  );
  const copy = unavailableMessages[locale];
  const title = escapeHtml(copy.title);
  const home = `/?lang=${locale}`;
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="description" content="${escapeHtml(translateMessage(locale, siteDescription))}"><title>${title} | ${escapeHtml(siteName)}</title><style>${styles}</style></head><body><header><a href="${home}">${escapeHtml(siteName)}</a></header><main><div class="code">${response.status}</div><h1>${title}</h1><p>${escapeHtml(copy.explanation)}</p><p>${escapeHtml(copy.help)}</p><nav aria-label="${escapeHtml(copy.home)}"><a class="primary" href="${home}">${escapeHtml(copy.upload)}</a><a href="${home}">${escapeHtml(copy.home)}</a></nav></main></body></html>`;
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Content-Language", locale);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set(
    "Content-Security-Policy",
    `default-src 'none'; style-src 'sha256-${styleHash}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  );
  headers.delete("Content-Length");
  if (isLocale(query))
    headers.append(
      "Set-Cookie",
      `${localeCookie}=${query}; Path=/; Max-Age=31536000; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
    );
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
