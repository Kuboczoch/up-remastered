import type { UploadResult } from "./client-upload";

export const UPLOAD_HISTORY_STORAGE_KEY = "up-remastered:upload-history:v1";
const STORAGE_KEY = UPLOAD_HISTORY_STORAGE_KEY;
const MAX_ENTRIES = 50;

function safeGet(storage: Pick<Storage, "getItem">): string | null {
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeSet(
  storage: Pick<Storage, "setItem">,
  entries: UploadHistoryEntry[],
): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    // History is optional; uploads must work when storage is unavailable.
    return false;
  }
}

function safeRemove(storage: Pick<Storage, "removeItem">): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export type UploadHistoryEntry = UploadResult & {
  savedAt: string;
};

function isUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isEntry(value: unknown): value is UploadHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<UploadHistoryEntry>;
  return (
    typeof entry.accessToken === "string" &&
    entry.accessToken.length > 0 &&
    typeof entry.expiresAt === "string" &&
    Number.isFinite(Date.parse(entry.expiresAt)) &&
    typeof entry.id === "string" &&
    /^[0-9A-Z]{5}$/.test(entry.id) &&
    typeof entry.originalName === "string" &&
    entry.originalName.length > 0 &&
    typeof entry.savedAt === "string" &&
    Number.isFinite(Date.parse(entry.savedAt)) &&
    isUrl(entry.shareUrl) &&
    typeof entry.size === "number" &&
    Number.isSafeInteger(entry.size) &&
    entry.size >= 0
  );
}

function normalizeEntries(
  values: unknown[],
  now: number,
): UploadHistoryEntry[] {
  const seen = new Set<string>();
  return values
    .filter(isEntry)
    .map((entry) => {
      const url = new URL(entry.shareUrl);
      url.hash = "";
      return { ...entry, shareUrl: url.toString() };
    })
    .filter((entry) => Date.parse(entry.expiresAt) > now)
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt))
    .filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    })
    .slice(0, MAX_ENTRIES);
}

export function readUploadHistory(
  storage: Pick<Storage, "getItem" | "removeItem" | "setItem">,
  now = Date.now(),
): UploadHistoryEntry[] {
  const stored = safeGet(storage);
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Invalid upload history.");
    const entries = normalizeEntries(parsed, now);
    if (stored !== JSON.stringify(entries)) safeSet(storage, entries);
    return entries;
  } catch {
    safeRemove(storage);
    return [];
  }
}

export function saveUploadHistoryEntry(
  storage: Pick<Storage, "getItem" | "removeItem" | "setItem">,
  upload: UploadResult,
  now = Date.now(),
): UploadHistoryEntry[] {
  const entry = { ...upload, savedAt: new Date(now).toISOString() };
  const entries = normalizeEntries(
    [entry, ...readUploadHistory(storage, now)],
    now,
  );
  safeSet(storage, entries);
  return entries;
}

export function restoreUploadHistory(
  persistentStorage: Pick<Storage, "getItem" | "removeItem" | "setItem">,
  legacyStorage: Pick<Storage, "getItem" | "removeItem" | "setItem">,
  now = Date.now(),
  consent = false,
): UploadHistoryEntry[] {
  // Scrub fragment secrets even when persistence has not been authorized.
  if (!consent) {
    readUploadHistory(persistentStorage, now);
    readUploadHistory(legacyStorage, now);
    return [];
  }
  const persisted = readUploadHistory(persistentStorage, now);
  const legacy = readUploadHistory(legacyStorage, now);
  if (legacy.length === 0) return persisted;

  const entries = normalizeEntries([...persisted, ...legacy], now);
  if (safeSet(persistentStorage, entries)) {
    safeRemove(legacyStorage);
  }
  return entries;
}

export function removeUploadHistoryEntry(
  storage: Pick<Storage, "getItem" | "removeItem" | "setItem">,
  id: string,
  now = Date.now(),
): UploadHistoryEntry[] {
  const entries = readUploadHistory(storage, now).filter(
    (entry) => entry.id !== id,
  );
  safeSet(storage, entries);
  return entries;
}
