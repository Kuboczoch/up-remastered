import { NextRequest, NextResponse } from "next/server";
import {
  isLocale,
  localeCookie,
  mergeVary,
  resolveLocale,
} from "@/i18n/locale";

/** Only HTML UI paths. Raw file, helper, and API routes never enter this proxy. */
export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const internal = /^\/locale\/(en|pl)(?:\/|$)/.exec(url.pathname);
  const queryChoice = url.searchParams.get("lang");
  const cookieChoice = request.cookies.get(localeCookie)?.value;
  const locale = internal
    ? internal[1]
    : resolveLocale(
        request.headers.get("accept-language"),
        isLocale(queryChoice) ? queryChoice : cookieChoice,
      );
  const destination = url.clone();
  destination.pathname = `/locale/${locale}${url.pathname === "/" ? "" : url.pathname}`;
  const isUnknownNestedUi =
    !internal &&
    url.pathname.split("/").filter(Boolean).length > 1 &&
    !/^\/(request|decrypt)(?:\/|$)/.test(url.pathname);
  if (
    isUnknownNestedUi &&
    (!["GET", "HEAD"].includes(request.method) ||
      !request.headers.get("accept")?.includes("text/html"))
  )
    return NextResponse.next();
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-up-not-found-locale", locale);
  // An unmatched public URL needs the complete global error document. Rewriting
  // into the async locale layout starts a stream and turns its notFound into 200.
  const response = isUnknownNestedUi
    ? NextResponse.next({ request: { headers: forwardedHeaders } })
    : internal
      ? NextResponse.next()
      : NextResponse.rewrite(destination);
  response.headers.set("Content-Language", locale);
  response.headers.set(
    "Vary",
    mergeVary(response.headers.get("Vary"), "Accept-Language", "Cookie"),
  );
  // Internal static artifacts are locale-keyed. Shared public caches MUST NOT
  // collapse distinct RSC/document variants; private caching is deliberate.
  response.headers.set("Cache-Control", "private, no-store");
  if (isLocale(queryChoice))
    response.cookies.set(localeCookie, queryChoice, {
      path: "/",
      sameSite: "lax",
      secure: url.protocol === "https:",
      maxAge: 31536000,
    });
  return response;
}
export const config = {
  matcher: [
    "/",
    "/request/:path*",
    "/decrypt/:path*",
    "/locale/:path*",
    // Only otherwise-unowned nested UI paths. A single segment remains the
    // raw /[id] contract; /u, helpers, APIs, and dotted assets remain untouched.
    "/((?!api/|_next/|u/|sh/|sharex/|assets/|icons/|.*\\.)[^/]+/.+)",
  ],
};
