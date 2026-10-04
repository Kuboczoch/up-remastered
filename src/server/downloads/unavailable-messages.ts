import type { Locale } from "@/i18n/locale";

// Deliberately independent of the shared UI dictionary: no lifecycle-specific
// cause, uploaded metadata, identifier, URL or capability enters this copy.
export const unavailableMessages: Record<
  Locale,
  {
    title: string;
    explanation: string;
    help: string;
    home: string;
    upload: string;
  }
> = {
  en: {
    title: "File unavailable",
    explanation:
      "This link may have expired, the file may have been deleted, or its download limit may have been reached.",
    help: "Check the link or ask the sender to upload the file again.",
    home: "Home",
    upload: "Upload another file",
  },
  pl: {
    title: "Plik niedostępny",
    explanation:
      "Link mógł wygasnąć, plik mógł zostać usunięty lub mógł zostać osiągnięty limit pobrań.",
    help: "Sprawdź link lub poproś nadawcę o ponowne przesłanie pliku.",
    home: "Strona główna",
    upload: "Prześlij kolejny plik",
  },
};
