import { afterEach, expect, it, jest } from "@jest/globals";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { webcrypto } from "node:crypto";
import { LocaleProvider } from "@/lib/i18n/provider";
import { DecryptExperience } from "./decrypt-experience";

const originalFetch = global.fetch;
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  window.history.replaceState(null, "", "/");
});
function mount(key = "") {
  window.history.replaceState(
    null,
    "",
    `/decrypt/A7K2Q${key ? `#key=${key}` : ""}`,
  );
  render(
    <LocaleProvider locale="pl">
      <DecryptExperience id="A7K2Q" />
    </LocaleProvider>,
  );
}
it("renders Polish consent, accessible key input and missing-key guidance without fetching", () => {
  const fetch = jest.fn<typeof global.fetch>();
  global.fetch = fetch;
  mount();
  expect(screen.getByRole("heading", { name: "Odszyfruj plik" })).toBeTruthy();
  expect(screen.getByLabelText("Klucz odszyfrowywania")).toBeTruthy();
  expect(
    screen.getByText(/Brak klucza lub klucz jest nieprawidłowy/),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "Odszyfruj plik" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});
it.each([
  [
    "Download failed (503). Check your connection and try again; a retry may use another download.",
    "Pobieranie nie powiodło się (503). Sprawdź połączenie i spróbuj ponownie; ponowienie może zużyć kolejne pobranie.",
  ],
  [
    "This file expired. Ask the sender to upload it again.",
    "Ten plik wygasł. Poproś nadawcę o ponowne przesłanie.",
  ],
  [
    "This protected file exceeds the 32 MiB browser memory limit.",
    "Ten chroniony plik przekracza limit pamięci przeglądarki wynoszący 32 MiB.",
  ],
  [
    "Unable to decrypt: the key is wrong or the file is damaged. Ask the sender for the complete link or a new upload.",
    "Nie można odszyfrować: klucz jest nieprawidłowy lub plik jest uszkodzony. Poproś nadawcę o pełny link lub ponowne przesłanie.",
  ],
  [
    "remote secret #key=DO_NOT_RENDER",
    "Pobieranie nie powiodło się. Sprawdź połączenie i poproś nadawcę o nowy link.",
  ],
])(
  "localizes safe failure %s without rendering arbitrary exception details",
  async (failure, expected) => {
    global.fetch = jest
      .fn<typeof global.fetch>()
      .mockRejectedValue(new Error(failure));
    mount("A".repeat(43));
    fireEvent.click(screen.getByRole("button", { name: "Odszyfruj plik" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(expected),
    );
    expect(document.body.textContent).not.toContain("DO_NOT_RENDER");
  },
);
