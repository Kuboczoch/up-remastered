import { describe, expect, it } from "@jest/globals";
import { resolveUploadExpiration } from "@/server/uploads/expiration";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-01-01T00:00:00.000Z");
const limits = {
  defaultExpirationMs: 48 * HOUR,
  maxExpirationMs: 72 * HOUR,
  maxStoredBytes: 1024,
  maxUploadBytes: 128,
};
const resolve = (fields: Record<string, string | undefined>) =>
  resolveUploadExpiration(
    new Map(
      Object.entries(fields).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ),
    limits,
    now,
  );

describe("24-hour expiration policy", () => {
  it("caps defaults even with legacy configuration", () => {
    expect(resolve({}).getTime() - now.getTime()).toBe(24 * HOUR);
  });
  it.each([1, 3, 6, 12, 24])("accepts the %s-hour browser choice", (hours) => {
    expect(
      resolve({ expiresInHours: String(hours) }).getTime() - now.getTime(),
    ).toBe(hours * HOUR);
  });
  it.each([
    { expiresInHours: "25" },
    { expiresInMinutes: "1441" },
    { expiresInSeconds: "86401" },
    { expiresAt: "2026-01-02T00:00:00.001Z" },
  ])("rejects over-24-hour legacy expiration %j", (fields) => {
    expect(() => resolve(fields)).toThrow("maximum");
  });
  it.each([
    { expiresInMinutes: "90" },
    { expiresInSeconds: "5400" },
    { expiresInHours: "1.5" },
  ])("retains legacy short durations %j", (fields) => {
    expect(resolve(fields).getTime() - now.getTime()).toBe(1.5 * HOUR);
  });
  it.each(["", " ", "0", "-1", "1e0", "0x1", "NaN", "Infinity"])(
    "rejects malformed duration %j",
    (value) => {
      expect(() => resolve({ expiresInHours: value })).toThrow(
        "positive number",
      );
    },
  );
  it("rejects a supplied empty absolute date", () => {
    expect(() => resolve({ expiresAt: "" })).toThrow("valid future");
  });
  it("rejects ambiguous absolute and duration fields", () => {
    expect(() =>
      resolve({ expiresAt: "2026-01-02T00:00:00.000Z", expiresInHours: "1" }),
    ).toThrow("only one");
  });
  it("rejects normalized invalid calendar dates", () => {
    const february = new Date("2026-02-28T00:00:00.000Z");
    expect(() =>
      resolveUploadExpiration(
        new Map([["expiresAt", "2026-02-29T00:00:00Z"]]),
        limits,
        february,
      ),
    ).toThrow("valid future");
  });
});
