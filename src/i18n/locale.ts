export const supportedLocales = ["en", "pl"] as const;
export type Locale = (typeof supportedLocales)[number];
export const defaultLocale: Locale = "en";
export const localeCookie = "up-locale";
export function isLocale(value: unknown): value is Locale {
  return supportedLocales.includes(value as Locale);
}

/** Basic language ranges, RFC 9110 q-values, deterministic source-order ties.
 * Invalid members are ignored, never allowed to become implicit q=1.
 * A base q=0 also excludes regional hints that would map to that base.
 * If nothing acceptable remains, English is a safety fallback, not a match.
 */
export function resolveLocale(
  header?: string | null,
  explicit?: string | null,
): Locale {
  if (isLocale(explicit)) return explicit;
  const ranges = (header ?? "")
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
    const baseExcluded = specific.some(
      (range) => range.tag === locale && range.q === 0,
    );
    if (baseExcluded) return [];
    // A specific range wins over wildcard; q=0 is not discarded before matching.
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

export function mergeVary(
  existing: string | null,
  ...values: string[]
): string {
  const tokens = (existing ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.includes("*")) return "*";
  for (const value of values)
    if (!tokens.some((token) => token.toLowerCase() === value.toLowerCase()))
      tokens.push(value);
  return tokens.join(", ");
}
