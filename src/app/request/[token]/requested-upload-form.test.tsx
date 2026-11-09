import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { RequestedUploadForm } from "./requested-upload-form";

const body = {
  accessToken: "private-file-capability",
  managementToken: "private-owner-capability",
  key: "A1B2C",
  upload: {
    id: "A1B2C",
    originalName: "report.txt",
    size: 1024,
    expiresAt: "2099-01-01T01:00:00.000Z",
    shareUrl: "javascript:alert('unsafe')",
    privateField: "private-storage-path",
  },
};

async function complete(response = body) {
  const view = render(
    <RequestedUploadForm maxBytes={2048} token="recipient" />,
  );
  fireEvent.submit(view.container.querySelector("form")!);
  const xhr = Transport.instances[0];
  xhr.response = response;
  await act(async () => xhr.onload?.());
  await waitFor(() =>
    expect(
      view.queryByRole("heading", { name: "Upload complete" }),
    ).not.toBeNull(),
  );
  return view;
}

function clipboard(writeText?: (value: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

function deferred() {
  let resolve!: () => void;
  let reject!: () => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("requested upload completion", () => {
  beforeEach(() => {
    jest
      .spyOn(FormData.prototype, "get")
      .mockReturnValue(new File(["test"], "report.txt"));
    clipboard();
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("announces delivery, summarizes the file and consumes the form without exposing capabilities", async () => {
    const view = await complete();
    expect(view.getByRole("status").textContent).toContain(
      "The requester can now retrieve your file.",
    );
    expect(view.getByText("report.txt")).toBeTruthy();
    expect(view.getByText("1 KiB")).toBeTruthy();
    expect(view.container.querySelector("time")?.getAttribute("datetime")).toBe(
      body.upload.expiresAt,
    );
    expect(
      view.getByRole("link", { name: "Open file" }).getAttribute("href"),
    ).toBe("http://localhost/A1B2C");
    expect(
      view.getByRole("link", { name: "Download file" }).getAttribute("href"),
    ).toBe("http://localhost/A1B2C?download=1");
    expect(view.queryByRole("button", { name: "Upload file" })).toBeNull();
    expect(view.queryByLabelText("Choose file")).toBeNull();
    for (const secret of [
      body.accessToken,
      body.managementToken,
      body.upload.privateField,
      "javascript:",
    ]) {
      expect(view.container.innerHTML).not.toContain(secret);
      expect(JSON.stringify(localStorage)).not.toContain(secret);
      expect(JSON.stringify(sessionStorage)).not.toContain(secret);
    }
    expect(Transport.instances).toHaveLength(1);
  });

  it("does not turn a malformed public ID into a link or repeat the upload", async () => {
    const view = await complete({
      ...body,
      upload: { ...body.upload, id: "../request/manage#private" },
    });
    expect(view.queryByRole("link", { name: "Open file" })).toBeNull();
    expect(view.queryByRole("link", { name: "Download file" })).toBeNull();
    expect(view.queryByRole("button", { name: "Copy link" })).toBeNull();
    expect(
      view.getByText(/Ask the requester to retrieve the file/),
    ).toBeTruthy();
    expect(view.queryByRole("button", { name: "Upload file" })).toBeNull();
  });

  it("shows Copied only after the write resolves and resets feedback", async () => {
    const pending = deferred();
    const write = jest.fn<(value: string) => Promise<void>>(
      () => pending.promise,
    );
    clipboard(write);
    const view = await complete();
    jest.useFakeTimers({ doNotFake: ["queueMicrotask"] });
    fireEvent.click(view.getByRole("button", { name: "Copy link" }));
    expect(view.queryByRole("button", { name: "Copied" })).toBeNull();
    await act(async () => pending.resolve());
    expect(write).toHaveBeenCalledWith("http://localhost/A1B2C");
    expect(view.getByRole("button", { name: "Copied" })).toBeTruthy();
    expect(view.getByText("Link copied.").getAttribute("role")).toBe("status");
    act(() => jest.advanceTimersByTime(3000));
    expect(view.getByRole("button", { name: "Copy link" })).toBeTruthy();
  });

  it.each(["missing", "rejected"])(
    "offers a labelled read-only manual link when clipboard is %s",
    async (mode) => {
      if (mode === "rejected")
        clipboard(async () => {
          throw new Error("denied");
        });
      const view = await complete();
      fireEvent.click(view.getByRole("button", { name: "Copy link" }));
      await waitFor(() =>
        expect(
          view.queryByLabelText("File link for manual copying"),
        ).not.toBeNull(),
      );
      const input = view.getByLabelText(
        "File link for manual copying",
      ) as HTMLInputElement;
      expect(input.readOnly).toBe(true);
      expect(input.value).toBe("http://localhost/A1B2C");
      expect(
        view
          .getByText(/Select and copy the file link manually/)
          .getAttribute("role"),
      ).toBe("status");
      expect(view.queryByRole("button", { name: "Copied" })).toBeNull();
    },
  );

  it("ignores an older clipboard completion and clears failure on retry", async () => {
    const old = deferred();
    const latest = deferred();
    clipboard(
      jest
        .fn<(value: string) => Promise<void>>()
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(latest.promise)
        .mockResolvedValue(undefined),
    );
    const view = await complete();
    fireEvent.click(view.getByRole("button", { name: "Copy link" }));
    fireEvent.click(view.getByRole("button", { name: "Copy link" }));
    await act(async () => latest.reject());
    await act(async () => old.resolve());
    expect(view.queryByRole("button", { name: "Copied" })).toBeNull();
    expect(view.getByLabelText("File link for manual copying")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Copy link" }));
    await waitFor(() =>
      expect(view.queryByRole("button", { name: "Copied" })).not.toBeNull(),
    );
    expect(view.queryByLabelText("File link for manual copying")).toBeNull();
  });

  it("does not schedule feedback after unmount", async () => {
    const pending = deferred();
    clipboard(() => pending.promise);
    const view = await complete();
    jest.useFakeTimers({ doNotFake: ["queueMicrotask"] });
    fireEvent.click(view.getByRole("button", { name: "Copy link" }));
    view.unmount();
    await act(async () => pending.resolve());
    expect(jest.getTimerCount()).toBe(0);
  });

  it("clears a pending reset timer on unmount", async () => {
    clipboard(async () => undefined);
    const view = await complete();
    jest.useFakeTimers({ doNotFake: ["queueMicrotask"] });
    fireEvent.click(view.getByRole("button", { name: "Copy link" }));
    await act(async () => {});
    expect(jest.getTimerCount()).toBe(1);
    view.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});

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
    upload: { ...body.upload },
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
  expect(screen.getByRole("alert").textContent).toBe(
    "The file must be no larger than 1 KiB.",
  );
  expect(
    (screen.getByRole("button", { name: "Upload file" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  expect(screen.queryByRole("link")).toBeNull();
  submit();
  expect(Transport.instances).toHaveLength(2);
});
