import { describe, expect, it } from "@jest/globals";

import type { UploadResult } from "./client-upload";
import {
  readUploadHistory,
  removeUploadHistoryEntry,
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
});
