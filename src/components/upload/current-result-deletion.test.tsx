import { afterEach, expect, it, jest } from "@jest/globals";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { CurrentResultDeletion } from "./current-result-deletion";

const originalFetch = global.fetch;
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});
function mount() {
  return render(
    <section>
      <CurrentResultDeletion
        id="ABCDE"
        accessToken="owner"
        name="private.txt"
        onStartAnother={() => {}}
      >
        <button>Copy URL</button>
        <a href="https://up.example/ABCDE#key=secret">Open file</a>
        <button>Show QR code</button>
      </CurrentResultDeletion>
    </section>,
  );
}
it("offers deletion without storage, guards cancellation, traps focus and returns it", () => {
  global.fetch = jest.fn<typeof fetch>();
  const writes = jest.spyOn(Storage.prototype, "setItem");
  const view = mount();
  const trigger = view.getByRole("button", { name: "Delete file" });
  fireEvent.click(trigger);
  expect(view.getByRole("dialog").textContent).toContain("sharing links");
  const cancel = view.getByRole("button", { name: "Cancel" });
  expect(document.activeElement).toBe(cancel);
  fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(
    view.getByRole("button", { name: "Permanently delete file" }),
  );
  fireEvent.keyDown(document.activeElement!, { key: "Tab" });
  expect(document.activeElement).toBe(cancel);
  fireEvent.click(cancel);
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  fireEvent.keyDown(view.getByRole("dialog"), { key: "Escape" });
  expect(view.queryByRole("dialog")).toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(writes).not.toHaveBeenCalled();
});
it("confirms once with only the owner capability and removes all sharing on success", async () => {
  let finish!: (response: Response) => void;
  global.fetch = jest.fn<typeof fetch>(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const writes = jest.spyOn(Storage.prototype, "setItem");
  const view = mount();
  fireEvent.click(view.getByRole("button", { name: "Delete file" }));
  const confirm = view.getByRole("button", { name: "Permanently delete file" });
  act(() => {
    fireEvent.click(confirm);
    fireEvent.click(confirm);
  });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith("/api/u/ABCDE", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessToken: "owner" }),
  });
  fireEvent.keyDown(view.getByRole("dialog"), { key: "Escape" });
  expect(view.getByRole("dialog")).toBeTruthy();
  await act(async () => {
    finish({ status: 200, text: async () => "" } as Response);
  });
  expect(view.getByText("Deleted")).toBeTruthy();
  expect(view.queryByRole("button", { name: "Copy URL" })).toBeNull();
  expect(view.queryByRole("link")).toBeNull();
  expect(view.queryByRole("button", { name: "Show QR code" })).toBeNull();
  expect(document.activeElement).toBe(view.container.querySelector("section"));
  expect(writes).not.toHaveBeenCalled();
});
it.each([403, 404, 500, 204, 202, "proxy", "network", "abort"])(
  "preserves protected sharing and retry capability after %s",
  async (failure) => {
    global.fetch = jest.fn<typeof fetch>(async () => {
      if (failure === "network") throw new TypeError("offline");
      if (failure === "abort") throw new DOMException("Aborted", "AbortError");
      return {
        status: failure === "proxy" ? 200 : failure,
        text: async () => (failure === "proxy" ? "<html>proxy</html>" : ""),
      } as Response;
    });
    const view = mount();
    fireEvent.click(view.getByRole("button", { name: "Delete file" }));
    fireEvent.click(
      view.getByRole("button", { name: "Permanently delete file" }),
    );
    await waitFor(() => expect(view.getByRole("alert")).toBeTruthy());
    expect(view.getByRole("link").getAttribute("href")).toBe(
      "https://up.example/ABCDE#key=secret",
    );
    expect(view.getByRole("button", { name: "Copy URL" })).toBeTruthy();
    global.fetch = jest.fn<typeof fetch>(
      async () => ({ status: 200, text: async () => "" }) as Response,
    );
    fireEvent.click(
      view.getByRole("button", { name: "Permanently delete file" }),
    );
    await waitFor(() => expect(view.getByText("Deleted")).toBeTruthy());
  },
);
