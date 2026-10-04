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
  const response = internal
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
  matcher: ["/", "/request/:path*", "/decrypt/:path*", "/locale/:path*"],
};
