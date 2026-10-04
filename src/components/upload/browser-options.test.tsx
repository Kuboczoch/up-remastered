import { afterEach, expect, it, jest } from "@jest/globals";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { TextEncoder } from "node:util";
import { UploadExperience } from "./upload-experience";

global.TextEncoder = TextEncoder;
const originalXHR = global.XMLHttpRequest;
let finishUpload: (() => void) | null = null;
let deferUpload = false;
let failUpload = false;
let files: File[] = [];
class FakeXHR {
  responseType = "";
  status = failUpload ? 500 : 201;
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
  failUpload = false;
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
const preferenceKey = "up-remastered:history-enabled";
const historyKey = "up-remastered:upload-history:v1";
const saved = [{ ...result, savedAt: "2026-01-01T00:00:00Z" }];
function options(view: ReturnType<typeof mount>) {
  fireEvent.click(view.getByRole("button", { name: /Advanced options/ }));
  return view.getByRole("switch", { name: "Save history" }) as HTMLInputElement;
}
it("starts false despite legacy consent and ignores all stores while disabled", async () => {
  localStorage.setItem("up-remastered:history-consent", "true");
  localStorage.setItem(historyKey, JSON.stringify(saved));
  sessionStorage.setItem(historyKey, JSON.stringify(saved));
  const reads = jest.spyOn(Storage.prototype, "getItem");
  const writes = jest.spyOn(Storage.prototype, "setItem");
  const removes = jest.spyOn(Storage.prototype, "removeItem");
  const view = mount();
  expect(options(view).checked).toBe(false);
  fireEvent.click(view.getByRole("button", { name: "Done" }));
  fireEvent(window, new StorageEvent("storage", { key: historyKey }));
  fireEvent.paste(window, {
    clipboardData: { files: [], getData: () => "hello" },
  });
  await waitFor(() =>
    expect(view.getByRole("button", { name: "Copy URL" })).toBeTruthy(),
  );
  expect(reads.mock.calls).toEqual([[preferenceKey]]);
  expect(writes).not.toHaveBeenCalled();
  expect(removes).not.toHaveBeenCalled();
});
it("reads only local history on enable and hides it without mutations on disable", () => {
  localStorage.setItem(historyKey, JSON.stringify(saved));
  sessionStorage.setItem(historyKey, JSON.stringify(saved));
  const reads = jest.spyOn(Storage.prototype, "getItem");
  const writes = jest.spyOn(Storage.prototype, "setItem");
  const removes = jest.spyOn(Storage.prototype, "removeItem");
  const view = mount();
  const toggle = options(view);
  expect(toggle.hasAttribute("aria-describedby")).toBe(false);
  expect(toggle.closest(".switch-setting")!.querySelector("small")).toBeNull();
  fireEvent.click(toggle);
  expect(toggle.checked).toBe(true);
  expect(view.getByRole("heading", { name: "Your uploads" })).toBeTruthy();
  expect(reads.mock.calls).toEqual([[preferenceKey], [historyKey]]);
  expect(reads.mock.instances[0]).toBe(localStorage);
  fireEvent.click(toggle);
  expect(toggle.checked).toBe(false);
  expect(view.container.querySelector(".history-card")).toBeNull();
  expect(reads.mock.calls).toEqual([[preferenceKey], [historyKey]]);
  expect(writes.mock.calls).toEqual([[preferenceKey, "true"]]);
  expect(removes.mock.calls).toEqual([[preferenceKey]]);
  expect(localStorage.getItem(historyKey)).toBe(JSON.stringify(saved));
  expect(localStorage.getItem(preferenceKey)).toBeNull();
  expect(view.container.textContent).not.toMatch(
    /History enabled|History disabled/,
  );
});
it("does not synchronize storage events and restores the preference on remount", () => {
  localStorage.setItem(historyKey, JSON.stringify(saved));
  const view = mount();
  fireEvent.click(options(view));
  localStorage.setItem(historyKey, "[]");
  fireEvent(window, new StorageEvent("storage", { key: historyKey }));
  expect(view.getByRole("heading", { name: "Your uploads" })).toBeTruthy();
  view.unmount();
  const next = mount();
  expect(options(next).checked).toBe(true);
  expect(next.container.querySelector(".history-card")).toBeNull();
  fireEvent.click(next.getByRole("switch", { name: "Save history" }));
  next.unmount();
  const off = mount();
  expect(options(off).checked).toBe(false);
});
it.each(["false", "TRUE", "1", ""])(
  "does not enable history for flag %j",
  (value) => {
    localStorage.setItem(preferenceKey, value);
    localStorage.setItem(historyKey, JSON.stringify(saved));
    const reads = jest.spyOn(Storage.prototype, "getItem");
    const view = mount();
    expect(options(view).checked).toBe(false);
    expect(reads.mock.calls).toEqual([[preferenceKey]]);
  },
);
it("restores enabled history read-only on mount", () => {
  localStorage.setItem(preferenceKey, "true");
  localStorage.setItem(historyKey, JSON.stringify(saved));
  const reads = jest.spyOn(Storage.prototype, "getItem");
  const writes = jest.spyOn(Storage.prototype, "setItem");
  const removes = jest.spyOn(Storage.prototype, "removeItem");
  const view = mount();
  expect(options(view).checked).toBe(true);
  expect(view.getByRole("heading", { name: "Your uploads" })).toBeTruthy();
  expect(reads.mock.calls).toEqual([[preferenceKey], [historyKey]]);
  expect(writes).not.toHaveBeenCalled();
  expect(removes).not.toHaveBeenCalled();
});
it("blocked preference removal keeps the page off and preserves records", () => {
  localStorage.setItem(preferenceKey, "true");
  localStorage.setItem(historyKey, JSON.stringify(saved));
  const view = mount();
  const reads = jest.spyOn(Storage.prototype, "getItem");
  const writes = jest.spyOn(Storage.prototype, "setItem");
  const removes = jest
    .spyOn(Storage.prototype, "removeItem")
    .mockImplementation(() => {
      throw new DOMException("blocked");
    });
  const toggle = options(view);
  fireEvent.click(toggle);
  expect(toggle.checked).toBe(false);
  expect(view.container.querySelector(".history-card")).toBeNull();
  expect(view.getByText(/Allow browser storage/)).toBeTruthy();
  expect(reads).not.toHaveBeenCalled();
  expect(writes).not.toHaveBeenCalled();
  expect(removes.mock.calls).toEqual([[preferenceKey]]);
});
it("saves successful uploads while currently enabled", async () => {
  const view = mount();
  fireEvent.click(options(view));
  fireEvent.click(view.getByRole("button", { name: "Done" }));
  fireEvent.paste(window, {
    clipboardData: { files: [], getData: () => "hello" },
  });
  await waitFor(() =>
    expect(localStorage.getItem(historyKey)).toContain("text.txt"),
  );
  expect(JSON.parse(localStorage.getItem(historyKey)!)[0]).toMatchObject({
    ...result,
    size: 4,
  });
});
it("does not save unsuccessful uploads while enabled", async () => {
  const view = mount();
  fireEvent.click(options(view));
  fireEvent.click(view.getByRole("button", { name: "Done" }));
  failUpload = true;
  const writes = jest.spyOn(Storage.prototype, "setItem");
  fireEvent.paste(window, {
    clipboardData: { files: [], getData: () => "hello" },
  });
  await waitFor(() => expect(view.getByRole("alert")).toBeTruthy());
  expect(writes).not.toHaveBeenCalled();
  expect(localStorage.getItem(historyKey)).toBeNull();
});
it("does not save completion after turning the toggle off", async () => {
  localStorage.setItem(historyKey, JSON.stringify(saved));
  const view = mount();
  fireEvent.click(options(view));
  fireEvent.click(view.getByRole("button", { name: "Done" }));
  deferUpload = true;
  fireEvent.paste(window, {
    clipboardData: { files: [], getData: () => "hello" },
  });
  const writes = jest.spyOn(Storage.prototype, "setItem");
  const reads = jest.spyOn(Storage.prototype, "getItem");
  const removes = jest.spyOn(Storage.prototype, "removeItem");
  fireEvent.click(options(view));
  finishUpload!();
  await waitFor(() =>
    expect(view.getByRole("button", { name: "Copy URL" })).toBeTruthy(),
  );
  expect(reads).not.toHaveBeenCalled();
  expect(writes).not.toHaveBeenCalled();
  expect(removes.mock.calls).toEqual([[preferenceKey]]);
});
it("blocked storage leaves the toggle usable and upload successful", async () => {
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("blocked");
  });
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("blocked");
  });
  const view = mount();
  const toggle = options(view);
  fireEvent.click(toggle);
  expect(toggle.checked).toBe(true);
  expect(view.getByText(/Allow browser storage/)).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Done" }));
  fireEvent.paste(window, {
    clipboardData: { files: [], getData: () => "hello" },
  });
  await waitFor(() =>
    expect(view.getByRole("button", { name: "Copy URL" })).toBeTruthy(),
  );
});
it("clear is an explicit enabled-only local action leaving session history untouched", () => {
  localStorage.setItem(historyKey, JSON.stringify(saved));
  sessionStorage.setItem(historyKey, JSON.stringify(saved));
  const view = mount();
  fireEvent.click(options(view));
  fireEvent.click(view.getByRole("button", { name: "Done" }));
  fireEvent.click(view.getByRole("button", { name: "Clear history" }));
  expect(localStorage.getItem(historyKey)).toBeNull();
  expect(sessionStorage.getItem(historyKey)).toBe(JSON.stringify(saved));
  expect(options(view).checked).toBe(true);
});
