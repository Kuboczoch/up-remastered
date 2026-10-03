import { expect, test } from "@jest/globals";
import {
  saveUploadHistoryEntry,
  readUploadHistory,
  restoreUploadHistory,
} from "./upload-history";

test("protected keys never persist and legacy fragments are scrubbed", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const entry = {
    accessToken: "delete-token",
    id: "AAAAA",
    originalName: "private.txt",
    size: 2,
    expiresAt: "2099-01-01T00:00:00Z",
    shareUrl: "https://up.example/decrypt/AAAAA#key=SECRET",
  };
  const saved = saveUploadHistoryEntry(storage, entry);
  expect(saved[0].shareUrl).toBe("https://up.example/decrypt/AAAAA");
  expect([...values.values()].join()).not.toContain("SECRET");
  storage.setItem(
    "up-remastered:upload-history:v1",
    JSON.stringify([{ ...entry, savedAt: new Date().toISOString() }]),
  );
  expect(readUploadHistory(storage)[0].shareUrl).not.toContain("#");
  expect([...values.values()].join()).not.toContain("SECRET");
});

test("default-off restoration preserves legacy without persisting and scrubs keys", () => {
  const makeStorage = () => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
  };
  const local = makeStorage();
  const session = makeStorage();
  const key = "up-remastered:upload-history:v1";
  session.setItem(
    key,
    JSON.stringify([
      {
        accessToken: "token",
        id: "AAAAA",
        originalName: "legacy.txt",
        size: 2,
        expiresAt: "2099-01-01T00:00:00Z",
        savedAt: "2026-01-01T00:00:00Z",
        shareUrl: "https://up.example/decrypt/AAAAA#key=SECRET",
      },
    ]),
  );
  expect(restoreUploadHistory(local, session)).toEqual([]);
  expect(local.getItem(key)).toBeNull();
  expect(session.getItem(key)).toContain("legacy.txt");
  expect(session.getItem(key)).not.toContain("SECRET");
});
