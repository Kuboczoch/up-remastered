import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { copyLink } from "./copy-link";

const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
afterEach(() => {
  if (original) Object.defineProperty(navigator, "clipboard", original);
  else Reflect.deleteProperty(navigator, "clipboard");
});

function clipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value });
}

describe("copyLink", () => {
  it.each([undefined, {}, { writeText: undefined }])(
    "returns failure when the clipboard API is unavailable: %p",
    async (value) => {
      clipboard(value);
      expect(await copyLink("https://example.test/request/manage#secret")).toBe(
        false,
      );
    },
  );
  it("waits for successful writing and preserves the complete fragment", async () => {
    const writeText = jest.fn<(value: string) => Promise<void>>(async () => {});
    clipboard({ writeText });
    const value = "https://example.test/request/manage#secret";
    expect(await copyLink(value)).toBe(true);
    expect(writeText).toHaveBeenCalledWith(value);
  });
  it("handles asynchronous permission rejection without throwing", async () => {
    clipboard({
      writeText: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    });
    expect(await copyLink("link")).toBe(false);
  });
  it("handles synchronous browser failures without throwing", async () => {
    clipboard({
      writeText: () => {
        throw new Error("Unavailable");
      },
    });
    expect(await copyLink("link")).toBe(false);
  });
});
