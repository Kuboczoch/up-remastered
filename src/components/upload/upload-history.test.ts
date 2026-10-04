import { describe, expect, it, jest } from "@jest/globals";
import type { UploadResult } from "./client-upload";
import {
  readUploadHistory,
  saveUploadHistoryEntry,
  removeUploadHistoryEntry,
  clearUploadHistory,
  confirmUploadHistoryStatus,
  UPLOAD_HISTORY_STORAGE_KEY as KEY,
} from "./upload-history";
const NOW = Date.parse("2026-01-01T00:00:00Z");
const upload: UploadResult = {
  accessToken: "token",
  id: "AAAAA",
  originalName: "private.txt",
  size: 5,
  expiresAt: "2025-01-01T00:00:00Z",
  shareUrl: "https://up.example/AAAAA",
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
  it.each(["deleted", "unavailable"] as const)(
    "persists confirmed %s without evicting metadata or changing other rows",
    (serverStatus) => {
      const target = storage();
      saveUploadHistoryEntry(target, upload, NOW);
      const before = saveUploadHistoryEntry(
        target,
        { ...upload, id: "BBBBB" },
        NOW,
      );
      const confirmed = confirmUploadHistoryStatus(
        target,
        upload.id,
        serverStatus,
        before,
      );
      expect(confirmed.persisted).toBe(true);
      expect(readUploadHistory(target)).toEqual([
        before[0],
        { ...before[1], serverStatus },
      ]);
      target.setItem.mockClear();
      readUploadHistory(target);
      expect(target.setItem).not.toHaveBeenCalled();
      expect(removeUploadHistoryEntry(target, upload.id)).toEqual([before[0]]);
    },
  );
  it("does not resurrect a removed record on confirmation", () => {
    const target = storage();
    const before = saveUploadHistoryEntry(target, upload, NOW);
    removeUploadHistoryEntry(target, upload.id);
    confirmUploadHistoryStatus(target, upload.id, "deleted", before);
    expect(readUploadHistory(target)).toEqual([]);
  });
  it("reports storage failure but retains the confirmed state in memory", () => {
    const target = storage();
    const before = saveUploadHistoryEntry(target, upload, NOW);
    target.setItem.mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(
      confirmUploadHistoryStatus(target, upload.id, "deleted", before),
    ).toEqual({
      entries: [{ ...before[0], serverStatus: "deleted" }],
      persisted: false,
    });
    expect(readUploadHistory(target)).toEqual(before);
  });
  it.each(["unknown", "live", null, { deleted: true }])(
    "does not interpret unrecognized status as confirmed: %s",
    (serverStatus) => {
      const target = storage(
        JSON.stringify([
          { ...upload, savedAt: new Date(NOW).toISOString(), serverStatus },
        ]),
      );
      expect(readUploadHistory(target)[0].serverStatus).toBeUndefined();
    },
  );
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
  it("never saves fragment keys or extra key properties", () => {
    const target = storage();
    const protectedUpload = {
      ...upload,
      shareUrl: "https://up.example/decrypt/AAAAA#key=SECRET",
      encryptionKey: "SECRET",
    };
    const [saved] = saveUploadHistoryEntry(target, protectedUpload, NOW);
    expect(saved.shareUrl).toBe("https://up.example/decrypt/AAAAA");
    expect(target.getItem()).not.toContain("SECRET");
    expect(saved).not.toHaveProperty("encryptionKey");
    expect(protectedUpload.shareUrl).toContain("#key=SECRET");
  });
  it("scrubs legacy stored fragments and extra key fields on enabled reads", () => {
    const legacy = {
      ...upload,
      shareUrl: "https://up.example/decrypt/AAAAA#key=SECRET",
      encryptionKey: "SECRET",
      savedAt: new Date(NOW).toISOString(),
    };
    const target = storage(JSON.stringify([legacy]));
    const [entry] = readUploadHistory(target);
    expect(entry.shareUrl).toBe("https://up.example/decrypt/AAAAA");
    expect(target.getItem()).not.toContain("SECRET");
    target.setItem.mockClear();
    expect(readUploadHistory(target)).toEqual([entry]);
    expect(target.setItem).not.toHaveBeenCalled();
  });
  it("failed legacy scrub writes still return fragment-free visible history", () => {
    const target = {
      getItem: () =>
        JSON.stringify([
          {
            ...upload,
            shareUrl: `${upload.shareUrl}#key=SECRET`,
            savedAt: new Date(NOW).toISOString(),
          },
        ]),
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readUploadHistory(target)[0].shareUrl).toBe(upload.shareUrl);
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
