import type { Locale } from "./locale";

/** English source messages are stable keys, not API machine codes.
 * Add entries while localizing each surface; never translate arbitrary API text.
 */
export const polish = {
  "Unexpected error": "Nieoczekiwany błąd",
  "Try the request again. No error details are exposed here.":
    "Spróbuj ponownie. Szczegóły błędu nie są tutaj ujawniane.",
  Loading: "Wczytywanie",
  "Please wait": "Proszę czekać",
  "The requested content is loading.": "Trwa wczytywanie żądanej zawartości.",
  "Manage upload request": "Zarządzaj prośbą o plik",
  "Manage upload request.": "Zarządzaj prośbą o plik.",
  "Check its status or revoke it before a file is uploaded.":
    "Sprawdź stan prośby lub unieważnij ją przed przesłaniem pliku.",
  "Page not found": "Nie znaleziono strony",
  "The requested page or file is unavailable.":
    "Żądana strona lub plik są niedostępne.",
  "Return home": "Wróć na stronę główną",
  Download: "Pobierz",
  "Your uploads": "Twoje pliki",
  "Recent uploads": "Ostatnio przesłane",
  "Remove browser records only, not server files":
    "Usuń tylko zapisy w przeglądarce, nie pliki na serwerze",
  "Clear history": "Wyczyść historię",
  "History cleared in this browser. Server files are unchanged.":
    "Wyczyszczono historię w tej przeglądarce. Pliki na serwerze nie zostały zmienione.",
  "Visible history cleared, but browser storage could not be cleared. Clear site data before leaving a shared device.":
    "Wyczyszczono widoczną historię, ale nie udało się wyczyścić pamięci przeglądarki. Wyczyść dane witryny przed opuszczeniem współdzielonego urządzenia.",
  "Deleted on server. Saved links no longer work.":
    "Usunięto z serwera. Zapisane linki już nie działają.",
  "Already unavailable on server. Saved links no longer work.":
    "Plik jest już niedostępny na serwerze. Zapisane linki już nie działają.",
  "Original expiry": "Pierwotny termin wygaśnięcia",
  "Key not saved": "Klucz nie został zapisany",
  "Keep the complete link: history cannot recover the key":
    "Zachowaj pełny link: historia nie pozwala odzyskać klucza",
  "More actions for {name}": "Więcej działań dla {name}",
  "Remove {name} from history": "Usuń {name} z historii",
  "Remove from history": "Usuń z historii",
  "Delete server file {name}": "Usuń plik {name} z serwera",
  "Delete server file": "Usuń plik z serwera",
  "Permanently delete {name} from the server. All shared download links for this file will stop working. This cannot be undone. Remove from history only forgets the record in this browser.":
    "Trwale usunąć {name} z serwera? Wszystkie linki do pobierania tego pliku przestaną działać. Tej operacji nie można cofnąć. Usunięcie z historii usuwa tylko zapis w tej przeglądarce.",
  "{name} could not be deleted. Try again.":
    "Nie udało się usunąć {name}. Spróbuj ponownie.",
  "{name} was already unavailable.": "{name} był już niedostępny.",
  "{name} was deleted.": "Plik {name} został usunięty.",
  "{name} was removed from this browser.":
    "{name} usunięto z tej przeglądarki.",
  "Status could not be saved in this browser. Remove the local record before reloading.":
    "Nie udało się zapisać stanu w tej przeglądarce. Usuń lokalny zapis przed ponownym wczytaniem strony.",
  "File management": "Zarządzanie plikiem",
  "Delete file": "Usuń plik",
  "Delete {name}?": "Usunąć {name}?",
  "Permanently delete file": "Usuń plik na stałe",
  "Permanently delete this file from the server? Existing sharing links will stop working. This cannot be undone.":
    "Trwale usunąć ten plik z serwera? Istniejące linki do udostępniania przestaną działać. Tej operacji nie można cofnąć.",
  "Deletion was not confirmed. Your file link is retained; please retry.":
    "Nie potwierdzono usunięcia. Link do pliku został zachowany; spróbuj ponownie.",
  Deleted: "Usunięto",
  "File deleted": "Plik usunięty",
  "File unavailable": "Plik niedostępny",
  "The file was deleted from the server. Existing sharing links no longer work. This cannot be undone.":
    "Plik został usunięty z serwera. Istniejące linki do udostępniania już nie działają. Tej operacji nie można cofnąć.",
  "The server confirmed this file is already unavailable. Existing sharing links no longer work.":
    "Serwer potwierdził, że ten plik jest już niedostępny. Istniejące linki do udostępniania już nie działają.",
  "Saved links no longer work. Server deletion cannot be undone.":
    "Zapisane linki już nie działają. Usunięcia z serwera nie można cofnąć.",
  "Share URL": "Link do udostępnienia",
  "Double-click to copy": "Kliknij dwukrotnie, aby skopiować",
  "Copy URL": "Kopiuj URL",
  "Only the full link unlocks the file. Keep it safe: keys are not saved in this app’s upload history and cannot be recovered.":
    "Tylko pełny link odblokowuje plik. Zachowaj go w bezpiecznym miejscu: klucze nie są zapisywane w historii przesyłania tej aplikacji i nie można ich odzyskać.",
  "Anyone with the link can download.": "Każdy, kto ma link, może pobrać plik.",
  "Uploaded file actions": "Działania na przesłanym pliku",
  "Show QR code": "Pokaż kod QR",
  "Close QR code": "Zamknij kod QR",
  "Scan to download": "Zeskanuj, aby pobrać",
  "QR code for uploaded file": "Kod QR przesłanego pliku",
  "Download QR code": "Pobierz kod QR",
  "Retry QR code": "Ponów generowanie kodu QR",
  "Generating QR code…": "Generowanie kodu QR…",
  "QR code could not be generated. Try again.":
    "Nie udało się wygenerować kodu QR. Spróbuj ponownie.",
  Share: "Udostępnij",
  "Shared file": "Udostępniony plik",
  "Download this file using the link.": "Pobierz ten plik za pomocą linku.",
  "Sharing did not complete. Use Copy link instead.":
    "Udostępnianie nie powiodło się. Zamiast tego skopiuj link.",
  Encrypting: "Szyfrowanie",
  Uploading: "Przesyłanie",
  "Encrypting in your browser": "Szyfrowanie w przeglądarce",
  "Preparing protected file…": "Przygotowywanie chronionego pliku…",
  "Encrypting; network upload has not started":
    "Szyfrowanie; przesyłanie przez sieć jeszcze się nie rozpoczęło",
  "Network error. Check your connection and try again.":
    "Błąd sieci. Sprawdź połączenie i spróbuj ponownie.",
  "Upload completed, but the server response was invalid.":
    "Przesyłanie zakończono, ale odpowiedź serwera była nieprawidłowa.",
  "Upload exceeds the maximum upload size.":
    "Plik przekracza maksymalny rozmiar przesyłania.",
  "Upload would exceed the total stored data limit.":
    "Przesłanie pliku przekroczyłoby łączny limit przechowywanych danych.",
  "Upload request body must not be empty.":
    "Przesyłany plik nie może być pusty.",
  "Key protection is unavailable in this browser.":
    "Ochrona kluczem jest niedostępna w tej przeglądarce.",
  "Key protection requires HTTPS (or localhost) and Web Crypto. Plain uploads remain available.":
    "Ochrona kluczem wymaga HTTPS (lub localhost) i Web Crypto. Zwykłe przesyłanie pozostaje dostępne.",
  "Key-protected files are limited to 32 MiB in this version.":
    "W tej wersji pliki chronione kluczem mogą mieć maksymalnie 32 MiB.",
  "Share temporary files and text.": "Udostępniaj tymczasowe pliki i tekst.",
  "Everything expires automatically.": "Wszystko wygasa automatycznie.",
  "Upload type": "Rodzaj przesyłania",
  File: "Plik",
  Text: "Tekst",
  "Request a file ↗": "Poproś o plik ↗",
  "Drop file to upload": "Upuść plik, aby go przesłać",
  "Upload a file": "Prześlij plik",
  "Try again": "Spróbuj ponownie",
  "or drop one file here": "lub upuść tutaj jeden plik",
  "Or upload text": "Lub prześlij tekst",
  "Paste or type text": "Wklej lub wpisz tekst",
  "Upload text": "Prześlij tekst",
  "Checking limit…": "Sprawdzanie limitu…",
  "{size} max": "Maksymalnie {size}",
  "Temporary storage": "Tymczasowe przechowywanie",
  "You are offline. Reconnect before uploading.":
    "Jesteś offline. Połącz się z siecią przed przesłaniem.",
  "Upload limit could not be loaded; the server will still validate your file.":
    "Nie udało się wczytać limitu przesyłania; serwer nadal sprawdzi plik.",
  "“{name}” is {size}. Maximum size is {max}.":
    "Plik „{name}” ma rozmiar {size}. Maksymalny rozmiar to {max}.",
  "Paste one file at a time.": "Wklejaj po jednym pliku.",
  "Drop exactly one file. Folders and multiple files are not supported.":
    "Upuść dokładnie jeden plik. Foldery i wiele plików nie są obsługiwane.",
  "Enter or paste text before uploading.":
    "Wpisz lub wklej tekst przed przesłaniem.",
  "Advanced options": "Opcje zaawansowane",
  "Dismiss advanced options": "Odrzuć opcje zaawansowane",
  "Close advanced options": "Zamknij opcje zaawansowane",
  "Save history": "Zapisuj historię",
  "Expires after": "Wygasa po",
  "Download limit": "Limit pobrań",
  Unlimited: "Bez limitu",
  "{count} download": "{count} pobranie",
  "{count} downloads (few)": "{count} pobrania",
  "{count} downloads": "{count} pobrań",
  "Key protect": "Chroń kluczem",
  "AES-256-GCM in your browser, up to 32 MiB. Keep the complete link: history cannot recover keys.":
    "AES-256-GCM w Twojej przeglądarce, do 32 MiB. Zachowaj pełny link: historia nie pozwala odzyskać kluczy.",
  "Text encoding": "Kodowanie tekstu",
  Done: "Gotowe",
  "Your Save history preference could not be saved or restored. Allow browser storage for this site to remember it; the switch still works for this page.":
    "Nie udało się zapisać lub odczytać ustawienia zapisywania historii. Zezwól tej witrynie na przechowywanie danych w przeglądarce, aby je zapamiętać; przełącznik nadal działa na tej stronie.",
  "Download failed ({status}). Check your connection and try again; a retry may use another download.":
    "Pobieranie nie powiodło się ({status}). Sprawdź połączenie i spróbuj ponownie; ponowienie może zużyć kolejne pobranie.",
  "Private transfer": "Prywatne przesyłanie",
  "Decrypt your file": "Odszyfruj plik",
  "This file is protected with a secret key. Decryption happens only in your browser; the server never receives the key.":
    "Ten plik jest chroniony tajnym kluczem. Odszyfrowywanie odbywa się wyłącznie w Twojej przeglądarce; serwer nigdy nie otrzymuje klucza.",
  "Files up to 32 MiB are supported. Nothing is downloaded until you choose to decrypt. Fetching the encrypted file uses one download from its limit, even if the key is wrong.":
    "Obsługiwane są pliki do 32 MiB. Pobieranie rozpocznie się dopiero po wybraniu odszyfrowywania. Pobranie zaszyfrowanego pliku zużywa jedno pobranie z limitu, nawet jeśli klucz jest nieprawidłowy.",
  "Missing or invalid key. Ask the sender for the complete link, including #key=…, or enter the key below.":
    "Brak klucza lub klucz jest nieprawidłowy. Poproś nadawcę o pełny link, włącznie z #key=…, lub wpisz klucz poniżej.",
  "Decryption key": "Klucz odszyfrowywania",
  "Use the key after #key= in the sender’s link. Never send it to the server or put it in a URL query.":
    "Użyj klucza znajdującego się po #key= w linku nadawcy. Nigdy nie wysyłaj go do serwera ani nie umieszczaj w parametrach zapytania URL.",
  "Downloading and decrypting…": "Pobieranie i odszyfrowywanie…",
  "Decrypt file": "Odszyfruj plik",
  "Downloading encrypted file": "Pobieranie zaszyfrowanego pliku",
  "Authenticating and decrypting": "Uwierzytelnianie i odszyfrowywanie",
  "Cancelling decryption…": "Anulowanie odszyfrowywania…",
  "Cancel decryption": "Anuluj odszyfrowywanie",
  "Decrypted: {name} ({size}). Save the original file below.":
    "Odszyfrowano: {name} ({size}). Zapisz oryginalny plik poniżej.",
  "Save decrypted file": "Zapisz odszyfrowany plik",
  "Upload another file": "Prześlij kolejny plik",
  "Decryption requires HTTPS (or localhost) and Web Crypto. No file was fetched.":
    "Odszyfrowywanie wymaga HTTPS (lub localhost) i Web Crypto. Nie pobrano żadnego pliku.",
  "Download failed. Check your connection and ask the sender for a new link.":
    "Pobieranie nie powiodło się. Sprawdź połączenie i poproś nadawcę o nowy link.",
  "This file expired. Ask the sender to upload it again.":
    "Ten plik wygasł. Poproś nadawcę o ponowne przesłanie.",
  "Invalid protected link. Ask the sender for a new link.":
    "Nieprawidłowy link do chronionego pliku. Poproś nadawcę o nowy link.",
  "This file is unavailable: it may have expired, been deleted, or reached its download limit. Ask the sender to upload it again.":
    "Ten plik jest niedostępny: mógł wygasnąć, zostać usunięty lub osiągnąć limit pobrań. Poproś nadawcę o ponowne przesłanie.",
  "This protected file exceeds the 32 MiB browser memory limit.":
    "Ten chroniony plik przekracza limit pamięci przeglądarki wynoszący 32 MiB.",
  "The server returned no file. Ask the sender to upload it again.":
    "Serwer nie zwrócił pliku. Poproś nadawcę o ponowne przesłanie.",
  "Unsupported or damaged protected file. Ask the sender to upload it again.":
    "Nieobsługiwany lub uszkodzony chroniony plik. Poproś nadawcę o ponowne przesłanie.",
  "Unable to decrypt: the key is wrong or the file is damaged. Ask the sender for the complete link or a new upload.":
    "Nie można odszyfrować: klucz jest nieprawidłowy lub plik jest uszkodzony. Poproś nadawcę o pełny link lub ponowne przesłanie.",
  "Upload complete": "Przesyłanie ukończone",
  "The requester can now retrieve your file.":
    "Osoba prosząca o plik może go teraz pobrać.",
  Filename: "Nazwa pliku",
  Size: "Rozmiar",
  "File expires": "Plik wygasa",
  "This request link has been used and cannot accept another upload. Reloading it will show that the request is unavailable. Ask the requester for a new request link if you need to send another file.":
    "Ten link do prośby został wykorzystany i nie przyjmie kolejnego pliku. Po odświeżeniu zobaczysz, że prośba jest niedostępna. Poproś osobę proszącą o plik o nowy link, jeśli chcesz wysłać kolejny plik.",
  "Anyone with the file link can access it until it expires. It is separate from this single-use request link.":
    "Każdy, kto ma link do pliku, może go otworzyć do czasu wygaśnięcia. To inny link niż ten jednorazowy link do prośby.",
  Copied: "Skopiowano",
  "Copy link": "Kopiuj link",
  "Download file": "Pobierz plik",
  "Link copied.": "Link skopiowany.",
  "Could not copy automatically. Select and copy the file link manually.":
    "Nie udało się skopiować automatycznie. Zaznacz i skopiuj link do pliku ręcznie.",
  "File link for manual copying": "Link do pliku do ręcznego skopiowania",
  "The file link is unavailable. Ask the requester to retrieve the file from their request management page.":
    "Link do pliku jest niedostępny. Poproś osobę proszącą o plik, aby pobrała go ze strony zarządzania prośbą.",
  "Choose file": "Wybierz plik",
  "Choose a non-empty file.": "Wybierz niepusty plik.",
  "The file must be no larger than {size}.":
    "Plik nie może być większy niż {size}.",
  "Maximum {size}. This link is single-use.":
    "Maksymalnie {size}. Ten link jest jednorazowy.",
  "{name} — {bytes} bytes": "{name} — {bytes} bajtów",
  "Uploading…": "Przesyłanie…",
  "Finalizing…": "Finalizowanie…",
  "Upload progress": "Postęp przesyłania",
  "Cancel upload": "Anuluj przesyłanie",
  "Upload file": "Prześlij plik",
  "Check request status": "Sprawdź status prośby",
  "This request is no longer available for upload. Do not retry: check its status to see whether it is busy, used, revoked or expired.":
    "Ta prośba nie przyjmuje już plików. Nie ponawiaj przesyłania: sprawdź status, aby ustalić, czy trwa przesyłanie, link został wykorzystany, unieważniony czy wygasł.",
  "Upload failed. You can retry with the selected file.":
    "Przesyłanie nie powiodło się. Możesz spróbować ponownie z wybranym plikiem.",
  "Network error. You can retry with the selected file. If the server completed the upload, this single-use link may already be consumed.":
    "Błąd sieci. Możesz spróbować ponownie z wybranym plikiem. Jeśli serwer ukończył przesyłanie, ten jednorazowy link mógł już zostać wykorzystany.",
  "Upload cancelled locally. The server releases incomplete uploads after disconnect cleanup; retry shortly. If finalization already completed, this single-use link may be consumed.":
    "Przesyłanie anulowano lokalnie. Serwer zwalnia niedokończone przesyłanie po obsłużeniu rozłączenia; spróbuj ponownie za chwilę. Jeśli finalizacja już się zakończyła, ten jednorazowy link mógł zostać wykorzystany.",
  "← Home": "← Strona główna",
  "Upload a requested file": "Prześlij zamówiony plik",
  "Send a requested file": "Wyślij zamówiony plik",
  "Expires {expiry}": "Wygasa {expiry}",
  "Refresh request status": "Odśwież status prośby",
  "This upload request is invalid": "Ta prośba o plik jest nieprawidłowa",
  "Check the link with the person who sent it, or ask them for a new request.":
    "Sprawdź link z osobą, która go wysłała, lub poproś ją o nową prośbę.",
  "An upload is already in progress": "Przesyłanie już trwa",
  "Wait for the current upload to finish, then refresh this page. Do not start another upload while it is busy.":
    "Poczekaj na zakończenie bieżącego przesyłania, a następnie odśwież stronę. Nie rozpoczynaj kolejnego przesyłania, gdy prośba jest zajęta.",
  "This upload request has already been used":
    "Ta prośba o plik została już wykorzystana",
  "This single-use link cannot accept another file. Ask the sender for a new request if you need to send another file.":
    "Ten jednorazowy link nie przyjmie kolejnego pliku. Poproś nadawcę o nową prośbę, jeśli chcesz wysłać kolejny plik.",
  "This upload request was revoked": "Ta prośba o plik została unieważniona",
  "The sender cancelled this request. Ask them for a new request to upload a file.":
    "Nadawca anulował tę prośbę. Poproś go o nową prośbę, aby przesłać plik.",
  "This upload request has expired": "Ta prośba o plik wygasła",
  "This link no longer accepts files. Ask the sender for a new request.":
    "Ten link nie przyjmuje już plików. Poproś nadawcę o nową prośbę.",
  "The previous upload did not complete. You can choose a file and try again before this request expires.":
    "Poprzednie przesyłanie nie zostało ukończone. Możesz wybrać plik i spróbować ponownie, zanim prośba wygaśnie.",
  "Upload request created": "Utworzono prośbę o plik",
  "Send this upload link:": "Wyślij ten link do przesyłania:",
  "Upload link copied": "Skopiowano link do przesyłania",
  "Copy upload link": "Kopiuj link do przesyłania",
  "Save this private owner link:": "Zapisz ten prywatny link właściciela:",
  "Owner link copied": "Skopiowano link właściciela",
  "Copy owner link": "Kopiuj link właściciela",
  "This link can inspect or revoke the request and cannot be recovered by the server.":
    "Ten link pozwala sprawdzić lub unieważnić prośbę. Serwer nie może go odzyskać.",
  "Limit: {size} · Expires {expiry}": "Limit: {size} · Wygaśnięcie: {expiry}",
  "Status:": "Status:",
  active: "aktywna",
  retry: "ponowna próba",
  "in progress": "przesyłanie w toku",
  consumed: "wykorzystana",
  expired: "wygasła",
  revoked: "unieważniona",
  "Revoke request": "Unieważnij prośbę",
  "Revoke upload request?": "Unieważnić prośbę o plik?",
  "Revoke the upload request expiring {date} ({size} limit)? Its shared upload link will stop working. This cannot be undone; create a new request instead.":
    "Unieważnić prośbę wygasającą {date} (limit: {size})? Udostępniony link do przesyłania przestanie działać. Nie można tego cofnąć; zamiast tego utwórz nową prośbę.",
  "Confirm revoke request": "Potwierdź unieważnienie prośby",
  "Create another": "Utwórz kolejną",
  "Create a new request": "Utwórz nową prośbę",
  "Waiting for upload.": "Oczekiwanie na plik.",
  "Waiting for upload. The previous attempt failed; the recipient can try the same upload link again.":
    "Oczekiwanie na plik. Poprzednia próba nie powiodła się; odbiorca może ponownie użyć tego samego linku.",
  "Upload in progress. The file is not available yet.":
    "Trwa przesyłanie. Plik nie jest jeszcze dostępny.",
  "Upload received. The recipient link has been used and cannot accept another file.":
    "Plik odebrany. Link odbiorcy został wykorzystany i nie przyjmie kolejnego pliku.",
  "This request was revoked. Its upload link can no longer be used. Create a new request to receive a file.":
    "Prośba została unieważniona. Link do przesyłania już nie działa. Utwórz nową prośbę, aby odebrać plik.",
  "This request expired without receiving a file. Create a new request to receive a file.":
    "Prośba wygasła bez odebrania pliku. Utwórz nową prośbę, aby odebrać plik.",
  "Uploaded file:": "Przesłany plik:",
  "Open file": "Otwórz plik",
  "Connecting for live updates…": "Łączenie z aktualizacjami na żywo…",
  "Live updates connected.": "Połączono z aktualizacjami na żywo.",
  "Live updates disconnected. Reconnecting…":
    "Utracono aktualizacje na żywo. Ponowne łączenie…",
  "Live updates finished.": "Aktualizacje na żywo zakończone.",
  "Live updates unavailable. Refresh to check status.":
    "Aktualizacje na żywo są niedostępne. Odśwież stronę, aby sprawdzić status.",
  "The operation failed. Please retry.":
    "Operacja nie powiodła się. Spróbuj ponownie.",
  "Working… This operation cannot be undone.":
    "Przetwarzanie… Tej operacji nie można cofnąć.",
  Cancel: "Anuluj",
  "Could not copy automatically. Select and copy the complete link below.":
    "Nie udało się skopiować automatycznie. Zaznacz i skopiuj cały poniższy link.",
  "Link to copy": "Link do skopiowania",
  "← Back to uploads": "← Wróć do przesyłania",
  "Request a file.": "Poproś o plik.",
  "Create a private, single-use link for someone else to upload one file.":
    "Utwórz prywatny, jednorazowy link, aby ktoś inny mógł przesłać jeden plik.",
  "Deployment limits: {size} per file; up to {hours} hours. Current server limits are checked before creating a request.":
    "Limity wdrożenia: {size} na plik; maksymalnie {hours} godz. Aktualne limity serwera są sprawdzane przed utworzeniem prośby.",
  "Request expires": "Prośba wygasa",
  "Maximum upload size": "Maksymalny rozmiar pliku",
  "Loading server limits…": "Wczytywanie limitów serwera…",
  "Could not load server limits. Please retry.":
    "Nie udało się wczytać limitów serwera. Spróbuj ponownie.",
  "Retry loading limits": "Wczytaj limity ponownie",
  "1 hour": "1 godzina",
  "1 day": "1 dzień",
  "7 days": "7 dni",
  "Maximum ({duration})": "Maksimum ({duration})",
  "Custom date and time": "Własna data i godzina",
  "Custom expiration date and time": "Własna data i godzina wygaśnięcia",
  "Custom size": "Własny rozmiar",
  "Size amount": "Rozmiar",
  "Size unit": "Jednostka rozmiaru",
  "Server maximum: {size}": "Maksimum serwera: {size}",
  "The link accepts one successful upload.":
    "Link umożliwia jedno pomyślne przesłanie pliku.",
  "Creating…": "Tworzenie…",
  "Create upload request": "Utwórz prośbę o plik",
  "Expiration must be in the future and within {duration}.":
    "Termin wygaśnięcia musi być w przyszłości, nie później niż za {duration}.",
  "Size must be between 1 byte and {size}.":
    "Rozmiar musi wynosić od 1 bajta do {size}.",
  "Enter a positive size without exponents.":
    "Podaj dodatni rozmiar bez zapisu wykładniczego.",
  "Size must convert to a whole number of bytes.":
    "Rozmiar musi odpowiadać całkowitej liczbie bajtów.",
  "Request failed.": "Żądanie nie powiodło się.",
  "Could not revoke the request.": "Nie udało się unieważnić prośby.",
  "Loading request status…": "Wczytywanie statusu prośby…",
  "Owner link unavailable": "Link właściciela niedostępny",
  "This upload request is unavailable.": "Ta prośba o plik jest niedostępna.",
  "Open the private owner link created with your upload request.":
    "Otwórz prywatny link właściciela utworzony wraz z prośbą o plik.",
  "Request status": "Status prośby",
  "This private owner link is a bearer capability. Anyone with it can view this status or revoke an active request.":
    "Ten prywatny link właściciela zapewnia dostęp do prośby. Każdy, kto go posiada, może sprawdzić jej status lub unieważnić aktywną prośbę.",
  "Upload limit": "Limit przesyłania",
  Expires: "Wygasa",
  "Refresh status": "Odśwież status",
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
