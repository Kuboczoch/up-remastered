import type { UploadResult } from "./client-upload";

const STORAGE_KEY = "up-remastered:upload-history:v1";
const MAX_ENTRIES = 50;

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

export function readUploadHistory(
  storage: Pick<Storage, "getItem" | "removeItem" | "setItem">,
  now = Date.now(),
): UploadHistoryEntry[] {
  const stored = storage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Invalid upload history.");
    const entries = parsed
      .filter(isEntry)
      .filter((entry) => Date.parse(entry.expiresAt) > now)
      .slice(0, MAX_ENTRIES);
    storage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return entries;
  } catch {
    storage.removeItem(STORAGE_KEY);
    return [];
  }
}

export function saveUploadHistoryEntry(
  storage: Pick<Storage, "getItem" | "removeItem" | "setItem">,
  upload: UploadResult,
  now = Date.now(),
): UploadHistoryEntry[] {
  const entry = { ...upload, savedAt: new Date(now).toISOString() };
  const entries = [
    entry,
    ...readUploadHistory(storage, now).filter(({ id }) => id !== upload.id),
  ].slice(0, MAX_ENTRIES);
  storage.setItem(STORAGE_KEY, JSON.stringify(entries));
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
  storage.setItem(STORAGE_KEY, JSON.stringify(entries));
  return entries;
}
