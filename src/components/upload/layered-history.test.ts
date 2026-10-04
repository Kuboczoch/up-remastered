import { expect, test, jest } from "@jest/globals";
import {
  saveUploadHistoryEntry,
  readUploadHistory,
  restoreUploadHistory,
} from "./upload-history";

test("URL fragments never persist and legacy fragments are scrubbed", () => {
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
    shareUrl: "https://up.example/AAAAA#fragment=SECRET",
  };
  const saved = saveUploadHistoryEntry(storage, entry);
  expect(saved[0].shareUrl).toBe("https://up.example/AAAAA");
  expect([...values.values()].join()).not.toContain("SECRET");
  storage.setItem(
    "up-remastered:upload-history:v1",
    JSON.stringify([{ ...entry, savedAt: new Date().toISOString() }]),
  );
  expect(readUploadHistory(storage)[0].shareUrl).not.toContain("#");
  expect([...values.values()].join()).not.toContain("SECRET");
});

test("default-off restoration does not read, restore, migrate or mutate legacy", () => {
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
        shareUrl: "https://up.example/AAAAA#fragment=SECRET",
      },
    ]),
  );
  expect(restoreUploadHistory(local, session)).toEqual([]);
  expect(local.getItem(key)).toBeNull();
  expect(session.getItem(key)).toContain("legacy.txt");
  expect(session.getItem(key)).toContain("SECRET");
});

test("without consent restoration never touches either storage", () => {
  const blocked = {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  };
  expect(restoreUploadHistory(blocked, blocked)).toEqual([]);
  expect(blocked.getItem).not.toHaveBeenCalled();
  expect(blocked.setItem).not.toHaveBeenCalled();
  expect(blocked.removeItem).not.toHaveBeenCalled();
});

test("history whitelist excludes unexpected key material", () => {
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
  const upload = {
    accessToken: "token",
    id: "AAAAA",
    originalName: "secret.txt",
    size: 1,
    expiresAt: "2099-01-01T00:00:00Z",
    shareUrl: "https://up.example/protected/AAAAA#key=SECRET",
    key: "SECRET",
  };
  saveUploadHistoryEntry(storage, upload);
  expect([...values.values()].join()).not.toContain("SECRET");
});
