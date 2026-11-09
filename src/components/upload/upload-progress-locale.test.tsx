import { afterEach, expect, it, jest } from "@jest/globals";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { LocaleProvider } from "@/lib/i18n/provider";
import { UploadExperience } from "./upload-experience";

class PendingRequest extends EventTarget {
  static current: PendingRequest;
  upload = new EventTarget();
  responseType = "";
  response: unknown;
  status = 500;
  aborted = false;
  constructor() {
    super();
    PendingRequest.current = this;
  }
  open() {}
  send() {}
  abort() {
    this.aborted = true;
    this.dispatchEvent(new Event("abort"));
  }
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

function setup() {
  global.fetch = jest.fn<typeof fetch>(() => new Promise(() => {}));
  global.XMLHttpRequest = PendingRequest as unknown as typeof XMLHttpRequest;
  const view = render(
    <LocaleProvider locale="pl">
      <UploadExperience initialMaxBytes={4096} />
    </LocaleProvider>,
  );
  fireEvent.change(view.getByLabelText("Wybierz plik"), {
    target: { files: [new File(["hello"], "żółć.txt")] },
  });
  return { view, xhr: PendingRequest.current };
}

it("localizes active upload progress and cancellation, restoring title and picker focus", async () => {
  document.title = "Pierwotny tytuł";
  const { view, xhr } = setup();
  expect(view.getByText("Przesyłanie")).toBeTruthy();
  const progress = view.getByRole("progressbar", {
    name: "Postęp przesyłania",
  });
  act(() =>
    xhr.upload.dispatchEvent(
      new ProgressEvent("progress", {
        lengthComputable: true,
        loaded: 37,
        total: 100,
      }),
    ),
  );
  expect(progress.getAttribute("aria-valuenow")).toBe("37");
  expect(document.title).toContain("37%");
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: /^Anuluj$/ })),
  );
  expect(xhr.aborted).toBe(true);
  expect(document.title).toBe("Pierwotny tytuł");
  expect(document.activeElement).toBe(view.getByLabelText("Wybierz plik"));
});

it.each([
  ["network", "Błąd sieci. Sprawdź połączenie i spróbuj ponownie."],
  [
    "invalid",
    "Przesyłanie zakończono, ale odpowiedź serwera była nieprawidłowa.",
  ],
  [
    "Upload exceeds the maximum upload size.",
    "Plik przekracza maksymalny rozmiar przesyłania.",
  ],
  [
    "untrusted secret #key=do-not-render",
    "Przesyłanie nie powiodło się. Spróbuj ponownie.",
  ],
])(
  "localizes transport failure %s without exposing arbitrary server text",
  async (source, expected) => {
    const { view, xhr } = setup();
    xhr.status = source === "invalid" ? 201 : 413;
    xhr.response = { error: { message: source } };
    await act(async () => {
      xhr.dispatchEvent(new Event(source === "network" ? "error" : "load"));
    });
    expect(view.getByRole("alert").textContent).toContain(expected);
    expect(view.container.textContent).not.toContain("do-not-render");
    expect(document.activeElement).toBe(
      view.getByRole("heading", { name: "Coś poszło nie tak" }),
    );
    fireEvent.click(view.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(view.queryByRole("alert")).toBeNull();
  },
);
