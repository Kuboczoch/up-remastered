import { act, fireEvent, render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/lib/i18n/provider";
import { RequestedUploadForm } from "./requested-upload-form";

class Transport {
  static instances: Transport[] = [];
  upload: { onprogress?: (event: ProgressEvent) => void; onload?: () => void } =
    {};
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  status = 413;
  response: unknown = { error: { message: "private-owner-capability" } };
  open = jest.fn();
  send = jest.fn();
  abort = jest.fn(() => this.onabort?.());
  constructor() {
    Transport.instances.push(this);
  }
}
const original = global.XMLHttpRequest;
beforeEach(() => {
  Transport.instances = [];
  global.XMLHttpRequest = Transport as unknown as typeof XMLHttpRequest;
});
afterEach(() => {
  global.XMLHttpRequest = original;
  jest.restoreAllMocks();
});

function select(size = 7) {
  const view = render(
    <LocaleProvider locale="pl">
      <RequestedUploadForm maxBytes={2560} token="recipient" />
    </LocaleProvider>,
  );
  const file = new File(["x".repeat(size)], "report.txt");
  fireEvent.change(screen.getByLabelText("Wybierz plik"), {
    target: { files: [file] },
  });
  jest.spyOn(FormData.prototype, "get").mockReturnValue(file);
  fireEvent.submit(view.container.querySelector("form")!);
  return { view, xhr: Transport.instances[0] };
}

test("Polish labels and limit render before interaction", () => {
  render(
    <LocaleProvider locale="pl">
      <RequestedUploadForm maxBytes={2560} token="recipient" />
    </LocaleProvider>,
  );
  expect(screen.getByLabelText("Wybierz plik")).toBeTruthy();
  expect(
    screen.getByText("Maksymalnie 2,5 KiB. Ten link jest jednorazowy."),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Prześlij plik" })).toBeTruthy();
});

test("Polish validation sends no bytes and preserves filename", async () => {
  select(2561);
  await act(async () => {});
  expect(screen.getByRole("alert").textContent).toBe(
    "Plik nie może być większy niż 2,5 KiB.",
  );
  expect(screen.getByText("report.txt — 2561 bajtów")).toBeTruthy();
  expect(Transport.instances).toHaveLength(0);
});

test("Polish progress/finalizing and cancellation retain real transport and duplicate guards", async () => {
  const { view, xhr } = select();
  fireEvent.submit(view.container.querySelector("form")!);
  expect(Transport.instances).toHaveLength(1);
  act(() =>
    xhr.upload.onprogress?.({
      lengthComputable: true,
      loaded: 50,
      total: 100,
    } as ProgressEvent),
  );
  expect(screen.getByRole("status").textContent).toBe("Przesyłanie… 50%");
  expect(screen.getByRole("progressbar").getAttribute("aria-label")).toBe(
    "Postęp przesyłania",
  );
  act(() => xhr.upload.onload?.());
  expect(screen.getByRole("status").textContent).toBe("Finalizowanie… 100%");
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Anuluj przesyłanie" })),
  );
  expect(xhr.abort).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status").textContent).toContain(
    "anulowano lokalnie",
  );
  expect(screen.getByRole("status").textContent).toContain(
    "mógł zostać wykorzystany",
  );
  expect(
    (screen.getByLabelText("Wybierz plik") as HTMLInputElement).disabled,
  ).toBe(false);
});

test.each([413, 500])(
  "Polish remote %s errors do not expose arbitrary server messages and allow explicit retry",
  async (status) => {
    const { view, xhr } = select();
    xhr.status = status;
    await act(async () => xhr.onload?.());
    expect(screen.getByRole("alert").textContent).not.toContain(
      "private-owner-capability",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      status === 413 ? "Plik nie może" : "Przesyłanie nie powiodło się",
    );
    expect(Transport.instances).toHaveLength(1);
    fireEvent.submit(view.container.querySelector("form")!);
    expect(Transport.instances).toHaveLength(2);
  },
);

test("Polish ambiguous unavailable never retries automatically or on submit", async () => {
  const { view, xhr } = select();
  xhr.status = 404;
  await act(async () => xhr.onload?.());
  expect(screen.getByRole("alert").textContent).toContain("Nie ponawiaj");
  expect(
    screen
      .getByRole("link", { name: "Sprawdź status prośby" })
      .getAttribute("href"),
  ).toBe("/request/recipient");
  expect(
    (screen.getByLabelText("Wybierz plik") as HTMLInputElement).disabled,
  ).toBe(true);
  fireEvent.submit(view.container.querySelector("form")!);
  expect(Transport.instances).toHaveLength(1);
});

test("Polish network ambiguity preserves selected file with no automatic retry", async () => {
  const { xhr } = select();
  await act(async () => xhr.onerror?.());
  expect(screen.getByRole("alert").textContent).toContain("Błąd sieci");
  expect(screen.getByRole("alert").textContent).toContain(
    "mógł już zostać wykorzystany",
  );
  expect(screen.getByText("report.txt — 7 bajtów")).toBeTruthy();
  expect(Transport.instances).toHaveLength(1);
});
