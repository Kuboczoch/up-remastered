import { describe, expect, it } from "@jest/globals";

import {
  createUploadAccessToken,
  hashUploadAccessToken,
  matchesUploadAccessToken,
} from "./access-token";

describe("upload access tokens", () => {
  it("creates opaque 512-bit tokens compatible with the upstream length", () => {
    const first = createUploadAccessToken();
    const second = createUploadAccessToken();

    expect(first).toMatch(/^[0-9a-f]{128}$/);
    expect(second).toMatch(/^[0-9a-f]{128}$/);
    expect(second).not.toBe(first);
  });

  it("stores and compares only a fixed-length hash", () => {
    const token = "a".repeat(128);
    const hash = hashUploadAccessToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(matchesUploadAccessToken(token, hash)).toBe(true);
    expect(matchesUploadAccessToken("b".repeat(128), hash)).toBe(false);
    expect(matchesUploadAccessToken(token, "invalid")).toBe(false);
  });
});
