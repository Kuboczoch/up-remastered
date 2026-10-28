import { afterEach, expect, it, jest } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { LocaleProvider } from "@/lib/i18n/provider";
import { formatBytes, formatLocalDateTime } from "@/lib/format";
import { CreateRequestForm } from "./create-request-form";

const created = {
  createdAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2099-01-01T01:00:00.000Z",
  managementUrl: "https://example.test/request/manage#owner-token",
  managementToken: "owner-token",
  maxBytes: 1536,
  status: "active",
  statusChangedAt: "2026-01-01T00:00:00.000Z",
  uploadUrl: "https://example.test/request/upload-token",
  uploadId: "abc12",
};

afterEach(() => {
  jest.restoreAllMocks();
});

it.each([
  ["active", "Oczekiwanie na plik."],
  [
    "retry",
    "Oczekiwanie na plik. Poprzednia próba nie powiodła się; odbiorca może ponownie użyć tego samego linku.",
  ],
  ["in_progress", "Trwa przesyłanie. Plik nie jest jeszcze dostępny."],
  [
    "consumed",
    "Plik odebrany. Link odbiorcy został wykorzystany i nie przyjmie kolejnego pliku.",
  ],
  [
    "revoked",
    "Prośba została unieważniona. Link do przesyłania już nie działa. Utwórz nową prośbę, aby odebrać plik.",
  ],
  [
    "expired",
    "Prośba wygasła bez odebrania pliku. Utwórz nową prośbę, aby odebrać plik.",
  ],
])(
  "localizes the Polish created-request lifecycle: %s",
  async (status, guidance) => {
    global.fetch = jest.fn<typeof fetch>(
      async (input) =>
        ({
          ok: true,
          json: async () =>
            String(input) === "/api/configuration"
              ? { maxFileLifetime: 86400000, maxTemporaryFileSize: 4096 }
              : { ...created, status },
        }) as Response,
    );
    const view = render(
      <LocaleProvider locale="pl">
        <CreateRequestForm />
      </LocaleProvider>,
    );
    const submit = view.getByRole("button", { name: "Utwórz prośbę o plik" });
    await waitFor(() =>
      expect((submit as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(submit);
    await view.findByRole("heading", { name: "Utworzono prośbę o plik" });
    expect(view.getByText(guidance)).toBeTruthy();
    expect(
      view.getByText(new RegExp(formatBytes(created.maxBytes, "pl"))),
    ).toBeTruthy();
    expect(
      view.getByText(formatLocalDateTime(created.expiresAt, "pl")),
    ).toBeTruthy();
    expect(
      view.getByRole("link", { name: created.uploadUrl }).getAttribute("href"),
    ).toBe(created.uploadUrl);
    expect(
      view
        .getByRole("link", { name: created.managementUrl })
        .getAttribute("href"),
    ).toBe(created.managementUrl);
    expect(
      view.queryByRole("link", { name: "Otwórz plik" })?.getAttribute("href") ??
        null,
    ).toBe(status === "consumed" ? "/abc12" : null);
    expect(
      view.queryByRole("button", { name: "Unieważnij prośbę" }) !== null,
    ).toBe(!["consumed", "expired", "revoked"].includes(status));
    if (status === "active") {
      fireEvent.click(view.getByRole("button", { name: "Unieważnij prośbę" }));
      const dialog = view.getByRole("dialog", {
        name: "Unieważnić prośbę o plik?",
      });
      expect(dialog.textContent).toContain("Nie można tego cofnąć");
      expect(view.getByRole("button", { name: "Anuluj" })).toBeTruthy();
      expect(
        view.getByRole("button", { name: "Potwierdź unieważnienie prośby" }),
      ).toBeTruthy();
    }
  },
);
