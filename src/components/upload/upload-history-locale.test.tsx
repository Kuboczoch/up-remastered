import { afterEach, expect, it, jest } from "@jest/globals";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { LocaleProvider } from "@/lib/i18n/provider";
import { UploadExperience } from "./upload-experience";
import { UPLOAD_HISTORY_STORAGE_KEY } from "./upload-history";

const originalFetch = global.fetch;
afterEach(() => {
  cleanup();
  localStorage.clear();
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});
function setup() {
  const entry = {
    id: "AAAAA",
    accessToken: "owner-secret",
    originalName: "żółć.txt",
    shareUrl: "http://localhost/AAAAA",
    size: 1536,
    expiresAt: "2099-01-01T12:00:00.000Z",
    savedAt: "2026-01-01T12:00:00.000Z",
  };
  localStorage.setItem("up-remastered:history-enabled", "true");
  localStorage.setItem(UPLOAD_HISTORY_STORAGE_KEY, JSON.stringify([entry]));
  global.fetch = jest.fn<typeof fetch>(() => new Promise(() => {}));
  const view = render(
    <LocaleProvider locale="pl">
      <UploadExperience initialMaxBytes={4096} />
    </LocaleProvider>,
  );
  return { view, entry };
}
it("localizes history labels, formatting and local-only removal", () => {
  const { view } = setup();
  expect(view.getByRole("heading", { name: "Twoje pliki" })).toBeTruthy();
  expect(view.container.textContent).toContain("Ostatnio przesłane");
  expect(view.container.textContent).toContain("1,5 KiB");
  expect(
    view.getByRole("button", { name: "Więcej działań dla żółć.txt" }),
  ).toBeTruthy();
  fireEvent.click(
    view.getByRole("button", { name: "Usuń żółć.txt z historii" }),
  );
  expect(view.getByRole("status").textContent).toBe(
    "żółć.txt usunięto z tej przeglądarki.",
  );
  expect(JSON.parse(localStorage.getItem(UPLOAD_HISTORY_STORAGE_KEY)!)).toEqual(
    [],
  );
});
it.each(["deleted", "unavailable"] as const)(
  "localizes durable %s without translating API contract",
  async (status) => {
    const { view } = setup();
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      status: status === "deleted" ? 200 : 404,
      text: async () => "",
      json: async () => ({ success: false, message: "File not found." }),
    } as Response);
    global.fetch = fetchMock;
    fireEvent.click(
      view.getByRole("button", { name: "Usuń plik żółć.txt z serwera" }),
    );
    expect(view.getByRole("dialog", { name: "Usunąć żółć.txt?" })).toBeTruthy();
    expect(document.activeElement).toBe(
      view.getByRole("button", { name: "Anuluj" }),
    );
    fireEvent.click(view.getByRole("button", { name: "Usuń plik z serwera" }));
    await waitFor(() =>
      expect(view.getByRole("status").textContent).toBe(
        status === "deleted"
          ? "Plik żółć.txt został usunięty."
          : "żółć.txt był już niedostępny.",
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/u/AAAAA", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessToken: "owner-secret" }),
    });
    expect(
      JSON.parse(localStorage.getItem(UPLOAD_HISTORY_STORAGE_KEY)!)[0]
        .serverStatus,
    ).toBe(status);
    expect(view.container.textContent).not.toContain("owner-secret");
    expect(
      (view.getByRole("button", { name: "Kopiuj link" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  },
);
it("clears browser records without deleting server files", () => {
  const { view } = setup();
  fireEvent.click(view.getByRole("button", { name: "Wyczyść historię" }));
  expect(view.getByRole("status").textContent).toBe(
    "Wyczyszczono historię w tej przeglądarce. Pliki na serwerze nie zostały zmienione.",
  );
});
