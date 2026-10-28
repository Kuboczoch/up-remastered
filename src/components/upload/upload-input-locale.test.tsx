import { afterEach, expect, it, jest } from "@jest/globals";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { LocaleProvider } from "@/lib/i18n/provider";
import { UploadExperience } from "./upload-experience";

function setup() {
  global.fetch = jest.fn<typeof fetch>(() => new Promise(() => {}));
  return render(
    <LocaleProvider locale="pl">
      <UploadExperience initialMaxBytes={4096} />
    </LocaleProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  jest.restoreAllMocks();
});

it("localizes Polish input, tabs and disabled encoding without changing text submission", () => {
  const view = setup();
  expect(
    view.getByRole("heading", {
      name: "Udostępniaj tymczasowe pliki i tekst.",
    }),
  ).toBeTruthy();
  expect(view.getByText("Wszystko wygasa automatycznie.")).toBeTruthy();
  expect(
    view.getByRole("tablist", { name: "Rodzaj przesyłania" }),
  ).toBeTruthy();
  expect(view.getByLabelText("Wybierz plik")).toBeTruthy();
  expect(
    view.getByRole("link", { name: "Poproś o plik ↗" }).getAttribute("href"),
  ).toBe("/request/new");
  fireEvent.click(view.getByRole("tab", { name: /^Tekst$/ }));
  expect(view.getByPlaceholderText("Wklej lub wpisz tekst")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Prześlij tekst" }));
  expect(view.getByRole("alert").textContent).toContain(
    "Wpisz lub wklej tekst przed przesłaniem.",
  );
  expect(
    view.getByRole("heading", { name: "Coś poszło nie tak" }),
  ).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Spróbuj ponownie" }));
  expect(view.queryByRole("alert")).toBeNull();
});

it("localizes oversize validation and keeps Unicode filename unchanged without uploading", () => {
  const view = setup();
  const file = new File([new Uint8Array(8192)], "żółć.txt");
  fireEvent.change(view.getByLabelText("Wybierz plik"), {
    target: { files: [file] },
  });
  expect(view.getByRole("alert").textContent).toContain(
    "Plik „żółć.txt” ma rozmiar 8 KiB. Maksymalny rozmiar to 4 KiB.",
  );
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it("localizes multi-file drop and paste rejection", () => {
  const view = setup();
  const workspace = view.container.querySelector(".upload-workspace")!;
  fireEvent.drop(workspace, { dataTransfer: { items: [], files: [] } });
  expect(view.getByRole("alert").textContent).toContain(
    "Upuść dokładnie jeden plik. Foldery i wiele plików nie są obsługiwane.",
  );
  fireEvent.click(view.getByRole("button", { name: "Spróbuj ponownie" }));
  fireEvent.paste(workspace, {
    clipboardData: { files: [new File(["a"], "a"), new File(["b"], "b")] },
  });
  expect(view.getByRole("alert").textContent).toContain(
    "Wklejaj po jednym pliku.",
  );
});
