import { describe, expect, it } from "@jest/globals";

import {
  formatBytes,
  formatLocalDateTime,
  formatRelativeExpiry,
  parseByteQuantity,
} from "./format";

describe("human-friendly formatters", () => {
  it.each([
    [0, "0 B"],
    [1, "1 B"],
    [1023, "1,023 B"],
    [1024, "1 KiB"],
    [1536, "1.5 KiB"],
    [1024 ** 2, "1 MiB"],
    [5 * 1024 ** 3, "5 GiB"],
  ])("formats %i bytes with IEC boundaries", (bytes, expected) => {
    expect(formatBytes(bytes, "en-US")).toBe(expected);
  });

  it("rejects invalid byte values", () => {
    expect(() => formatBytes(-1)).toThrow(RangeError);
    expect(() => formatBytes(1.5)).toThrow(RangeError);
    expect(() => formatBytes(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it("converts unit quantities to exact safe integer bytes", () => {
    expect(parseByteQuantity("1", "B", 1024)).toBe(1);
    expect(parseByteQuantity("1", "KiB", 1024)).toBe(1024);
    expect(parseByteQuantity("0.5", "KiB", 1024)).toBe(512);
    expect(() => parseByteQuantity("0.1", "B", 1024)).toThrow("whole number");
    expect(() => parseByteQuantity("1.1", "KiB", 1024)).toThrow(RangeError);
    expect(() => parseByteQuantity("1e3", "B", 1024)).toThrow(RangeError);
  });

  it("uses stable relative boundaries and supports locales", () => {
    const now = Date.parse("2026-01-01T00:00:00.000Z");
    expect(formatRelativeExpiry(now, now, "en-US")).toBe("expired");
    expect(formatRelativeExpiry(now + 1, now, "en-US")).toBe("in 1 minute");
    expect(formatRelativeExpiry(now + 60 * 60_000, now, "en-US")).toBe(
      "in 1 hour",
    );
    expect(formatRelativeExpiry(now + 24 * 60 * 60_000, now, "pl-PL")).toBe(
      "za 1 dzień",
    );
  });

  it("formats the same instant in explicit local time zones", () => {
    const instant = "2026-01-01T12:00:00.000Z";
    expect(formatLocalDateTime(instant, "en-US", "UTC")).toBe(
      "Jan 1, 2026, 12:00 PM",
    );
    expect(formatLocalDateTime(instant, "en-US", "America/New_York")).toBe(
      "Jan 1, 2026, 7:00 AM",
    );
  });
});
