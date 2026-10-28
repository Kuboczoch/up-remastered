import { afterEach, expect, it, jest } from "@jest/globals";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { NativeShare } from "./native-share";

const originalShare = Object.getOwnPropertyDescriptor(navigator, "share");
function installShare(share: unknown) {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: share,
  });
}
afterEach(() => {
  cleanup();
  if (originalShare) Object.defineProperty(navigator, "share", originalShare);
  else Reflect.deleteProperty(navigator, "share");
});
it("hides unsupported sharing without affecting adjacent Copy link", () => {
  installShare(undefined);
  const view = render(
    <>
      <NativeShare url="https://up.example/AAAAA" />
      <button>Copy link</button>
    </>,
  );
  expect(view.queryByRole("button", { name: "Share" })).toBeNull();
  expect(view.getByRole("button", { name: "Copy link" })).toBeTruthy();
});
it("shares only the exact selected public URL, including a current protected link", async () => {
  const share = jest.fn<NonNullable<Navigator["share"]>>().mockResolvedValue();
  installShare(share);
  const view = render(
    <>
      <NativeShare url="https://up.example/AAAAA" />
      <NativeShare url="https://up.example/decrypt/BBBBB#key=secret_key" />
    </>,
  );
  fireEvent.click(view.getAllByRole("button", { name: "Share" })[1]);
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  expect(share).toHaveBeenCalledWith({
    title: "Shared file",
    text: "Download this file using the link.",
    url: "https://up.example/decrypt/BBBBB#key=secret_key",
  });
});
it.each([
  "https://up.example/request/manage/secret",
  "https://up.example/AAAAA?token=secret",
  "https://up.example/AAAAA#owner=secret",
  "https://user:secret@up.example/AAAAA",
])("rejects capability-bearing or non-public URL %s", (url) => {
  installShare(jest.fn());
  expect(render(<NativeShare url={url} />).queryByRole("button")).toBeNull();
});
it("treats AbortError silently and blocks duplicate pending gestures", async () => {
  let reject!: (reason: unknown) => void;
  const share = jest.fn<NonNullable<Navigator["share"]>>(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
  );
  installShare(share);
  const view = render(<NativeShare url="https://up.example/AAAAA" />);
  const button = view.getByRole("button", { name: "Share" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(share).toHaveBeenCalledTimes(1);
  reject(new DOMException("private detail", "AbortError"));
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  );
  expect(view.queryByRole("status")).toBeNull();
});
it("reports genuine failure accessibly without exposing rejection details", async () => {
  installShare(
    jest
      .fn<NonNullable<Navigator["share"]>>()
      .mockRejectedValue(new Error("owner-secret")),
  );
  const view = render(<NativeShare url="https://up.example/AAAAA" />);
  fireEvent.click(view.getByRole("button", { name: "Share" }));
  await waitFor(() =>
    expect(view.getByRole("status").textContent).toContain("Copy link"),
  );
  expect(view.container.textContent).not.toContain("owner-secret");
});
