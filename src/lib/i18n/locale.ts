export const supportedLocales = ["en", "pl"] as const;
export type Locale = (typeof supportedLocales)[number];
export const defaultLocale: Locale = "en";
export const localeCookie = "up-locale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "pl";
}

/** Explicit choices override hints. Invalid language members never imply q=1.
 * Ties use source order, then our default locale. An explicit base exclusion
 * also excludes regional hints mapping to that base. If nothing matches,
 * English is a safety fallback rather than a claim of language acceptance.
 */
export function resolveLocale({
  query,
  cookie,
  acceptLanguage,
}: {
  query?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
} = {}): Locale {
  if (isLocale(query)) return query;
  if (isLocale(cookie)) return cookie;
  const ranges = (acceptLanguage ?? "")
    .slice(0, 8192)
    .split(",")
    .flatMap((member, order) => {
      const match =
        /^\s*(\*|[a-z]{1,8}(?:-[a-z0-9]{1,8})*)\s*(?:;\s*q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?\s*$/i.exec(
          member,
        );
      return match
        ? [{ tag: match[1].toLowerCase(), q: Number(match[2] ?? 1), order }]
        : [];
    });
  const candidates = supportedLocales.flatMap((locale, index) => {
    const specific = ranges.filter(
      (range) => range.tag.split("-")[0] === locale,
    );
    if (specific.some((range) => range.tag === locale && range.q === 0))
      return [];
    const matching = specific.length
      ? specific
      : ranges.filter((range) => range.tag === "*");
    const best = matching.sort((a, b) => b.q - a.q || a.order - b.order)[0];
    return best?.q ? [{ locale, q: best.q, order: best.order, index }] : [];
  });
  return (
    candidates.sort(
      (a, b) => b.q - a.q || a.order - b.order || a.index - b.index,
    )[0]?.locale ?? defaultLocale
  );
}
