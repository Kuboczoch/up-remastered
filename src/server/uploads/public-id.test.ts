import { describe, expect, it } from "@jest/globals";

import {
  createPublicUploadId,
  isPublicUploadId,
} from "@/server/uploads/public-id";

describe("public upload IDs", () => {
  it("generates exactly five uppercase alphanumeric characters", () => {
    for (let index = 0; index < 100; index += 1) {
      expect(createPublicUploadId()).toMatch(/^[0-9A-Z]{5}$/);
    }
  });

  it.each(["ABCDE", "0129Z"])("accepts %s", (id) => {
    expect(isPublicUploadId(id)).toBe(true);
  });

  it.each(["", "ABCD", "ABCDEF", "abcdE", "ABC-E", "ABC E"])(
    "rejects %s",
    (id) => {
      expect(isPublicUploadId(id)).toBe(false);
    },
  );
});
