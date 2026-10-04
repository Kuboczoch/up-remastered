import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { getUploadLimits } from "@/server/config/uploads";

const names = ["DEFAULT_EXPIRATION_HOURS", "MAX_EXPIRATION_HOURS"] as const;
let original: Record<string, string | undefined>;
beforeEach(() => {
  original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.DEFAULT_EXPIRATION_HOURS = "168";
  process.env.MAX_EXPIRATION_HOURS = "168";
});
afterEach(() => {
  for (const name of names) {
    if (original[name] === undefined) delete process.env[name];
    else process.env[name] = original[name];
  }
});

describe("effective upload expiration configuration", () => {
  it("caps legacy week-long default and maximum configuration at 24 hours", () => {
    expect(getUploadLimits()).toMatchObject({
      defaultExpirationMs: 86400000,
      maxExpirationMs: 86400000,
    });
  });
  it("retains stricter deployment maxima and caps the default to them", () => {
    process.env.DEFAULT_EXPIRATION_HOURS = "3";
    process.env.MAX_EXPIRATION_HOURS = "3";
    expect(getUploadLimits()).toMatchObject({
      defaultExpirationMs: 10800000,
      maxExpirationMs: 10800000,
    });
  });
  it("retains a lower configured default", () => {
    process.env.DEFAULT_EXPIRATION_HOURS = "1";
    expect(getUploadLimits()).toMatchObject({
      defaultExpirationMs: 3600000,
      maxExpirationMs: 86400000,
    });
  });
});
