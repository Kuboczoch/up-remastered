import { afterEach, expect, it, jest } from "@jest/globals";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { LocaleProvider } from "@/lib/i18n/provider";
import { formatBytes, formatLocalDateTime } from "@/lib/format";
import { ManageRequest } from "./manage-request";

const token = "b".repeat(64);
const active = {
  createdAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2099-01-01T01:00:00.000Z",
  maxBytes: 1536,
  status: "active",
  statusChangedAt: "2026-01-01T00:00:00.000Z",
  uploadId: "abc12",
};
function renderPolish() {
  return render(
    <LocaleProvider locale="pl">
      <ManageRequest />
    </LocaleProvider>,
  );
}
afterEach(() => {
  window.history.replaceState(null, "", "/");
  window.sessionStorage.clear();
  jest.restoreAllMocks();
});
it.each(["active", "retry", "in_progress", "consumed", "expired", "revoked"])(
  "localizes direct owner status %s without changing capability behavior",
  async (status) => {
    window.history.replaceState(null, "", `/request/manage#${token}`);
    global.fetch = jest.fn<typeof fetch>(
      async () =>
        ({
          ok: true,
          json: async () => ({ request: { ...active, status } }),
        }) as Response,
    );
    const view = renderPolish();
    await view.findByRole("heading", { name: "Status prośby" });
    expect(window.location.hash).toBe("");
    expect(view.getByRole("status").textContent).toBe(
      {
        active: "aktywna",
        retry: "ponowna próba",
        in_progress: "przesyłanie w toku",
        consumed: "wykorzystana",
        expired: "wygasła",
        revoked: "unieważniona",
      }[status],
    );
    expect(view.getByText("Limit przesyłania")).toBeTruthy();
    expect(view.getByText(formatBytes(active.maxBytes, "pl"))).toBeTruthy();
    expect(
      view.getByText(formatLocalDateTime(active.expiresAt, "pl")),
    ).toBeTruthy();
    expect(
      view.queryByRole("link", { name: "Otwórz plik" })?.getAttribute("href") ??
        null,
    ).toBe(status === "consumed" ? "/abc12" : null);
    const revoke = view.queryByRole("button", { name: "Unieważnij prośbę" });
    expect(revoke !== null).toBe(
      !["consumed", "expired", "revoked"].includes(status),
    );
    if (revoke)
      expect((revoke as HTMLButtonElement).disabled).toBe(
        status === "in_progress",
      );
  },
);
it("localizes invalid-fragment feedback and discards the stale capability", async () => {
  window.sessionStorage.setItem("up.upload-request-management-token", token);
  window.history.replaceState(null, "", "/request/manage#invalid");
  global.fetch = jest.fn<typeof fetch>();
  const view = renderPolish();
  await view.findByRole("heading", { name: "Link właściciela niedostępny" });
  expect(view.getByRole("alert").textContent).toBe(
    "Otwórz prywatny link właściciela utworzony wraz z prośbą o plik.",
  );
  expect(global.fetch).not.toHaveBeenCalled();
  expect(
    window.sessionStorage.getItem("up.upload-request-management-token"),
  ).toBeNull();
});
it("does not expose arbitrary remote owner errors", async () => {
  window.history.replaceState(null, "", `/request/manage#${token}`);
  global.fetch = jest.fn<typeof fetch>(
    async () =>
      ({
        ok: false,
        json: async () => ({ error: { message: `secret ${token}` } }),
      }) as Response,
  );
  const view = renderPolish();
  await view.findByRole("heading", { name: "Link właściciela niedostępny" });
  expect(view.getByRole("alert").textContent).toBe(
    "Ta prośba o plik jest niedostępna.",
  );
  expect(view.container.textContent).not.toContain(token);
});
it("localizes revoke failure without leaking exceptions and keeps confirmation retryable", async () => {
  window.history.replaceState(null, "", `/request/manage#${token}`);
  const fetchMock = jest.fn<typeof fetch>(async (_input, init) => {
    if (init?.method === "DELETE") throw new Error(`secret ${token}`);
    return { ok: true, json: async () => ({ request: active }) } as Response;
  });
  global.fetch = fetchMock;
  const view = renderPolish();
  await view.findByRole("heading", { name: "Status prośby" });
  fireEvent.click(view.getByRole("button", { name: "Unieważnij prośbę" }));
  const dialog = view.getByRole("dialog", {
    name: "Unieważnić prośbę o plik?",
  });
  expect(dialog.textContent).toContain(formatBytes(active.maxBytes, "pl"));
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Potwierdź unieważnienie prośby",
    }),
  );
  await waitFor(() =>
    expect(view.container.textContent).toContain(
      "Nie udało się unieważnić prośby.",
    ),
  );
  expect(view.container.textContent).not.toContain(token);
  expect(
    fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE"),
  ).toHaveLength(1);
  expect(
    (
      within(dialog).getByRole("button", {
        name: "Potwierdź unieważnienie prośby",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});
