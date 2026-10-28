import { afterEach, expect, it, jest } from "@jest/globals";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { LocaleProvider } from "@/lib/i18n/provider";
import { UploadExperience } from "./upload-experience";

class ResultRequest extends EventTarget {
  static current: ResultRequest;
  upload = new EventTarget();
  responseType = "";
  status = 201;
  response = {
    accessToken: "owner-secret",
    upload: {
      id: "AAAAA",
      originalName: "żółć.txt",
      shareUrl: "http://localhost/AAAAA",
      expiresAt: "2099-01-01T12:00:00.000Z",
      size: 1536,
    },
  };
  constructor() {
    super();
    ResultRequest.current = this;
  }
  open() {}
  send() {}
  abort() {}
}
const originalFetch = global.fetch;
const originalXHR = global.XMLHttpRequest;
afterEach(() => {
  cleanup();
  localStorage.clear();
  global.fetch = originalFetch;
  global.XMLHttpRequest = originalXHR;
  jest.restoreAllMocks();
});

it("localizes the current result without translating names, URLs or owner credentials", async () => {
  global.fetch = jest.fn<typeof fetch>(() => new Promise(() => {}));
  global.XMLHttpRequest = ResultRequest as unknown as typeof XMLHttpRequest;
  const view = render(
    <LocaleProvider locale="pl">
      <UploadExperience initialMaxBytes={4096} />
    </LocaleProvider>,
  );
  fireEvent.change(view.getByLabelText("Wybierz plik"), {
    target: { files: [new File(["hello"], "żółć.txt")] },
  });
  await act(async () => ResultRequest.current.dispatchEvent(new Event("load")));
  expect(view.getByText("Przesyłanie ukończone")).toBeTruthy();
  expect(document.activeElement).toBe(
    view.getByRole("heading", { name: "żółć.txt" }),
  );
  expect(
    (view.getByLabelText("Link do udostępnienia") as HTMLInputElement).value,
  ).toBe("http://localhost/AAAAA");
  expect(
    view.getByRole("group", { name: "Działania na przesłanym pliku" }),
  ).toBeTruthy();
  expect(
    view.getByRole("link", { name: "Otwórz plik" }).getAttribute("href"),
  ).toBe("http://localhost/AAAAA");
  expect(
    view.getByRole("link", { name: "Pobierz plik" }).getAttribute("href"),
  ).toBe("http://localhost/AAAAA?download=1");
  expect(view.getByRole("button", { name: "Kopiuj URL" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Pokaż kod QR" })).toBeTruthy();
  expect(view.container.textContent).toContain("1,5 KiB");
  expect(view.container.textContent).toContain("Wygasa");
  expect(view.container.textContent).toContain(
    "Każdy, kto ma link, może pobrać plik.",
  );
  expect(view.container.textContent).not.toContain("owner-secret");
  fireEvent.click(view.getByRole("button", { name: "Prześlij kolejny plik" }));
  expect(view.getByLabelText("Wybierz plik")).toBeTruthy();
});
