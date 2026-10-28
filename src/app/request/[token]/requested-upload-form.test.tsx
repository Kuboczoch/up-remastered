import { act, fireEvent, render, screen } from "@testing-library/react";
import { RequestedUploadForm } from "./requested-upload-form";

class Transport {
  static instances: Transport[] = [];
  upload: { onprogress?: (event: ProgressEvent) => void; onload?: () => void } =
    {};
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  status = 201;
  response: unknown = {
    accessToken: "disposable",
    upload: { shareUrl: "/ABCDE" },
  };
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

function submit() {
  fireEvent.submit(
    screen.getByRole("button", { name: "Upload file" }).closest("form")!,
  );
}

function select(maxBytes = 1024, size = 7) {
  render(<RequestedUploadForm maxBytes={maxBytes} token="disposable" />);
  const file = new File(["x".repeat(size)], "selected.txt", {
    type: "text/plain",
  });
  fireEvent.change(screen.getByLabelText("Choose file"), {
    target: { files: [file] },
  });
  // FormData in jsdom does not serialize the synthetic FileList.
  jest.spyOn(FormData.prototype, "get").mockReturnValue(file);
  submit();
  return Transport.instances[0];
}

test("reports bytes, progress and finalizing, disables replacement and guards duplicate submit", async () => {
  const xhr = select();
  expect(xhr).toBeDefined();
  expect(screen.getByText("selected.txt — 7 bytes")).toBeDefined();
  expect(
    (screen.getByLabelText("Choose file") as HTMLInputElement).disabled,
  ).toBe(true);
  fireEvent.submit(
    screen.getByRole("button", { name: "Uploading…" }).closest("form")!,
  );
  expect(Transport.instances).toHaveLength(1);
  act(() =>
    xhr.upload.onprogress?.({
      lengthComputable: true,
      loaded: 50,
      total: 100,
    } as ProgressEvent),
  );
  expect(screen.getByRole("status").textContent).toBe("Uploading… 50%");
  expect((screen.getByRole("progressbar") as HTMLProgressElement).value).toBe(
    50,
  );
  act(() => xhr.upload.onload?.());
  expect(screen.getByRole("status").textContent).toBe("Finalizing… 100%");
  await act(async () => xhr.onload?.());
  expect(
    screen.getByRole("heading", { name: "Upload complete" }),
  ).toBeDefined();
});

test("aborts and preserves selection without claiming confirmed server cancellation", async () => {
  const xhr = select();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Cancel upload" })),
  );
  expect(xhr.abort).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status").textContent).toContain("cancelled locally");
  expect(screen.getByRole("status").textContent).toContain("may be consumed");
  expect(
    (screen.getByLabelText("Choose file") as HTMLInputElement).disabled,
  ).toBe(false);
  submit();
  expect(Transport.instances).toHaveLength(2);
});

test("network failures retain the selected file for retry", async () => {
  const xhr = select();
  await act(async () => xhr.onerror?.());
  expect(screen.getByRole("alert").textContent).toContain("Network error");
  expect(screen.getByText("selected.txt — 7 bytes")).toBeDefined();
  submit();
  expect(Transport.instances).toHaveLength(2);
});

test.each([
  [1073741824, "1 GiB"],
  [2621440, "2.5 MiB"],
])("uses shared readable limit for %s", (maxBytes, label) => {
  render(<RequestedUploadForm maxBytes={maxBytes} token="disposable" />);
  expect(
    screen.getByText(`Maximum ${label}. This link is single-use.`),
  ).toBeDefined();
});

test.each([
  [1024, "1 KiB"],
  [2621440, "2.5 MiB"],
])(
  "validates readable limit for %s without sending bytes",
  async (maxBytes, label) => {
    select(maxBytes, maxBytes + 1);
    await act(async () => {});
    expect(screen.getByRole("alert").textContent).toBe(
      `The file must be no larger than ${label}.`,
    );
    expect(Transport.instances).toHaveLength(0);
  },
);

test("ambiguous unavailable response disables resubmission and requires safe status check", async () => {
  const xhr = select();
  xhr.status = 404;
  xhr.response = null;
  await act(async () => xhr.onload?.());
  expect(
    (screen.getByRole("button", { name: "Upload file" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (screen.getByLabelText("Choose file") as HTMLInputElement).disabled,
  ).toBe(true);
  const statusLink = screen.getByRole("link", { name: "Check request status" });
  expect(statusLink.getAttribute("href")).toBe("/request/disposable");
  expect(screen.getByRole("alert").textContent).toContain("Do not retry");
  submit();
  expect(Transport.instances).toHaveLength(1);
});

test("recoverable validation response permits correction", async () => {
  const xhr = select();
  xhr.status = 413;
  xhr.response = { error: { message: "Too large." } };
  await act(async () => xhr.onload?.());
  expect(screen.getByRole("alert").textContent).toBe("Too large.");
  expect(
    (screen.getByRole("button", { name: "Upload file" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  expect(screen.queryByRole("link")).toBeNull();
  submit();
  expect(Transport.instances).toHaveLength(2);
});
