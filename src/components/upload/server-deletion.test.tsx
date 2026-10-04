import { afterEach, expect, it, jest } from "@jest/globals";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { UploadExperience } from "./upload-experience";

const historyKey = "up-remastered:upload-history:v1";
const upload = {
  id: "AAAAA",
  accessToken: "test-owner-token",
  originalName: "current.txt",
  size: 4,
  expiresAt: "2099-01-01T00:00:00Z",
  shareUrl: "https://up.example/AAAAA",
};
const originalXHR = global.XMLHttpRequest;
const originalFetch = global.fetch;
const deletedResponse = () =>
  ({ ok: true, status: 200, text: async () => "" }) as Response;
class FakeXHR {
  status = 201;
  response = { accessToken: upload.accessToken, upload };
  responseType = "";
  upload = { addEventListener() {} };
  listeners = new Map<string, () => void>();
  addEventListener(name: string, callback: () => void) {
    this.listeners.set(name, callback);
  }
  open() {}
  abort() {}
  send() {
    queueMicrotask(() => this.listeners.get("load")?.());
  }
}
function mount() {
  const deletionFetch = global.fetch;
  global.fetch = jest.fn<typeof fetch>((input, init) =>
    input === "/api/configuration"
      ? new Promise<Response>(() => {})
      : deletionFetch(input, init),
  );
  global.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
  localStorage.setItem("up-remastered:history-enabled", "true");
  return render(<UploadExperience initialMaxBytes={1000000} />);
}
async function showResult(view: ReturnType<typeof mount>) {
  fireEvent.change(view.getByLabelText("Choose file"), {
    target: { files: [new File(["test"], upload.originalName)] },
  });
  await waitFor(() =>
    expect(view.getByRole("button", { name: "Copy URL" })).toBeTruthy(),
  );
}
afterEach(() => {
  cleanup();
  localStorage.clear();
  global.XMLHttpRequest = originalXHR;
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});
it("retains confirmed deletion across remount and invalidates the current result", async () => {
  global.fetch = jest.fn<typeof fetch>(
    async () => ({ ok: true, status: 200, text: async () => "" }) as Response,
  );
  const view = mount();
  await showResult(view);
  fireEvent.click(
    view.getByRole("button", { name: "Delete current.txt", hidden: true }),
  );
  await waitFor(() =>
    expect(view.queryByRole("button", { name: "Copy URL" })).toBeNull(),
  );
  expect(view.getByText("File deleted")).toBeTruthy();
  expect(view.queryByRole("link", { name: "Open file" })).toBeNull();
  expect(view.queryByRole("button", { name: "Show QR code" })).toBeNull();
  expect(JSON.parse(localStorage.getItem(historyKey)!)[0].serverStatus).toBe(
    "deleted",
  );
  view.unmount();
  const restored = mount();
  expect(
    restored.getByText("Deleted on server. Saved links no longer work."),
  ).toBeTruthy();
  expect(
    (restored.getByRole("button", { name: "Copy link" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (
      restored.getByRole("button", {
        name: "Delete current.txt",
        hidden: true,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
it.each([403, 500, 404, 204])(
  "retains live metadata and actions after unconfirmed response %s",
  async (status) => {
    global.fetch = jest.fn<typeof fetch>(
      async () =>
        ({
          ok: status < 400,
          status,
          text: async () => "File unavailable.\n",
          json: async () => {
            throw new Error("not JSON");
          },
        }) as unknown as Response,
    );
    const view = mount();
    await showResult(view);
    fireEvent.click(
      view.getByRole("button", { name: "Delete current.txt", hidden: true }),
    );
    await waitFor(() =>
      expect(
        view.getByText("current.txt could not be deleted. Try again."),
      ).toBeTruthy(),
    );
    expect(view.getByRole("button", { name: "Copy URL" })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(historyKey)!)[0].accessToken).toBe(
      upload.accessToken,
    );
    expect(
      JSON.parse(localStorage.getItem(historyKey)!)[0].serverStatus,
    ).toBeUndefined();
  },
);
it("distinguishes API-confirmed unavailability from successful deletion", async () => {
  global.fetch = jest.fn<typeof fetch>(
    async () =>
      ({
        ok: false,
        status: 404,
        json: async () => ({ success: false, message: "File not found." }),
      }) as Response,
  );
  const view = mount();
  await showResult(view);
  fireEvent.click(
    view.getByRole("button", { name: "Delete current.txt", hidden: true }),
  );
  await waitFor(() => expect(view.getByText("File unavailable")).toBeTruthy());
  expect(JSON.parse(localStorage.getItem(historyKey)!)[0].serverStatus).toBe(
    "unavailable",
  );
});
it("deleting another history entry preserves the unrelated current result", async () => {
  global.fetch = jest.fn<typeof fetch>(
    async () => ({ ok: true, status: 200, text: async () => "" }) as Response,
  );
  localStorage.setItem(
    historyKey,
    JSON.stringify([
      {
        ...upload,
        id: "BBBBB",
        originalName: "other.txt",
        savedAt: "2026-01-01T00:00:00Z",
      },
    ]),
  );
  const view = mount();
  await showResult(view);
  fireEvent.click(
    view.getByRole("button", { name: "Delete other.txt", hidden: true }),
  );
  await waitFor(() =>
    expect(view.getByText("other.txt was deleted.")).toBeTruthy(),
  );
  expect(view.getByRole("button", { name: "Copy URL" })).toBeTruthy();
  expect((view.getByLabelText("Share URL") as HTMLInputElement).value).toBe(
    upload.shareUrl,
  );
});

it("keeps network failures retryable without discarding ownership", async () => {
  global.fetch = jest.fn<typeof fetch>(async () => {
    throw new Error("offline");
  });
  const view = mount();
  await showResult(view);
  fireEvent.click(
    view.getByRole("button", { name: "Delete current.txt", hidden: true }),
  );
  await waitFor(() =>
    expect(
      view.getByText("current.txt could not be deleted. Try again."),
    ).toBeTruthy(),
  );
  expect(view.getByRole("button", { name: "Copy URL" })).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(historyKey)!)[0].accessToken).toBe(
    upload.accessToken,
  );
});

it("announces failed persistence without undoing confirmed deletion", async () => {
  global.fetch = jest.fn<typeof fetch>(async () => deletedResponse());
  const view = mount();
  await showResult(view);
  const setItem = Storage.prototype.setItem;
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(function (
    this: Storage,
    key,
    value,
  ) {
    if (key === historyKey) throw new Error("quota");
    setItem.call(this, key, value);
  });
  fireEvent.click(
    view.getByRole("button", { name: "Delete current.txt", hidden: true }),
  );
  await waitFor(() =>
    expect(
      view.getByText(/Status could not be saved in this browser/),
    ).toBeTruthy(),
  );
  expect(view.getByText("File deleted")).toBeTruthy();
  expect(view.queryByRole("button", { name: "Copy URL" })).toBeNull();
  expect(
    (view.getByRole("button", { name: "Copy link" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

it("does not resurrect a locally removed row when deletion finishes", async () => {
  let complete!: (response: Response) => void;
  global.fetch = jest.fn<typeof fetch>(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const view = mount();
  await showResult(view);
  fireEvent.click(
    view.getByRole("button", { name: "Delete current.txt", hidden: true }),
  );
  fireEvent.click(
    view.getByRole("button", {
      name: "Remove current.txt from history",
      hidden: true,
    }),
  );
  await act(async () => {
    complete(deletedResponse());
  });
  expect(view.getByText("File deleted")).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(historyKey)!)).toEqual([]);
  expect(view.queryByRole("button", { name: "Copy URL" })).toBeNull();
});
