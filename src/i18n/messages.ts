import type { Locale } from "./locale";

/** English source messages are stable keys, not API machine codes. */
export const polish = {
  "Invalid protected link. Ask the sender for a new link.":
    "Nieprawidłowy chroniony link. Poproś nadawcę o nowy link.",
  "This file is unavailable: it may have expired, been deleted, or reached its download limit. Ask the sender to upload it again.":
    "Plik jest niedostępny: mógł wygasnąć, zostać usunięty lub osiągnąć limit pobrań. Poproś nadawcę o ponowne przesłanie.",
  "Download failed ({status}). Check your connection and try again; a retry may use another download.":
    "Pobieranie nie powiodło się ({status}). Sprawdź połączenie i spróbuj ponownie; ponowienie może zużyć kolejne pobranie.",
  "This protected file exceeds the 32 MiB browser memory limit.":
    "Ten chroniony plik przekracza limit pamięci przeglądarki wynoszący 32 MiB.",
  "The server returned no file. Ask the sender to upload it again.":
    "Serwer nie zwrócił pliku. Poproś nadawcę o ponowne przesłanie.",
  "Key protection requires a browser with Web Crypto on HTTPS (or localhost). No plaintext was uploaded.":
    "Ochrona kluczem wymaga przeglądarki z Web Crypto przez HTTPS (lub localhost). Nie przesłano niezaszyfrowanych danych.",
  "Key protection supports files up to 32 MiB. Choose a smaller file; encryption never falls back to plaintext.":
    "Ochrona kluczem obsługuje pliki do 32 MiB. Wybierz mniejszy plik; szyfrowanie nigdy nie przechodzi na niezaszyfrowane przesyłanie.",
  "The file name is too long for key protection.":
    "Nazwa pliku jest zbyt długa dla ochrony kluczem.",
  "Missing or invalid key. Ask the sender for the complete link, including #key=….":
    "Brak klucza lub nieprawidłowy klucz. Poproś nadawcę o pełny link z #key=….",
  "Unsupported or damaged protected file. Ask the sender to upload it again.":
    "Nieobsługiwany lub uszkodzony chroniony plik. Poproś nadawcę o ponowne przesłanie.",
  "Unable to decrypt: the key is wrong or the file is damaged. Ask the sender for the complete link or a new upload.":
    "Nie można odszyfrować: klucz jest błędny lub plik jest uszkodzony. Poproś nadawcę o pełny link lub ponowne przesłanie.",
  "Small self-hosted temporary file hosting service.":
    "Mały, samodzielnie hostowany serwis do tymczasowego udostępniania plików.",
  "Request a file": "Poproś o plik",
  "Request a file.": "Poproś o plik.",
  "Request a file ↗": "Poproś o plik ↗",
  "← Back to uploads": "← Wróć do przesyłania",
  "← Home": "← Strona główna",
  "Create a private, single-use link for someone else to upload one file.":
    "Utwórz prywatny, jednorazowy link, przez który inna osoba prześle jeden plik.",
  "Manage upload request": "Zarządzaj prośbą o plik",
  "Manage upload request.": "Zarządzaj prośbą o plik.",
  "Check its status or revoke it before a file is uploaded.":
    "Sprawdź jej stan lub unieważnij ją przed przesłaniem pliku.",
  "Upload a requested file": "Prześlij zamówiony plik",
  "Upload a requested file.": "Prześlij zamówiony plik.",
  "Upload request unavailable": "Prośba o plik jest niedostępna",
  "This link is invalid, expired, revoked, already used, or currently in use.":
    "Ten link jest nieprawidłowy, wygasł, został unieważniony, wykorzystany lub jest obecnie używany.",
  "Temporary by design.": "Z założenia tymczasowe.",
  Footer: "Stopka",
  "ShareX config": "Konfiguracja ShareX",
  "Shell helper": "Pomocnik powłoki",
  Artwork: "Ilustracja",
  "GitHub repository (opens in a new tab)":
    "Repozytorium GitHub (otwiera się w nowej karcie)",
  "{siteName} home": "{siteName} — strona główna",
  "Unexpected error": "Nieoczekiwany błąd",
  "Something went wrong": "Coś poszło nie tak",
  "Try the request again. No error details are exposed here.":
    "Spróbuj ponownie. Szczegóły błędu nie są tutaj ujawniane.",
  "Try again": "Spróbuj ponownie",
  Loading: "Ładowanie",
  "Please wait": "Proszę czekać",
  "The requested content is loading.": "Trwa ładowanie żądanej zawartości.",
  "Page not found": "Nie znaleziono strony",
  "The requested page or file is unavailable.":
    "Żądana strona lub plik są niedostępne.",
  "Return home": "Wróć na stronę główną",
  "Private transfer": "Prywatne przesyłanie",
  "Decrypt your file": "Odszyfruj plik",
  "Decrypt your file · Up": "Odszyfruj plik · Up",
  "This file is protected with a secret key. Decryption happens only in your browser; the server never receives the key.":
    "Ten plik jest chroniony tajnym kluczem. Odszyfrowywanie odbywa się wyłącznie w Twojej przeglądarce; serwer nigdy nie otrzymuje klucza.",
  "Files up to 32 MiB are supported. Nothing is downloaded until you choose to decrypt. Fetching the encrypted file uses one download from its limit, even if the key is wrong.":
    "Obsługiwane są pliki do 32 MiB. Nic nie jest pobierane, dopóki nie wybierzesz odszyfrowania. Pobranie zaszyfrowanego pliku zużywa jedno pobranie z limitu, nawet przy błędnym kluczu.",
  "Missing or invalid key. Ask the sender for the complete link, including #key=…, or enter the key below.":
    "Brak klucza lub nieprawidłowy klucz. Poproś nadawcę o pełny link z #key=… lub wpisz klucz poniżej.",
  "Decryption key": "Klucz odszyfrowywania",
  "Use the key after #key= in the sender’s link. Never send it to the server or put it in a URL query.":
    "Użyj klucza po #key= w linku nadawcy. Nigdy nie wysyłaj go do serwera ani nie umieszczaj w parametrach adresu URL.",
  "Downloading and decrypting…": "Pobieranie i odszyfrowywanie…",
  "Decrypt file": "Odszyfruj plik",
  "Downloading encrypted file": "Pobieranie zaszyfrowanego pliku",
  "Authenticating and decrypting": "Weryfikacja i odszyfrowywanie",
  "Cancelling decryption…": "Anulowanie odszyfrowywania…",
  "Cancel decryption": "Anuluj odszyfrowywanie",
  "Decrypted: {name} ({size}). Save the original file below.":
    "Odszyfrowano: {name} ({size}). Zapisz oryginalny plik poniżej.",
  "Save decrypted file": "Zapisz odszyfrowany plik",
  "Upload another file": "Prześlij kolejny plik",
  "Decryption requires HTTPS (or localhost) and Web Crypto. No file was fetched.":
    "Odszyfrowywanie wymaga HTTPS (lub localhost) i Web Crypto. Żaden plik nie został pobrany.",
  "Download failed. Check your connection and ask the sender for a new link.":
    "Pobieranie nie powiodło się. Sprawdź połączenie i poproś nadawcę o nowy link.",
  "The key is wrong or the encrypted file is damaged. Ask the sender for the complete link.":
    "Klucz jest błędny lub zaszyfrowany plik jest uszkodzony. Poproś nadawcę o pełny link.",
  "Share temporary files and text.": "Udostępniaj tymczasowe pliki i tekst.",
  "Everything expires automatically.": "Wszystko wygasa automatycznie.",
  File: "Plik",
  Text: "Tekst",
  "Upload type": "Rodzaj przesyłania",
  "Advanced options": "Opcje zaawansowane",
  "Choose file": "Wybierz plik",
  "or drop one file here": "lub upuść tutaj jeden plik",
  "Drop file to upload": "Upuść plik, aby go przesłać",
  "Upload a file": "Prześlij plik",
  "Or upload text": "Lub prześlij tekst",
  "Paste or type text": "Wklej lub wpisz tekst",
  "Upload text": "Prześlij tekst",
  "Checking limit…": "Sprawdzanie limitu…",
  "{size} max": "maks. {size}",
  "Temporary storage": "Tymczasowe przechowywanie",
  Cancel: "Anuluj",
  Encrypting: "Szyfrowanie",
  "Encrypting in your browser": "Szyfrowanie w przeglądarce",
  Uploading: "Przesyłanie",
  "Preparing protected file…": "Przygotowywanie chronionego pliku…",
  "Upload progress": "Postęp przesyłania",
  "Encrypting; network upload has not started":
    "Szyfrowanie; przesyłanie przez sieć jeszcze się nie rozpoczęło",
  "Upload complete": "Przesyłanie zakończone",
  Expires: "Wygasa",
  "Share URL": "Adres udostępniania",
  "Double-click to copy": "Kliknij dwukrotnie, aby skopiować",
  Copied: "Skopiowano",
  "Copy URL": "Kopiuj adres",
  "Copy link": "Kopiuj link",
  "Anyone with the link can download.": "Każdy, kto ma link, może pobrać plik.",
  "Only the full link unlocks the file. Keep it safe: keys are not saved in this app’s upload history and cannot be recovered.":
    "Tylko pełny link odblokowuje plik. Zachowaj go: klucze nie są zapisywane w historii aplikacji i nie można ich odzyskać.",
  "Uploaded file actions": "Działania na przesłanym pliku",
  "Open file": "Otwórz plik",
  "Download file": "Pobierz plik",
  "Show QR code": "Pokaż kod QR",
  "Close QR code": "Zamknij kod QR",
  "Scan to download": "Zeskanuj, aby pobrać",
  "QR code for uploaded file": "Kod QR przesłanego pliku",
  "Download QR code": "Pobierz kod QR",
  "Retry QR code": "Ponów generowanie kodu QR",
  "Generating QR code…": "Generowanie kodu QR…",
  "Dismiss advanced options": "Zamknij opcje zaawansowane",
  "Close advanced options": "Zamknij opcje zaawansowane",
  "Save history": "Zapisuj historię",
  "Expires after": "Wygasa po",
  hour: "godzina",
  hours: "godzin",
  "Download limit": "Limit pobrań",
  Unlimited: "Bez limitu",
  download: "pobranie",
  downloads: "pobrań",
  "Key protect": "Ochrona kluczem",
  "Text encoding": "Kodowanie tekstu",
  Done: "Gotowe",
  "AES-256-GCM in your browser, up to 32 MiB. Keep the complete link: history cannot recover keys.":
    "AES-256-GCM w przeglądarce, do 32 MiB. Zachowaj pełny link: historia nie pozwala odzyskać kluczy.",
  "Your uploads": "Twoje pliki",
  "Recent uploads": "Ostatnio przesłane",
  "Remove browser records only, not server files":
    "Usuń tylko zapis w przeglądarce, nie pliki na serwerze",
  "Clear history": "Wyczyść historię",
  "Key not saved": "Klucz niezapisany",
  "Keep the complete link: history cannot recover the key":
    "Zachowaj pełny link: historia nie pozwala odzyskać klucza",
  Download: "Pobierz",
  Remove: "Usuń z historii",
  "Delete file": "Usuń plik",
  "Deleting…": "Usuwanie…",
  "Link copied.": "Link skopiowany.",
  "You are offline. Reconnect before uploading.":
    "Brak połączenia. Połącz się z siecią przed przesłaniem pliku.",
  "Upload failed. Try again.":
    "Przesyłanie nie powiodło się. Spróbuj ponownie.",
  "Paste one file at a time.": "Wklejaj po jednym pliku.",
  "Drop exactly one file. Folders and multiple files are not supported.":
    "Upuść dokładnie jeden plik. Foldery i wiele plików nie są obsługiwane.",
  "Enter or paste text before uploading.":
    "Wpisz lub wklej tekst przed przesłaniem.",
  "QR code could not be generated. Try again.":
    "Nie udało się wygenerować kodu QR. Spróbuj ponownie.",
  "Upload limit could not be loaded; the server will still validate your file.":
    "Nie udało się wczytać limitu przesyłania; serwer nadal sprawdzi plik.",
  "Your Save history preference could not be saved or restored. Allow browser storage for this site to remember it; the switch still works for this page.":
    "Nie udało się zapisać lub odczytać ustawienia historii. Zezwól tej witrynie na zapis w przeglądarce, aby je zapamiętać; przełącznik nadal działa na tej stronie.",
  "History cleared in this browser. Server files are unchanged.":
    "Historia w tej przeglądarce została wyczyszczona. Pliki na serwerze pozostają bez zmian.",
  "Visible history cleared, but browser storage could not be cleared. Clear site data before leaving a shared device.":
    "Widoczna historia została wyczyszczona, lecz nie udało się usunąć zapisu w przeglądarce. Wyczyść dane witryny przed opuszczeniem współdzielonego urządzenia.",
} as const;
export type MessageKey = keyof typeof polish;
export type MessageValues = Readonly<Record<string, string | number>>;
export function translate(
  locale: Locale,
  key: MessageKey,
  values: MessageValues = {},
): string {
  const message: string = locale === "pl" ? polish[key] : key;
  return message.replace(/\{([a-zA-Z][\w]*)\}/g, (placeholder, name: string) =>
    String(values[name] ?? placeholder),
  );
}
/** Presentation boundary only: preserve unknown remote messages, never rewrite codes/data. */
export function translateMessage(locale: Locale, message: string): string {
  if (Object.hasOwn(polish, message))
    return translate(locale, message as MessageKey);
  const download =
    /^Download failed \((\d+)\)\. Check your connection and try again; a retry may use another download\.$/.exec(
      message,
    );
  if (download)
    return translate(
      locale,
      "Download failed ({status}). Check your connection and try again; a retry may use another download.",
      { status: download[1] },
    );
  return message;
}
