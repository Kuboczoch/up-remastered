import type { UploadResult } from "./client-upload";
export const UPLOAD_HISTORY_STORAGE_KEY = "up-remastered:upload-history:v1";
export type UploadHistoryEntry = UploadResult & { savedAt: string };
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
function safeSet(
  storage: Pick<Storage, "setItem">,
  entries: UploadHistoryEntry[],
): void {
  try {
    storage.setItem(UPLOAD_HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* Optional history must not break uploads. */
  }
}
function publicHistoryEntry(entry: UploadHistoryEntry): UploadHistoryEntry {
  return {
    accessToken: entry.accessToken,
    id: entry.id,
    originalName: entry.originalName,
    size: entry.size,
    expiresAt: entry.expiresAt,
    shareUrl: entry.shareUrl.split("#", 1)[0],
    savedAt: entry.savedAt,
  };
}
// Ordinary reads are read-only. Enabled history strips legacy fragment keys and
// unallowlisted properties, a narrow security exception rather than migration.

export function readUploadHistory(
  storage: Pick<Storage, "getItem"> & Partial<Pick<Storage, "setItem">>,
): UploadHistoryEntry[] {
  try {
    const stored = storage.getItem(UPLOAD_HISTORY_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    const sanitized = parsed.map((entry: unknown) =>
      isEntry(entry) ? publicHistoryEntry(entry) : entry,
    );
    const needsScrubbing = parsed.some(
      (entry: unknown, index: number) =>
        isEntry(entry) &&
        (entry.shareUrl.includes("#") ||
          Object.keys(entry).some(
            (key) => !Object.hasOwn(sanitized[index] as object, key),
          )),
    );
    if (storage.setItem && needsScrubbing) {
      try {
        storage.setItem(UPLOAD_HISTORY_STORAGE_KEY, JSON.stringify(sanitized));
      } catch {
        // Storage failures must not expose keys in the visible history.
      }
    }
    return sanitized.filter(isEntry);
  } catch {
    return [];
  }
}
export function saveUploadHistoryEntry(
  storage: Pick<Storage, "getItem" | "setItem">,
  upload: UploadResult,
  now = Date.now(),
): UploadHistoryEntry[] {
  // Enumerate complete metadata, never uploaded File/Blob payloads.
  const entry: UploadHistoryEntry = {
    accessToken: upload.accessToken,
    id: upload.id,
    originalName: upload.originalName,
    size: upload.size,
    expiresAt: upload.expiresAt,
    shareUrl: upload.shareUrl.split("#", 1)[0],
    savedAt: new Date(now).toISOString(),
  };
  const existing = readUploadHistory(storage);
  if (!isEntry(entry)) return existing;
  const entries = [entry, ...existing];
  safeSet(storage, entries);
  return entries;
}
export function removeUploadHistoryEntry(
  storage: Pick<Storage, "getItem" | "setItem">,
  id: string,
): UploadHistoryEntry[] {
  const entries = readUploadHistory(storage).filter((entry) => entry.id !== id);
  safeSet(storage, entries);
  return entries;
}
export function clearUploadHistory(
  storage: Pick<Storage, "removeItem">,
): boolean {
  try {
    storage.removeItem(UPLOAD_HISTORY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
