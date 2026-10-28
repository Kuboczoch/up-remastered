import { afterEach, expect, it, jest } from "@jest/globals";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { LocaleProvider } from "@/lib/i18n/provider";
import Link from "next/link";
import { CurrentResultDeletion } from "./current-result-deletion";

const originalFetch = global.fetch;
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

it.each(["deleted", "unavailable"] as const)(
  "localizes confirmation and confirmed %s without exposing the owner capability",
  async (status) => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      status: status === "deleted" ? 200 : 404,
      text: async () => "",
      json: async () => ({ success: false, message: "File not found." }),
    } as Response);
    global.fetch = fetchMock;
    const view = render(
      <LocaleProvider locale="pl">
        <CurrentResultDeletion
          id="AAAAA"
          accessToken="owner-secret"
          name="żółć.txt"
          onStartAnother={() => {}}
        >
          <Link href="/AAAAA">Public link</Link>
        </CurrentResultDeletion>
      </LocaleProvider>,
    );
    fireEvent.click(view.getByRole("button", { name: "Usuń plik" }));
    expect(view.getByRole("dialog", { name: "Usunąć żółć.txt?" })).toBeTruthy();
    expect(document.activeElement).toBe(
      view.getByRole("button", { name: "Anuluj" }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Usuń plik na stałe" }));
    await waitFor(() =>
      expect(view.getByRole("status").textContent).toBe(
        status === "deleted" ? "Usunięto" : "Plik niedostępny",
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/u/AAAAA", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessToken: "owner-secret" }),
    });
    expect(view.queryByRole("link")).toBeNull();
    expect(
      view.getByRole("button", { name: "Prześlij kolejny plik" }),
    ).toBeTruthy();
    expect(view.container.textContent).not.toContain("owner-secret");
  },
);

it("retains the public link and localized retry after ambiguous failure", async () => {
  global.fetch = jest
    .fn<typeof fetch>()
    .mockRejectedValue(new Error("private-owner-secret"));
  const view = render(
    <LocaleProvider locale="pl">
      <CurrentResultDeletion
        id="AAAAA"
        accessToken="owner-secret"
        name="żółć.txt"
        onStartAnother={() => {}}
      >
        <Link href="/AAAAA">Public link</Link>
      </CurrentResultDeletion>
    </LocaleProvider>,
  );
  fireEvent.click(view.getByRole("button", { name: "Usuń plik" }));
  fireEvent.click(view.getByRole("button", { name: "Usuń plik na stałe" }));
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toBe(
      "Nie potwierdzono usunięcia. Link do pliku został zachowany; spróbuj ponownie.",
    ),
  );
  expect(view.getByRole("link").getAttribute("href")).toBe("/AAAAA");
  expect(view.getByRole("dialog").textContent).not.toContain(
    "private-owner-secret",
  );
});
