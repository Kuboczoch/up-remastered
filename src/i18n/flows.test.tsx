import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { LocaleProvider } from "./provider";
import { apiErrorKey, translate } from "./messages";
import { UploadExperience } from "@/components/upload/upload-experience";
import { CreateRequestForm } from "@/app/request/new/create-request-form";
import { RequestOwnerStatus } from "@/app/request/request-owner-status";
import { CopyRequestLink } from "@/app/request/copy-request-link";
import { RequestExpiry } from "@/app/request/request-expiry";
import { uploadFile } from "../components/upload/client-upload";
import { renderToString } from "react-dom/server";

jest.mock("../components/upload/client-upload", () => ({
  uploadFile: jest.fn(),
}));
const upload = jest.mocked(uploadFile);
const details = {
  createdAt: "2026-10-01T10:00:00Z",
  expiresAt: "2099-10-05T10:00:00Z",
  maxBytes: 1536,
  statusChangedAt: "2026-10-01T10:00:00Z",
  status: "active" as const,
};
const limits = {
  ok: true,
  json: async () => ({
    maxFileLifetime: 86_400_000,
    maxTemporaryFileSize: 1536,
  }),
} as Response;
function pl(node: React.ReactNode) {
  return <LocaleProvider locale="pl">{node}</LocaleProvider>;
}
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  });
  localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue(limits);
  jest.clearAllMocks();
});
afterEach(() => jest.restoreAllMocks());

test.each([
  null,
  [],
  "SQLITE_ERROR sensitive-token",
  { error: "secret" },
  { error: { code: "UNKNOWN_CODE", message: "secret" } },
  { error: { message: "Upload failed with secret token" } },
])("unknown remote errors safely fall back in both languages: %p", (body) => {
  expect(translate("pl", apiErrorKey(body))).toBe(
    "Przesyłanie nie powiodło się. Spróbuj ponownie.",
  );
  expect(translate("en", apiErrorKey(body))).toBe("Upload failed. Try again.");
});
test.each([
  "upload_too_large",
  "total_storage_limit_exceeded",
  "upload_request_unavailable",
  "invalid_expiration",
  "invalid_multipart",
  "invalid_encrypted_upload",
])("known code %s maps to app-owned presentation", (code) => {
  const key = apiErrorKey({ error: { code, message: "sensitive-token" } });
  expect(translate("pl", key)).not.toContain("sensitive-token");
  expect(translate("pl", key)).not.toBe(key);
});
test("Polish hydration retains the initial language and stable UTC dates", async () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  const node = pl(
    <>
      <UploadExperience initialMaxBytes={1536} />
      <RequestExpiry expiresAt="2026-10-05T12:00:00Z" />
    </>,
  );
  const container = document.createElement("div");
  container.innerHTML = renderToString(node);
  expect(container.textContent).toContain("maks. 1,5 KiB");
  expect(container.textContent).not.toContain("Choose file");
  const initialDate = container.querySelector("time")?.textContent;
  render(node, { container, hydrate: true });
  await waitFor(() =>
    expect(container.querySelector("time")?.textContent).toBe(initialDate),
  );
  expect(error).not.toHaveBeenCalled();
});
test("advanced upload options translate counts, accessible controls, disabled encoding and validation", async () => {
  render(pl(<UploadExperience initialMaxBytes={1536} />));
  fireEvent.click(screen.getByRole("button", { name: /Opcje zaawansowane/ }));
  expect(screen.getByLabelText("Wygasa po").textContent).toContain("1 godzina");
  expect(screen.getByLabelText("Wygasa po").textContent).toContain("3 godziny");
  fireEvent.change(screen.getByLabelText("Limit pobrań"), {
    target: { value: "2" },
  });
  expect(
    screen.getByLabelText("Limit pobrań").getAttribute("aria-valuetext"),
  ).toBe("2 pobrania");
  fireEvent.click(screen.getByRole("button", { name: "Gotowe" }));
  fireEvent.click(screen.getByRole("tab", { name: "Tekst" }));
  fireEvent.click(screen.getByRole("button", { name: /Opcje zaawansowane/ }));
  expect(
    (screen.getByLabelText("Kodowanie tekstu") as HTMLSelectElement).disabled,
  ).toBe(true);
  expect(
    (screen.getByLabelText("Kodowanie tekstu") as HTMLSelectElement).value,
  ).toBe("utf-8");
  fireEvent.click(screen.getByRole("button", { name: "Gotowe" }));
  fireEvent.click(screen.getByRole("button", { name: "Prześlij tekst" }));
  expect(screen.getByRole("alert").textContent).toContain(
    "Wpisz lub wklej tekst przed przesłaniem.",
  );
  await act(async () => {});
});
test("upload success, manual copy, sharing warnings, deletion and history use Polish without changing names or fragment keys", async () => {
  const url = "https://example.test/decrypt/ABC12#key=" + "A".repeat(43);
  upload.mockReturnValue({
    abort: jest.fn(),
    promise: Promise.resolve({
      id: "ABC12",
      accessToken: "private",
      expiresAt: "2099-10-05T12:00:00Z",
      size: 1536,
      shareUrl: url,
      originalName: "Untranslated.txt",
    }),
  });
  render(pl(<UploadExperience initialMaxBytes={4096} />));
  fireEvent.change(screen.getByLabelText("Wybierz plik"), {
    target: { files: [new File(["x"], "Untranslated.txt")] },
  });
  await screen.findByRole("button", { name: "Kopiuj adres" });
  expect(screen.getByText("Untranslated.txt")).toBeTruthy();
  expect(
    (screen.getByLabelText("Adres udostępniania") as HTMLInputElement).value,
  ).toBe(url);
  fireEvent.click(screen.getByRole("button", { name: "Kopiuj adres" }));
  await screen.findByLabelText("Pełny link do ręcznego skopiowania");
  expect(
    (
      screen.getByLabelText(
        "Pełny link do ręcznego skopiowania",
      ) as HTMLInputElement
    ).value,
  ).toBe(url);
  expect(screen.getByText(/Tylko pełny link odblokowuje plik/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Usuń plik" }));
  expect(screen.getByRole("dialog").textContent).toContain(
    "Trwale usunąć ten plik z serwera?",
  );
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Usuń plik",
    }),
  );
  await screen.findByRole("heading", { name: "Plik usunięty" });
  expect(
    screen.getByText("Dotychczasowe linki udostępniania już nie działają."),
  ).toBeTruthy();
});
test.each([
  new Error("SQLITE_ERROR secret-token"),
  new Error("The file is too large. Choose a smaller file."),
])("upload failure is translated and sanitized", async (error) => {
  upload.mockReturnValue({ abort: jest.fn(), promise: Promise.reject(error) });
  render(pl(<UploadExperience initialMaxBytes={1536} />));
  fireEvent.change(screen.getByLabelText("Wybierz plik"), {
    target: { files: [new File(["x"], "name.txt")] },
  });
  await screen.findByRole("alert");
  expect(screen.getByRole("alert").textContent).not.toMatch(
    /SQLITE|secret|Upload|Choose/,
  );
});
test("request creation validation and remote error handling stay Polish", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(limits)
    .mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { message: "raw secret", code: "SQLITE_ERROR" },
      }),
    });
  render(pl(<CreateRequestForm />));
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Maksymalny rozmiar pliku") as HTMLSelectElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.change(screen.getByLabelText("Maksymalny rozmiar pliku"), {
    target: { value: "custom" },
  });
  fireEvent.change(screen.getByLabelText("Rozmiar"), {
    target: { value: "99999" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Utwórz prośbę o plik" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("alert").textContent).toContain(
    "Rozmiar musi wynosić od 1 bajta do 1,5 KiB.",
  );
  fireEvent.change(screen.getByLabelText("Rozmiar"), {
    target: { value: "1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Utwórz prośbę o plik" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Nie udało się utworzyć prośby. Spróbuj ponownie.",
    ),
  );
});
test("request revoke confirmation retains focus and translated recovery", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  render(
    pl(
      <RequestOwnerStatus
        request={details}
        token="private"
        onUpdate={() => {}}
      />,
    ),
  );
  const trigger = screen.getByRole("button", { name: "Unieważnij prośbę" });
  trigger.focus();
  fireEvent.click(trigger);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Zachowaj prośbę" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Potwierdź unieważnienie" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Nie udało się unieważnić prośby. Spróbuj ponownie.",
    ),
  );
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});
test("successful revoke focuses the status even while parent/live updates still show the old request", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ request: { ...details, status: "revoked" } }),
  });
  const onUpdate = jest.fn();
  render(
    pl(
      <RequestOwnerStatus
        request={details}
        token="private"
        onUpdate={onUpdate}
      />,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Unieważnij prośbę" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Potwierdź unieważnienie" }),
  );
  await waitFor(() => expect(onUpdate).toHaveBeenCalled());
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("status")),
  );
});

test("request manual copy shares complete-link fallback", async () => {
  render(
    pl(
      <CopyRequestLink
        value="https://example.test/request/manage#unchanged"
        label="Kopiuj link właściciela"
      />,
    ),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Kopiuj link właściciela" }),
  );
  await screen.findByLabelText("Pełny link do ręcznego skopiowania");
  expect(
    (
      screen.getByLabelText(
        "Pełny link do ręcznego skopiowania",
      ) as HTMLInputElement
    ).value,
  ).toBe("https://example.test/request/manage#unchanged");
});
