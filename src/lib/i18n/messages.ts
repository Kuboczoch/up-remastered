import type { Locale } from "./locale";

/** English source messages are stable keys, not API machine codes.
 * Add entries while localizing each surface; never translate arbitrary API text.
 */
export const polish = {
  "Small self-hosted temporary file hosting service.":
    "Mały, samodzielnie hostowany serwis do tymczasowego udostępniania plików.",
  "Request a file": "Poproś o plik",
  "Temporary by design.": "Z założenia tymczasowe.",
  Footer: "Stopka",
  "ShareX config": "Konfiguracja ShareX",
  "Shell helper": "Pomocnik powłoki",
  Artwork: "Ilustracja",
  "GitHub repository (opens in a new tab)":
    "Repozytorium GitHub (otwiera się w nowej karcie)",
  "{siteName} home": "{siteName} — strona główna",
  "Something went wrong": "Coś poszło nie tak",
  "Upload failed. Try again.":
    "Przesyłanie nie powiodło się. Spróbuj ponownie.",
  "{name} was deleted.": "Plik {name} został usunięty.",
} as const;
export type MessageKey = keyof typeof polish;
export type MessageValues = Readonly<Record<string, string | number>>;
export const english = Object.fromEntries(
  Object.keys(polish).map((key) => [key, key]),
) as Record<MessageKey, string>;
export const dictionaries = { en: english, pl: polish } satisfies Record<
  Locale,
  Readonly<Record<MessageKey, string>>
>;

export function translate(
  locale: Locale,
  key: MessageKey,
  values: MessageValues = {},
): string {
  const message: string = dictionaries[locale][key];
  return message.replace(/\{([a-zA-Z][\w]*)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}

/** Unknown error messages may contain secrets and must never reach the UI. */
export function translateMessage(
  locale: Locale,
  message: string,
  fallback: MessageKey = "Something went wrong",
): string {
  return translate(
    locale,
    Object.hasOwn(polish, message) ? (message as MessageKey) : fallback,
  );
}
