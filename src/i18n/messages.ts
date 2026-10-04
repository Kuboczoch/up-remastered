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

  "Temporary file": "Plik tymczasowy",
  "Anyone with this link can download the file.":
    "Każdy, kto ma ten link, może pobrać plik.",
  "Sharing failed. Use Copy link instead.":
    "Udostępnianie nie powiodło się. Użyj opcji Kopiuj link.",

  "File deleted": "Plik usunięty",
  "Existing sharing links no longer work.":
    "Dotychczasowe linki udostępniania już nie działają.",

  "· Expires": "· Wygasa",

  "Only the full link unlocks the file. Keep it safe: keys are not saved in this app’s upload history and cannot be recovered. Protected links cannot use native Share; use Copy URL for the complete link.":
    "Tylko pełny link odblokowuje plik. Zachowaj go: klucze nie są zapisywane w historii przesyłania i nie można ich odzyskać. Chronionych linków nie można udostępniać systemowo; użyj opcji Kopiuj adres, aby zachować pełny link.",
  Share: "Udostępnij",

  "Key protection requires HTTPS (or localhost) and Web Crypto. It is unavailable here; no plaintext fallback.":
    "Ochrona kluczem wymaga HTTPS (lub localhost) i Web Crypto. Tutaj jest niedostępna; plik nie zostanie przesłany bez szyfrowania.",

  "Key not saved. Use your saved full-link copy; protected links cannot use native Share.":
    "Klucz nie został zapisany. Użyj zachowanej kopii pełnego linku; chronionych linków nie można udostępniać systemowo.",
  "Automatic copy is unavailable. Copy the complete link manually below.":
    "Automatyczne kopiowanie jest niedostępne. Skopiuj pełny link ręcznie poniżej.",

  "Remove from history": "Usuń z historii",
  "Delete this server file permanently? Existing sharing links will stop working. Removing browser history alone does not delete server files.":
    "Trwale usunąć ten plik z serwera? Dotychczasowe linki przestaną działać. Samo usunięcie historii przeglądarki nie usuwa plików z serwera.",
  "Automatic copy is unavailable. Select the complete link below and copy it manually.":
    "Automatyczne kopiowanie jest niedostępne. Zaznacz pełny link poniżej i skopiuj go ręcznie.",
  "Complete link for manual copying": "Pełny link do ręcznego skopiowania",
  "Please wait…": "Proszę czekać…",
  "1 hour": "1 godzina",
  "1 day": "1 dzień",
  "7 days": "7 dni",
  "Configuration unavailable.": "Konfiguracja niedostępna.",
  "Invalid server limits.": "Nieprawidłowe limity serwera.",
  "Request failed.": "Nie udało się utworzyć prośby. Spróbuj ponownie.",
  "Upload request created": "Prośba o plik utworzona",
  "Send this upload link:": "Wyślij ten link do przesyłania:",
  "Copy upload link": "Kopiuj link do przesyłania",
  "Save this private owner link:": "Zachowaj ten prywatny link właściciela:",
  "Copy owner link": "Kopiuj link właściciela",
  "This link can inspect or revoke the request and cannot be recovered by the server.":
    "Ten link pozwala sprawdzić lub unieważnić prośbę. Serwer nie może go odzyskać.",
  "Create another": "Utwórz kolejną",
  "Could not load server limits. Please retry.":
    "Nie udało się wczytać limitów serwera. Spróbuj ponownie.",
  "Loading server limits…": "Ładowanie limitów serwera…",
  "Retry loading limits": "Ponów wczytywanie limitów",
  "Request expires": "Prośba wygasa",
  "Custom date and time": "Własna data i godzina",
  "Custom expiration date and time": "Własna data i godzina wygaśnięcia",
  "Maximum upload size": "Maksymalny rozmiar pliku",
  "Server maximum: ": "Maksimum serwera: ",
  "Server maximum:": "Maksimum serwera:",
  "Custom size": "Własny rozmiar",
  "Size amount": "Rozmiar",
  "Size unit": "Jednostka rozmiaru",
  "The link accepts one successful upload.":
    "Link pozwala na jedno udane przesłanie pliku.",
  "Creating…": "Tworzenie…",
  "Create upload request": "Utwórz prośbę o plik",
  "This upload request is unavailable.": "Ta prośba o plik jest niedostępna.",
  "Open the private owner link created with your upload request.":
    "Otwórz prywatny link właściciela utworzony wraz z prośbą o plik.",
  "Loading request status…": "Ładowanie stanu prośby…",
  "Owner link unavailable": "Link właściciela niedostępny",
  "Create a new request": "Utwórz nową prośbę",
  "Request status": "Stan prośby",
  "This private owner link is a bearer capability. Anyone with it can view this status or revoke an active request.":
    "Ten prywatny link właściciela daje dostęp każdemu, kto go posiada. Każda taka osoba może sprawdzić stan lub unieważnić aktywną prośbę.",
  "Refresh status": "Odśwież stan",
  "Choose a non-empty file.": "Wybierz niepusty plik.",
  "Upload failed. You can retry with the selected file.":
    "Przesyłanie nie powiodło się. Możesz spróbować ponownie z wybranym plikiem.",
  "Network error. Check your connection and retry with the selected file. If delivery may have completed, reload this request to check its status.":
    "Błąd sieci. Sprawdź połączenie i spróbuj ponownie z wybranym plikiem. Jeśli plik mógł zostać dostarczony, odśwież tę prośbę, aby sprawdzić jej stan.",
  "Cancelled. The selected file is kept. You can retry once the server releases this request; reload to check if delivery already completed.":
    "Anulowano. Wybrany plik pozostaje zachowany. Możesz spróbować ponownie, gdy serwer zwolni tę prośbę; odśwież stronę, aby sprawdzić, czy plik został już dostarczony.",
  "Could not start upload. Please retry with the selected file.":
    "Nie udało się rozpocząć przesyłania. Spróbuj ponownie z wybranym plikiem.",
  "Your file has been delivered. The requester can now retrieve it.":
    "Twój plik został dostarczony. Osoba prosząca może go teraz pobrać.",
  "File expires": "Plik wygasa",
  "Advanced / API": "Zaawansowane / API",
  "This upload access token is only needed for API operations on the delivered file. Keep it private.":
    "Ten token dostępu jest potrzebny tylko do operacji API na dostarczonym pliku. Zachowaj go w tajemnicy.",
  "No owner management token is shared with the uploader.":
    "Token zarządzania właściciela nie jest udostępniany osobie przesyłającej.",
  Maximum: "Maksymalnie",
  ". This link accepts one successful upload.":
    ". Ten link pozwala na jedno udane przesłanie pliku.",
  "Finalizing delivery…": "Kończenie dostarczania…",
  "Uploading…": "Przesyłanie…",
  "Upload file": "Prześlij plik",
  "Cancel upload": "Anuluj przesyłanie",
  "The previous upload did not complete. You can try again with this request.":
    "Poprzednie przesyłanie nie zostało ukończone. Możesz spróbować ponownie z tą prośbą.",
  "This request has expired. Ask the requester for a new request link.":
    "Ta prośba wygasła. Poproś o nowy link do prośby.",
  "This request was revoked. Ask the requester for a new request link.":
    "Ta prośba została unieważniona. Poproś o nowy link do prośby.",
  "A file was already delivered using this request. Ask the requester for a new request link to send another file.":
    "Plik został już dostarczony w ramach tej prośby. Aby przesłać kolejny, poproś o nowy link do prośby.",
  "Another upload is in progress. Wait and refresh to check whether this request becomes available again.":
    "Trwa inne przesyłanie. Poczekaj i odśwież stronę, aby sprawdzić, czy prośba jest ponownie dostępna.",
  "This request link is invalid. Check the complete link or ask the requester for a new request link.":
    "Ten link do prośby jest nieprawidłowy. Sprawdź pełny link lub poproś o nowy.",
  "Refresh request": "Odśwież prośbę",
  "Waiting for upload.": "Oczekiwanie na plik.",
  "An upload is in progress. Your file will be available after delivery completes.":
    "Trwa przesyłanie. Twój plik będzie dostępny po ukończeniu dostarczania.",
  "File delivered. You can now open or download it.":
    "Plik dostarczony. Możesz go teraz otworzyć lub pobrać.",
  "This request has expired. Create a new request to receive a file.":
    "Ta prośba wygasła. Utwórz nową prośbę, aby otrzymać plik.",
  "The previous upload did not complete. Waiting for another attempt.":
    "Poprzednie przesyłanie nie zostało ukończone. Oczekiwanie na kolejną próbę.",
  "This request has been revoked. Create a new request to receive a file.":
    "Ta prośba została unieważniona. Utwórz nową prośbę, aby otrzymać plik.",
  "Could not revoke the request. Please try again.":
    "Nie udało się unieważnić prośby. Spróbuj ponownie.",
  "Limit:": "Limit:",
  "· Request expires": "· Prośba wygasa",
  "Reserved download link:": "Zarezerwowany link do pobierania:",
  "· Not available until delivery completes.":
    "· Niedostępny do ukończenia dostarczania.",
  "Revoke request": "Unieważnij prośbę",
  "Revoke this request?": "Unieważnić tę prośbę?",
  "This permanently stops this link from accepting a file. Any upload in progress will not be delivered. You will need a new request to receive a file.":
    "Ten link trwale przestanie przyjmować pliki. Trwające przesyłanie nie zostanie dostarczone. Aby otrzymać plik, potrzebna będzie nowa prośba.",
  "Keep request": "Zachowaj prośbę",
  "Revoking…": "Unieważnianie…",
  "Confirm revoke": "Potwierdź unieważnienie",
  "Copy download link": "Kopiuj link do pobierania",
  "Connecting for live updates…": "Łączenie z aktualizacjami na żywo…",
  "Live updates connected.": "Połączono z aktualizacjami na żywo.",
  "Live updates disconnected. Reconnecting…":
    "Rozłączono aktualizacje na żywo. Ponowne łączenie…",
  "Live updates finished.": "Aktualizacje na żywo zakończone.",
  "Live updates unavailable. Refresh to check status.":
    "Aktualizacje na żywo niedostępne. Odśwież stronę, aby sprawdzić stan.",
  "Network error. Check your connection and try again.":
    "Błąd sieci. Sprawdź połączenie i spróbuj ponownie.",
  "Upload completed, but the server response was invalid.":
    "Przesyłanie zakończone, ale odpowiedź serwera była nieprawidłowa.",
  "Upload cancelled.": "Przesyłanie anulowane.",
  "Your browser could not protect this file. Try again or turn off Key protect.":
    "Przeglądarka nie mogła zabezpieczyć pliku. Spróbuj ponownie lub wyłącz ochronę kluczem.",
  "File too large": "Plik jest za duży",
  "No storage available": "Brak miejsca na plik",
  "{count} hours": "{count} godzin",
  "{count} days": "{count} dni",
  "{count} minutes": "{count} minut",
  "{count} downloads": "{count} pobrań",
  "{count} downloads (few)": "{count} pobrania",

  "{count} download": "{count} pobranie",
  "Maximum ({duration})": "Maksymalnie ({duration})",
  "Expiration must be in the future and within {duration}.":
    "Data wygaśnięcia musi być w przyszłości, w ciągu {duration}.",
  "Size must be between 1 byte and {size}.":
    "Rozmiar musi wynosić od 1 bajta do {size}.",
  "The file must be no larger than {size}.":
    "Plik nie może być większy niż {size}.",
  "“{name}” is {size}. Maximum size is {maximum}.":
    "„{name}” ma {size}. Maksymalny rozmiar to {maximum}.",
  "{name} was already unavailable and has been forgotten.":
    "Plik {name} był już niedostępny i został usunięty z historii.",
  "{name} was deleted.": "Plik {name} został usunięty.",
  "{name} could not be deleted. Try again.":
    "Nie udało się usunąć pliku {name}. Spróbuj ponownie.",
  "{name} was removed from this browser.":
    "Plik {name} został usunięty z historii tej przeglądarki.",
  "Share {name}": "Udostępnij {name}",
  "More actions for {name}": "Więcej działań dla {name}",
  "Remove {name} from history": "Usuń {name} z historii",
  "Delete {name}": "Usuń {name}",
  "Uploading… {progress}%": "Przesyłanie… {progress}%",
  "UTF-16 little-endian": "UTF-16, kolejność little-endian",
  "UTF-16 big-endian": "UTF-16, kolejność big-endian",
  "The file is too large. Choose a smaller file.":
    "Plik jest za duży. Wybierz mniejszy plik.",
  "Storage is full. Try again later.":
    "Brak miejsca na serwerze. Spróbuj ponownie później.",
  "This request is no longer available. Refresh to check its status.":
    "Ta prośba nie jest już dostępna. Odśwież stronę, aby sprawdzić jej stan.",
  "Please check the selected file and upload options.":
    "Sprawdź wybrany plik i opcje przesyłania.",
  "This file expired. Ask the sender to upload it again.":
    "Ten plik wygasł. Poproś nadawcę o ponowne przesłanie.",
} as const;
export type MessageKey = keyof typeof polish;
// English source strings are the canonical keys; build the complete English
// dictionary from that same registry so en/pl can never diverge in coverage.
export const english = Object.fromEntries(
  Object.keys(polish).map((key) => [key, key]),
) as Record<MessageKey, string>;
export const dictionaries = { en: english, pl: polish } satisfies Record<
  Locale,
  Readonly<Record<MessageKey, string>>
>;
export type MessageValues = Readonly<Record<string, string | number>>;
/** Whitelist machine codes; never render a remote message or stringify its body. */
export function apiErrorKey(
  body: unknown,
  fallback: MessageKey = "Upload failed. Try again.",
): MessageKey {
  const code =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "code" in body.error
      ? body.error.code
      : undefined;
  switch (code) {
    case "upload_too_large":
      return "The file is too large. Choose a smaller file.";
    case "total_storage_limit_exceeded":
      return "Storage is full. Try again later.";
    case "upload_request_unavailable":
      return "This request is no longer available. Refresh to check its status.";
    case "invalid_multipart":
    case "missing_upload":
    case "invalid_expiration":
    case "expiration_too_large":
    case "invalid_max_downloads":
    case "invalid_encrypted_upload":
      return "Please check the selected file and upload options.";
    default:
      return fallback;
  }
}
export function translate(
  locale: Locale,
  key: MessageKey,
  values: MessageValues = {},
): string {
  const message: string = dictionaries[locale][key];
  return message.replace(/\{([a-zA-Z][\w]*)\}/g, (placeholder, name: string) =>
    String(values[name] ?? placeholder),
  );
}
/** Only known application errors may be displayed. Unknown text is never disclosed. */
export function translateMessage(
  locale: Locale,
  message: string,
  fallback: MessageKey = "Something went wrong",
): string {
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
  return translate(locale, fallback);
}
