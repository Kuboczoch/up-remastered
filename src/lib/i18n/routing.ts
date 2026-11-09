import { localeCookie, resolveLocale } from "./locale";

/** UI routes only. Never rewrite a raw download, helper or API capability. */
export function localizedPath(pathname: string, locale: string): string | null {
  if (
    pathname === "/" ||
    /^\/request\/(?:new|manage|[^/]+)\/?$/.test(pathname) ||
    /^\/decrypt\/[^/]+\/?$/.test(pathname)
  ) {
    return `/l10n/${locale}${pathname === "/" ? "" : pathname}`;
  }
  return null;
}

export function requestLocale(
  url: URL,
  cookie: string | undefined,
  language: string | null,
) {
  return resolveLocale({
    query: url.searchParams.get("lang"),
    cookie,
    acceptLanguage: language,
  });
}

export { localeCookie };
