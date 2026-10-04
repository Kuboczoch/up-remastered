import { afterEach, expect, it, jest } from "@jest/globals";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

jest.mock("./fetch-encrypted-file", () => ({ fetchEncryptedFile: jest.fn() }));
jest.mock("../upload/encryption", () => ({
  ...jest.requireActual<typeof import("../upload/encryption")>(
    "../upload/encryption",
  ),
  decryptFile: jest.fn(),
}));
const { DecryptExperience } = jest.requireActual<
  typeof import("./decrypt-experience")
>("./decrypt-experience");
const { decryptFile } = jest.requireMock<typeof import("../upload/encryption")>(
  "../upload/encryption",
);
const { fetchEncryptedFile } = jest.requireMock<
  typeof import("./fetch-encrypted-file")
>("./fetch-encrypted-file");
const fetchCiphertext = jest.mocked(fetchEncryptedFile);
const decryptCiphertext = jest.mocked(decryptFile);
const originalCrypto = globalThis.crypto;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
afterEach(() => {
  cleanup();
  jest.resetAllMocks();
  Object.defineProperty(globalThis, "crypto", {
    value: originalCrypto,
    configurable: true,
  });
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  window.history.replaceState(null, "", "/");
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function start() {
  Object.defineProperty(globalThis, "crypto", {
    value: { subtle: {} },
    configurable: true,
  });
  URL.createObjectURL = jest.fn(() => "blob:plaintext");
  URL.revokeObjectURL = jest.fn();
  window.history.replaceState(null, "", "/decrypt/A7K2Q#key=" + "A".repeat(43));
  render(<DecryptExperience id="A7K2Q" />);
  fireEvent.click(screen.getByRole("button", { name: "Decrypt file" }));
}
it("keeps fetch cancellation busy until settled, then permits a real subsequent retry", async () => {
  const pending = deferred<ArrayBuffer>();
  fetchCiphertext
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(new ArrayBuffer(1));
  decryptCiphertext.mockResolvedValue(new File(["original"], "original.txt"));
  start();
  const signal = fetchCiphertext.mock.calls[0][1]!;
  fireEvent.click(screen.getByRole("button", { name: "Cancel decryption" }));
  expect(signal.aborted).toBe(true);
  expect(
    (
      screen.getByRole("button", {
        name: /Downloading and decrypting/,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await act(async () =>
    pending.reject(new DOMException("Cancelled", "AbortError")),
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Decrypt file",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  expect(screen.queryByRole("alert")).toBeNull();
  expect(decryptCiphertext).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Decrypt file" }));
  await screen.findByRole("link", { name: "Save decrypted file" });
  expect(fetchCiphertext).toHaveBeenCalledTimes(2);
  expect(fetchCiphertext.mock.calls[1][1]?.aborted).toBe(false);
});
it.each(["resolve", "reject"] as const)(
  "keeps deferred crypto cancellation busy until %s, discards plaintext and retries retained ciphertext",
  async (settlement) => {
    const pending = deferred<File>();
    fetchCiphertext.mockResolvedValue(new ArrayBuffer(1));
    decryptCiphertext
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(new File(["original"], "original.txt"));
    start();
    await waitFor(() => expect(decryptCiphertext).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Cancel decryption" }));
    expect(
      (
        screen.getByRole("button", {
          name: /Downloading and decrypting/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Decryption key") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(screen.getByRole("status").textContent).toContain(
      "Cancelling decryption",
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Downloading and decrypting/ }),
    );
    expect(decryptCiphertext).toHaveBeenCalledTimes(1);
    await act(async () => {
      if (settlement === "resolve")
        pending.resolve(new File(["discard"], "cancelled.txt"));
      else pending.reject(new Error("Authentication failed"));
    });
    expect(
      screen.queryByRole("link", { name: "Save decrypted file" }),
    ).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Decrypt file" }));
    await screen.findByRole("link", { name: "Save decrypted file" });
    expect(decryptCiphertext).toHaveBeenCalledTimes(2);
    expect(fetchCiphertext).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  },
);
