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
// Reads are deliberately read-only: invalid/expired data is never rewritten here.
export function readUploadHistory(
  storage: Pick<Storage, "getItem">,
): UploadHistoryEntry[] {
  try {
    const stored = storage.getItem(UPLOAD_HISTORY_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
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
    shareUrl: upload.shareUrl,
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
