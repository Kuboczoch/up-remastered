/** @jest-environment jsdom */
import { fireEvent, render, screen, act } from "@testing-library/react";
import { RequestedUploadForm } from "./[token]/requested-upload-form";

class UploadTransport {
  static latest: UploadTransport;
  upload = {
    onprogress: null as null | ((event: ProgressEvent) => void),
    onload: null as null | (() => void),
  };
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  onabort: null | (() => void) = null;
  status = 201;
  responseText = "";
  open = jest.fn();
  send = jest.fn();
  abort = jest.fn(() => this.onabort?.());
  constructor() {
    UploadTransport.latest = this;
  }
}
beforeEach(() => {
  Object.defineProperty(window, "XMLHttpRequest", {
    configurable: true,
    value: UploadTransport,
  });
});

it("uses abortable measurable transport, prevents replacement/double submit and retains selection for retry", () => {
  render(<RequestedUploadForm maxBytes={1024} token={"a".repeat(64)} />);
  const input = screen.getByLabelText("Choose file") as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(["hello"], "hello.txt")] },
  });
  const form = input.closest("form")!;
  fireEvent.submit(form);
  const xhr = UploadTransport.latest;
  expect(xhr).toBeDefined();
  expect(input.disabled).toBe(true);
  fireEvent.submit(form);
  expect(xhr.send).toHaveBeenCalledTimes(1);
  expect(UploadTransport.latest).toBe(xhr);
  act(() =>
    xhr.upload.onprogress?.({
      lengthComputable: true,
      loaded: 2,
      total: 5,
    } as ProgressEvent),
  );
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("40");
  act(() => xhr.upload.onload?.());
  expect(screen.getByRole("status").textContent).toContain("Finalizing");
  fireEvent.click(screen.getByRole("button", { name: "Cancel upload" }));
  expect(xhr.abort).toHaveBeenCalledTimes(1);
  expect(input.disabled).toBe(false);
  expect(screen.getByRole("status").textContent).toContain("Cancelled");
  fireEvent.submit(form);
  const retry = UploadTransport.latest;
  expect(retry).not.toBe(xhr);
  act(() => retry.onerror?.());
  expect(screen.getByRole("alert").textContent).toContain("retry");
});

it("summarizes delivery and keeps credentials behind an explained disclosure", () => {
  render(<RequestedUploadForm maxBytes={1024} token={"a".repeat(64)} />);
  const input = screen.getByLabelText("Choose file");
  fireEvent.change(input, {
    target: { files: [new File(["hello"], "hello.txt")] },
  });
  fireEvent.submit(input.closest("form")!);
  const xhr = UploadTransport.latest;
  expect(xhr).toBeDefined();
  xhr.responseText = JSON.stringify({
    accessToken: "recipient-only",
    upload: {
      originalName: "hello.txt",
      size: 5,
      expiresAt: "2027-01-01T00:00:00Z",
      shareUrl: "http://localhost/HELLO",
    },
  });
  act(() => xhr.onload?.());
  expect(screen.getByRole("status").textContent).toContain("requester");
  expect(screen.getByText(/hello.txt/)).toBeDefined();
  expect(screen.getByRole("button", { name: "Copy link" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Download file" })).toBeDefined();
  expect(screen.getByText("Advanced / API").closest("details")?.open).toBe(
    false,
  );
});

it("disposes the actual upload transport on navigation without accepting late callbacks", () => {
  const { unmount } = render(
    <RequestedUploadForm maxBytes={1024} token={"a".repeat(64)} />,
  );
  const input = screen.getByLabelText("Choose file");
  fireEvent.change(input, {
    target: { files: [new File(["hello"], "hello.txt")] },
  });
  fireEvent.submit(input.closest("form")!);
  const xhr = UploadTransport.latest;
  unmount();
  expect(xhr.abort).toHaveBeenCalledTimes(1);
  act(() => {
    xhr.onerror?.();
    xhr.onload?.();
  });
  expect(screen.queryByRole("status")).toBeNull();
});
