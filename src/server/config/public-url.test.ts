import { afterEach, describe, expect, it } from "@jest/globals";

import { getPublicOrigin, getPublicUrl } from "./public-url";

const originalPublicOrigin = process.env.UP_PUBLIC_ORIGIN;

afterEach(() => {
  if (originalPublicOrigin === undefined) {
    delete process.env.UP_PUBLIC_ORIGIN;
    return;
  }

  process.env.UP_PUBLIC_ORIGIN = originalPublicOrigin;
});

describe("public URL config", () => {
  it("uses the local origin when no public origin is configured", () => {
    delete process.env.UP_PUBLIC_ORIGIN;

    expect(getPublicOrigin()).toBe("http://localhost:3000");
  });

  it("normalizes configured HTTP(S) origins", () => {
    process.env.UP_PUBLIC_ORIGIN = " https://up.example.test/some/path ";

    expect(getPublicOrigin()).toBe("https://up.example.test");
  });

  it("builds absolute public URLs from relative paths", () => {
    process.env.UP_PUBLIC_ORIGIN = "https://up.example.test";

    expect(getPublicUrl("/download/file-id")).toBe(
      "https://up.example.test/download/file-id",
    );
  });

  it("rejects non-HTTP public origins", () => {
    process.env.UP_PUBLIC_ORIGIN = "file:///tmp/up";

    expect(() => getPublicOrigin()).toThrow(
      "UP_PUBLIC_ORIGIN must be an absolute HTTP(S) URL.",
    );
  });
});
