import { NextRequest, NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n/locale";
import { localizedPath, requestLocale, localeCookie } from "@/lib/i18n/routing";

export function proxy(request: NextRequest) {
  const locale = requestLocale(
    request.nextUrl,
    request.cookies.get(localeCookie)?.value,
    request.headers.get("accept-language"),
  );
  const path = localizedPath(request.nextUrl.pathname, locale);
  const headers = new Headers(request.headers);
  // Always replace client input: global 404 has no route params or layout.
  headers.set("x-up-locale", locale);
  if (!path) return NextResponse.next({ request: { headers } });
  const target = request.nextUrl.clone();
  target.pathname = path;
  const response = NextResponse.rewrite(target, { request: { headers } });
  response.headers.set("Content-Language", locale);
  if (isLocale(request.nextUrl.searchParams.get("lang"))) {
    response.cookies.set(localeCookie, locale, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      maxAge: 31536000,
    });
  }
  return response;
}

// Never put upload/API or raw download streams through Next's request proxy.
export const config = {
  matcher: ["/((?!api(?:/|$)|u(?:/|$)|_next/).*)"],
};
