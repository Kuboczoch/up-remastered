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
  response = { accessToken: "disposable", upload: { shareUrl: "/ABCDE" } };
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
});

function select() {
  render(<RequestedUploadForm maxBytes={1024} token="disposable" />);
  const file = new File(["payload"], "selected.txt", { type: "text/plain" });
  fireEvent.change(screen.getByLabelText("Choose file"), {
    target: { files: [file] },
  });
  // FormData in jsdom does not serialize the synthetic FileList.
  jest.spyOn(FormData.prototype, "get").mockReturnValue(file);
  fireEvent.submit(
    screen.getByRole("button", { name: "Upload file" }).closest("form")!,
  );
  return Transport.instances[0];
}

afterEach(() => jest.restoreAllMocks());

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
  fireEvent.submit(
    screen.getByRole("button", { name: "Upload file" }).closest("form")!,
  );
  expect(Transport.instances).toHaveLength(2);
});

test("network failures retain the selected file for retry", async () => {
  const xhr = select();
  await act(async () => xhr.onerror?.());
  expect(screen.getByRole("alert").textContent).toContain("Network error");
  expect(screen.getByText("selected.txt — 7 bytes")).toBeDefined();
  fireEvent.submit(
    screen.getByRole("button", { name: "Upload file" }).closest("form")!,
  );
  expect(Transport.instances).toHaveLength(2);
});
