import { describe, expect, it } from "@jest/globals";

import type { UploadResult } from "./client-upload";
import {
  readUploadHistory,
  removeUploadHistoryEntry,
  restoreUploadHistory,
  saveUploadHistoryEntry,
} from "./upload-history";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");

function upload(
  id: string,
  overrides: Partial<UploadResult> = {},
): UploadResult {
  return {
    accessToken: `token-${id}`,
    expiresAt: "2026-01-02T00:00:00.000Z",
    id,
    originalName: `${id}.txt`,
    shareUrl: `https://up.example/${id}`,
    size: 5,
    ...overrides,
  };
}

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  };
}

describe("upload history", () => {
  it("stores newest uploads first and replaces duplicate IDs", () => {
    const target = storage();
    saveUploadHistoryEntry(target, upload("AAAAA"), NOW);
    saveUploadHistoryEntry(
      target,
      upload("BBBBB", { originalName: "new.txt" }),
      NOW + 1,
    );
    const entries = saveUploadHistoryEntry(
      target,
      upload("AAAAA", { originalName: "updated.txt" }),
      NOW + 2,
    );

    expect(entries.map(({ id }) => id)).toEqual(["AAAAA", "BBBBB"]);
    expect(entries[0].originalName).toBe("updated.txt");
  });

  it("prunes expired, malformed, and excess entries", () => {
    const target = storage();
    const entries = Array.from({ length: 55 }, (_, index) => ({
      ...upload(index.toString(36).toUpperCase().padStart(5, "0")),
      savedAt: new Date(NOW + index).toISOString(),
    }));
    entries.splice(2, 0, {
      ...upload("ZZZZZ", { expiresAt: "2025-01-01T00:00:00Z" }),
      savedAt: new Date(NOW).toISOString(),
    });
    entries.splice(3, 0, {
      ...upload("YYYYY", { shareUrl: "javascript:alert(1)" }),
      savedAt: new Date(NOW).toISOString(),
    });
    target.setItem(
      "up-remastered:upload-history:v1",
      JSON.stringify([...entries, { id: "broken" }]),
    );

    const result = readUploadHistory(target, NOW);
    expect(result).toHaveLength(50);
    expect(result.some(({ id }) => id === "ZZZZZ")).toBe(false);
    expect(result.some(({ id }) => id === "YYYYY")).toBe(false);
  });

  it("prunes entries exactly at the expiry boundary and deduplicates IDs", () => {
    const target = storage();
    target.setItem(
      "up-remastered:upload-history:v1",
      JSON.stringify([
        {
          ...upload("AAAAA", { expiresAt: new Date(NOW).toISOString() }),
          savedAt: new Date(NOW + 3).toISOString(),
        },
        {
          ...upload("BBBBB"),
          savedAt: new Date(NOW + 2).toISOString(),
        },
        {
          ...upload("BBBBB", { originalName: "older.txt" }),
          savedAt: new Date(NOW + 1).toISOString(),
        },
      ]),
    );

    expect(readUploadHistory(target, NOW)).toMatchObject([
      { id: "BBBBB", originalName: "BBBBB.txt" },
    ]);
  });

  it("migrates and merges session history once without duplicate IDs", () => {
    const persistent = storage();
    const legacy = storage();
    saveUploadHistoryEntry(persistent, upload("AAAAA"), NOW);
    saveUploadHistoryEntry(
      legacy,
      upload("AAAAA", { originalName: "newer.txt" }),
      NOW + 2,
    );
    saveUploadHistoryEntry(legacy, upload("BBBBB"), NOW + 1);

    expect(restoreUploadHistory(persistent, legacy, NOW, true)).toMatchObject([
      { id: "AAAAA", originalName: "newer.txt" },
      { id: "BBBBB" },
    ]);
    expect(legacy.values.size).toBe(0);
    expect(restoreUploadHistory(persistent, legacy, NOW, true)).toHaveLength(2);
  });

  it("retains legacy history when persistent migration storage fails", () => {
    const legacy = storage();
    saveUploadHistoryEntry(legacy, upload("AAAAA"), NOW);
    const unavailable = {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new DOMException("quota exceeded");
      },
    };

    expect(restoreUploadHistory(unavailable, legacy, NOW, true)).toMatchObject([
      { id: "AAAAA" },
    ]);
    expect(legacy.values.size).toBe(1);
  });

  it("rejects unsupported storage schemas", () => {
    const target = storage();
    target.setItem(
      "up-remastered:upload-history:v1",
      JSON.stringify({ version: 2, entries: [] }),
    );

    expect(readUploadHistory(target, NOW)).toEqual([]);
    expect(target.values.size).toBe(0);
  });

  it("removes corrupt JSON rather than throwing", () => {
    const target = storage();
    target.setItem("up-remastered:upload-history:v1", "{");

    expect(readUploadHistory(target, NOW)).toEqual([]);
    expect(target.values.size).toBe(0);
  });

  it("removes one upload without affecting others", () => {
    const target = storage();
    saveUploadHistoryEntry(target, upload("AAAAA"), NOW);
    saveUploadHistoryEntry(target, upload("BBBBB"), NOW);

    expect(removeUploadHistoryEntry(target, "AAAAA", NOW)).toMatchObject([
      { id: "BBBBB" },
    ]);
  });

  it("degrades gracefully when browser storage is unavailable", () => {
    const unavailable = {
      getItem: () => {
        throw new DOMException("blocked");
      },
      removeItem: () => {
        throw new DOMException("blocked");
      },
      setItem: () => {
        throw new DOMException("blocked");
      },
    };

    expect(readUploadHistory(unavailable, NOW)).toEqual([]);
    expect(
      saveUploadHistoryEntry(unavailable, upload("AAAAA"), NOW),
    ).toMatchObject([{ id: "AAAAA" }]);
    expect(removeUploadHistoryEntry(unavailable, "AAAAA", NOW)).toEqual([]);
  });
});
