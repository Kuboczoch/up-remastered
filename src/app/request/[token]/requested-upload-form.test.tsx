import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react";

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

async function complete() {
  const view = render(
    <RequestedUploadForm maxBytes={2048} token="recipient" />,
  );
  fireEvent.submit(view.container.querySelector("form")!);
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
    global.fetch = jest.fn<typeof fetch>(
      async () => ({ ok: true, json: async () => body }) as Response,
    );
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
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not turn a malformed public ID into a link or repeat the upload", async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...body,
        upload: { ...body.upload, id: "../request/manage#private" },
      }),
    } as Response);
    const view = await complete();
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
