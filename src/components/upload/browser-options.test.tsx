import { afterEach, expect, it, jest } from "@jest/globals";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { TextEncoder } from "node:util";
import { UploadExperience } from "./upload-experience";

global.TextEncoder = TextEncoder;
const originalXHR = global.XMLHttpRequest;
let finishUpload: (() => void) | null = null;
let deferUpload = false;
let files: File[] = [];
class FakeXHR {
  responseType = "";
  status = 201;
  response = {
    accessToken: "token",
    upload: {
      id: "AAAAA",
      originalName: "text.txt",
      size: 4,
      expiresAt: "2099-01-01T00:00:00Z",
      shareUrl: "https://up.example/AAAAA",
    },
  };
  upload = { addEventListener() {} };
  listeners = new Map<string, () => void>();
  addEventListener(name: string, listener: () => void) {
    this.listeners.set(name, listener);
  }
  abort() {}
  open() {}
  send(body: FormData) {
    files.push(body.get("file") as File);
    if (deferUpload) finishUpload = () => this.listeners.get("load")?.();
    else queueMicrotask(() => this.listeners.get("load")?.());
  }
}
const result = {
  accessToken: "token",
  id: "AAAAA",
  originalName: "text.txt",
  size: 2,
  expiresAt: "2099-01-01T00:00:00Z",
  shareUrl: "https://up.example/AAAAA",
};
function mount() {
  global.fetch = jest.fn<typeof fetch>(() => new Promise(() => {}));
  files = [];
  deferUpload = false;
  finishUpload = null;
  global.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
  return render(<UploadExperience initialMaxBytes={1000000} />);
}
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  jest.restoreAllMocks();
  global.XMLHttpRequest = originalXHR;
});

it.each(["button", "panel", "window"])(
  "keeps UTF-8 fixed for the %s text path across modes",
  async (path) => {
    const view = mount();
    fireEvent.click(view.getByRole("tab", { name: /^Text$/ }));
    fireEvent.click(view.getByRole("button", { name: /Advanced options/ }));
    const select = view.getByLabelText("Text encoding") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    fireEvent.click(view.getByRole("button", { name: "Done" }));
    fireEvent.click(view.getByRole("tab", { name: /^File$/ }));
    fireEvent.click(view.getByRole("tab", { name: /^Text$/ }));
    fireEvent.click(view.getByRole("button", { name: /Advanced options/ }));
    expect(
      (view.getByLabelText("Text encoding") as HTMLSelectElement).value,
    ).toBe("utf-8");
    fireEvent.click(view.getByRole("button", { name: "Done" }));
    if (path === "button") {
      fireEvent.change(view.getByLabelText("Or upload text"), {
        target: { value: "Aé" },
      });
      fireEvent.click(view.getByRole("button", { name: "Upload text" }));
    } else {
      fireEvent.paste(
        path === "panel"
          ? view.container.querySelector(".upload-workspace")!
          : window,
        {
          clipboardData: { files: [], getData: () => "Aé" },
        },
      );
    }
    await waitFor(() => expect(files).toHaveLength(1));
    const file = files[0];
    expect(file.type).toBe("text/plain;charset=utf-8");
    const bytes = await new Promise<number[]>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(Array.from(new Uint8Array(reader.result as ArrayBuffer)));
      reader.readAsArrayBuffer(file);
    });
    expect(bytes).toEqual([65, 195, 169]);
  },
);
const historyKey = "up-remastered:upload-history:v1";
const consentKey = "up-remastered:history-consent";
const saved = [{ ...result, savedAt: "2026-01-01T00:00:00Z" }];
function options(view: ReturnType<typeof mount>) {
  fireEvent.click(view.getByRole("button", { name: /Advanced options/ }));
  return view.getByRole("switch", { name: "Save history" }) as HTMLInputElement;
}

it("does not touch legacy records or save uploads before consent", async () => {
  sessionStorage.setItem(historyKey, JSON.stringify(saved));
  const writes = jest.spyOn(Storage.prototype, "setItem");
  const removes = jest.spyOn(Storage.prototype, "removeItem");
  const view = mount();
  const toggle = options(view);
  expect(toggle.disabled).toBe(false);
  expect(toggle.checked).toBe(false);
  fireEvent.click(view.getByRole("button", { name: "Done" }));
  fireEvent.paste(window, {
    clipboardData: { files: [], getData: () => "hello" },
  });
  await waitFor(() =>
    expect(view.getByRole("button", { name: "Copy URL" })).toBeTruthy(),
  );
  expect(writes).not.toHaveBeenCalled();
  expect(removes).not.toHaveBeenCalled();
});
it("migrates only after consent and disabling clears both stores without server deletion", () => {
  sessionStorage.setItem(historyKey, JSON.stringify(saved));
  const view = mount();
  fireEvent.click(options(view));
  expect(localStorage.getItem(consentKey)).toBe("true");
  expect(localStorage.getItem(historyKey)).toContain("text.txt");
  expect(sessionStorage.getItem(historyKey)).toBeNull();
  fireEvent.click(view.getByRole("switch", { name: "Save history" }));
  expect(localStorage.getItem(consentKey)).toBe("false");
  expect(localStorage.getItem(historyKey)).toBeNull();
  expect(sessionStorage.getItem(historyKey)).toBeNull();
  expect(view.container.querySelector(".history-card")).toBeNull();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
it("synchronizes cross-tab records, clearing, and revoked consent", () => {
  localStorage.setItem(consentKey, "true");
  localStorage.setItem(historyKey, JSON.stringify(saved));
  const view = mount();
  expect(view.getByRole("heading", { name: "Your uploads" })).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Clear history" }));
  expect(localStorage.getItem(historyKey)).toBeNull();
  expect(localStorage.getItem(consentKey)).toBe("true");
  expect(global.fetch).toHaveBeenCalledTimes(1);
  localStorage.setItem(historyKey, JSON.stringify(saved));
  fireEvent(
    window,
    new StorageEvent("storage", { key: historyKey, storageArea: localStorage }),
  );
  expect(view.getByRole("heading", { name: "Your uploads" })).toBeTruthy();
  localStorage.setItem(consentKey, "false");
  fireEvent(
    window,
    new StorageEvent("storage", { key: consentKey, storageArea: localStorage }),
  );
  expect(view.container.querySelector(".history-card")).toBeNull();
  expect(options(view).checked).toBe(false);
});
it("persists completed uploads only while consent is current and without fragments", async () => {
  const view = mount();
  fireEvent.click(options(view));
  fireEvent.click(view.getByRole("button", { name: "Done" }));
  fireEvent.paste(window, {
    clipboardData: { files: [], getData: () => "hello" },
  });
  await waitFor(() =>
    expect(localStorage.getItem(historyKey)).toContain("text.txt"),
  );
});
it("does not save an in-flight upload after consent is revoked in another tab", async () => {
  localStorage.setItem(consentKey, "true");
  const view = mount();
  deferUpload = true;
  fireEvent.paste(window, {
    clipboardData: { files: [], getData: () => "hello" },
  });
  expect(finishUpload).not.toBeNull();
  // Deliberately omit the storage event to exercise the completion-time guard.
  localStorage.setItem(consentKey, "false");
  finishUpload!();
  await waitFor(() =>
    expect(view.getByRole("button", { name: "Copy URL" })).toBeTruthy(),
  );
  expect(localStorage.getItem(historyKey)).toBeNull();
});
it("fails closed when consent cannot be persisted", () => {
  const view = mount();
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("blocked");
  });
  const toggle = options(view);
  fireEvent.click(toggle);
  expect(toggle.checked).toBe(false);
  expect(view.getByText(/History could not be enabled/).textContent).toContain(
    "could not be enabled",
  );
  expect(view.container.querySelector(".history-card")).toBeNull();
});
it("keeps history enabled but removes local and session records when cleared", () => {
  localStorage.setItem(consentKey, "true");
  localStorage.setItem(historyKey, JSON.stringify(saved));
  const view = mount();
  sessionStorage.setItem(historyKey, JSON.stringify(saved));
  fireEvent.click(view.getByRole("button", { name: "Clear history" }));
  expect(localStorage.getItem(historyKey)).toBeNull();
  expect(sessionStorage.getItem(historyKey)).toBeNull();
  expect(options(view).checked).toBe(true);
});
