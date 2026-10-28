import { act, fireEvent, render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/lib/i18n/provider";
import { formatLocalDateTime } from "@/lib/format";
import { RequestedUploadSuccess } from "./requested-upload-success";

const receipt = {
  id: "A1B2C",
  originalName: "raport-Łódź.txt",
  size: 2560,
  expiresAt: "2099-01-01T01:00:00.000Z",
};

function show(locale: "en" | "pl", id = receipt.id) {
  return render(
    <LocaleProvider locale={locale}>
      <RequestedUploadSuccess receipt={{ ...receipt, id }} />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: undefined,
  });
});
afterEach(() => jest.restoreAllMocks());

test.each(["en", "pl"] as const)(
  "%s receipt translates public labels and formats size/date without changing filename or URL",
  (locale) => {
    const pl = locale === "pl";
    const view = show(locale);
    const heading = screen.getByRole("heading", {
      name: pl ? "Przesyłanie ukończone" : "Upload complete",
    });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole("status").textContent).toBe(
      pl
        ? "Osoba prosząca o plik może go teraz pobrać."
        : "The requester can now retrieve your file.",
    );
    expect(screen.getByText(pl ? "Nazwa pliku" : "Filename")).toBeTruthy();
    expect(screen.getByText(pl ? "Rozmiar" : "Size")).toBeTruthy();
    expect(screen.getByText(pl ? "Plik wygasa" : "File expires")).toBeTruthy();
    expect(screen.getByText(receipt.originalName)).toBeTruthy();
    expect(screen.getByText(pl ? "2,5 KiB" : "2.5 KiB")).toBeTruthy();
    expect(view.container.querySelector("time")?.textContent).toBe(
      formatLocalDateTime(receipt.expiresAt, locale),
    );
    expect(view.container.querySelector("time")?.getAttribute("datetime")).toBe(
      receipt.expiresAt,
    );
    expect(
      screen
        .getByRole("link", { name: pl ? "Otwórz plik" : "Open file" })
        .getAttribute("href"),
    ).toBe("http://localhost/A1B2C");
    expect(
      screen
        .getByRole("link", { name: pl ? "Pobierz plik" : "Download file" })
        .getAttribute("href"),
    ).toBe("http://localhost/A1B2C?download=1");
    for (const link of view.getAllByRole("link")) {
      expect(link.getAttribute("referrerpolicy")).toBe("no-referrer");
    }
    expect(
      screen.getByText(
        pl
          ? /Ten link do prośby został wykorzystany/
          : /This request link has been used/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        pl ? /Każdy, kto ma link do pliku/ : /Anyone with the file link/,
      ),
    ).toBeTruthy();
  },
);

test("Polish manual-copy fallback exposes only validated local public URL", async () => {
  const view = show("pl");
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Kopiuj link" })),
  );
  const input = screen.getByLabelText(
    "Link do pliku do ręcznego skopiowania",
  ) as HTMLInputElement;
  expect(input.readOnly).toBe(true);
  expect(input.value).toBe("http://localhost/A1B2C");
  expect(
    screen
      .getByText(
        "Nie udało się skopiować automatycznie. Zaznacz i skopiuj link do pliku ręcznie.",
      )
      .getAttribute("role"),
  ).toBe("status");
  expect(view.queryByRole("button", { name: "Skopiowano" })).toBeNull();
  fireEvent.focus(input);
  expect(input.selectionEnd).toBe(input.value.length);
});

test("Polish copied feedback waits for clipboard success", async () => {
  let resolve!: () => void;
  const writeText = jest.fn(
    () => new Promise<void>((done) => (resolve = done)),
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  show("pl");
  fireEvent.click(screen.getByRole("button", { name: "Kopiuj link" }));
  expect(screen.queryByRole("button", { name: "Skopiowano" })).toBeNull();
  await act(async () => resolve());
  expect(writeText).toHaveBeenCalledWith("http://localhost/A1B2C");
  expect(screen.getByRole("button", { name: "Skopiowano" })).toBeTruthy();
  expect(screen.getByText("Link skopiowany.").getAttribute("role")).toBe(
    "status",
  );
});

test("Polish malformed-ID fallback offers no link and never prints capability", () => {
  const view = show("pl", "../request/manage#private-owner-capability");
  expect(view.queryByRole("link")).toBeNull();
  expect(view.queryByRole("button")).toBeNull();
  expect(
    screen.getByText(
      "Link do pliku jest niedostępny. Poproś osobę proszącą o plik, aby pobrała go ze strony zarządzania prośbą.",
    ),
  ).toBeTruthy();
  expect(view.container.innerHTML).not.toContain("private-owner-capability");
});
