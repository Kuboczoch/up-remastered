import { afterEach, expect, it, jest } from "@jest/globals";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { UploadExperience } from "./upload-experience";
const originalXHR = global.XMLHttpRequest;
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
    queueMicrotask(() => this.listeners.get("load")?.());
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
  "uses selected encoding for the %s text path and retains it across modes",
  async (path) => {
    const view = mount();
    fireEvent.click(view.getByRole("tab", { name: /^Text$/ }));
    fireEvent.click(view.getByRole("button", { name: /Advanced options/ }));
    const select = view.getByLabelText("Text encoding") as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    fireEvent.change(select, { target: { value: "utf-16be" } });
    fireEvent.click(view.getByRole("button", { name: "Done" }));
    fireEvent.click(view.getByRole("tab", { name: /^File$/ }));
    fireEvent.click(view.getByRole("tab", { name: /^Text$/ }));
    fireEvent.click(view.getByRole("button", { name: /Advanced options/ }));
    expect(
      (view.getByLabelText("Text encoding") as HTMLSelectElement).value,
    ).toBe("utf-16be");
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
    expect(file.type).toBe("text/plain;charset=utf-16be");
    const bytes = await new Promise<number[]>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(Array.from(new Uint8Array(reader.result as ArrayBuffer)));
      reader.readAsArrayBuffer(file);
    });
    expect(bytes).toEqual([0, 65, 0, 233]);
  },
);
