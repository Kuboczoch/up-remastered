import { describe, expect, it, jest } from "@jest/globals";
import type { UploadResult } from "./client-upload";
import {
  readUploadHistory,
  saveUploadHistoryEntry,
  removeUploadHistoryEntry,
  clearUploadHistory,
  UPLOAD_HISTORY_STORAGE_KEY as KEY,
} from "./upload-history";
const NOW = Date.parse("2026-01-01T00:00:00Z");
const upload: UploadResult = {
  accessToken: "token",
  id: "AAAAA",
  originalName: "private.txt",
  size: 5,
  expiresAt: "2025-01-01T00:00:00Z",
  shareUrl: "https://up.example/AAAAA#key=SECRET",
};
function storage(value: string | null = null) {
  return {
    getItem: jest.fn(() => value),
    setItem: jest.fn((_key: string, next: string) => {
      value = next;
    }),
    removeItem: jest.fn((key: string) => {
      if (key === KEY) value = null;
    }),
  };
}
describe("upload history", () => {
  it("reads full metadata including expired entries without rewriting storage", () => {
    const entry = { ...upload, savedAt: new Date(NOW).toISOString() };
    const target = storage(JSON.stringify([entry]));
    expect(readUploadHistory(target)).toEqual([entry]);
    expect(target.setItem).not.toHaveBeenCalled();
    expect(target.removeItem).not.toHaveBeenCalled();
  });
  it.each(["{", "{}", '[{"id":"broken"}]'])(
    "leaves invalid storage untouched: %s",
    (value) => {
      const target = storage(value);
      expect(readUploadHistory(target)).toEqual([]);
      expect(target.setItem).not.toHaveBeenCalled();
      expect(target.removeItem).not.toHaveBeenCalled();
    },
  );
  it.each(["javascript:alert(1)", "data:text/plain,no", "not-url"])(
    "rejects unsafe URL %s without writes",
    (shareUrl) => {
      const target = storage(
        JSON.stringify([
          { ...upload, shareUrl, savedAt: new Date(NOW).toISOString() },
        ]),
      );
      expect(readUploadHistory(target)).toEqual([]);
      expect(target.setItem).not.toHaveBeenCalled();
    },
  );
  it.each([
    ["accessToken", ""],
    ["accessToken", 1],
    ["id", "bad"],
    ["id", 123],
    ["originalName", ""],
    ["originalName", null],
    ["size", -1],
    ["size", 1.5],
    ["size", "5"],
    ["expiresAt", "invalid"],
    ["savedAt", "invalid"],
    ["shareUrl", "javascript:alert(1)"],
  ])("requires complete correctly typed metadata: %s = %s", (field, value) => {
    const entry = {
      ...upload,
      savedAt: new Date(NOW).toISOString(),
      [field]: value,
    };
    const target = storage(JSON.stringify([entry]));
    expect(readUploadHistory(target)).toEqual([]);
    expect(target.setItem).not.toHaveBeenCalled();
    expect(target.removeItem).not.toHaveBeenCalled();
  });
  it.each(Object.keys({ ...upload, savedAt: "" }))(
    "rejects missing metadata field %s without writes",
    (field) => {
      const entry: Record<string, unknown> = {
        ...upload,
        savedAt: new Date(NOW).toISOString(),
      };
      delete entry[field];
      const target = storage(JSON.stringify([entry]));
      expect(readUploadHistory(target)).toEqual([]);
      expect(target.setItem).not.toHaveBeenCalled();
      expect(target.removeItem).not.toHaveBeenCalled();
    },
  );
  it("saves complete UploadResult with protected URL and timestamp, newest first", () => {
    const target = storage();
    saveUploadHistoryEntry(target, upload, NOW);
    const next = { ...upload, id: "BBBBB", originalName: "next.txt" };
    const entries = saveUploadHistoryEntry(target, next, NOW + 1);
    expect(entries).toEqual([
      { ...next, savedAt: new Date(NOW + 1).toISOString() },
      { ...upload, savedAt: new Date(NOW).toISOString() },
    ]);
    expect(JSON.parse(target.getItem()!)).toEqual(entries);
  });
  it("explicitly removes an entry or clears local records", () => {
    const target = storage();
    saveUploadHistoryEntry(target, upload, NOW);
    expect(removeUploadHistoryEntry(target, upload.id)).toEqual([]);
    expect(clearUploadHistory(target)).toBe(true);
    expect(target.removeItem).toHaveBeenCalledWith(KEY);
  });
  it("storage errors cannot break uploads", () => {
    const target = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readUploadHistory(target)).toEqual([]);
    expect(saveUploadHistoryEntry(target, upload, NOW)).toEqual([
      { ...upload, savedAt: new Date(NOW).toISOString() },
    ]);
    expect(clearUploadHistory(target)).toBe(false);
  });
});
