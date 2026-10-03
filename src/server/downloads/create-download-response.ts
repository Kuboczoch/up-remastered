import "server-only";

import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { Readable } from "node:stream";

import { createDbClient, createSqliteConnection } from "@/server/db/client";
import { ensureDatabaseMigrated } from "@/server/db/migrate";
import { claimUploadDownload, getUploadMetadata } from "@/server/db/uploads";
import { classifyUploadContent } from "@/server/downloads/classify-upload-content";
import {
  resolveStoredUploadPath,
  sanitizeOriginalName,
} from "@/server/storage/uploads";
import { isPublicUploadId } from "@/server/uploads/public-id";

const OPEN_RANGE_CHUNK_BYTES = 4 * 1024 * 1024;
const INLINE_CONTENT_SECURITY_POLICY = "sandbox; default-src 'none'";
const UNAVAILABLE_BODY = "File unavailable.\n";

type ByteRange = { end: number; start: number };

function unavailableResponse(): Response {
  return new Response(UNAVAILABLE_BODY, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
    status: 404,
  });
}

function extendedFileName(originalName: string): string {
  const candidate = originalName
    .replaceAll("\\", "/")
    .split("/")
    .at(-1)
    ?.trim();

  if (!candidate || candidate === "." || candidate === "..") {
    return "upload";
  }

  return candidate
    .replaceAll(/[\u0000-\u001f\u007f]/g, "_")
    .replace(/^\.+/, "_");
}

function encodeRfc5987Value(value: string): string {
  return [...Buffer.from(value, "utf8")]
    .map((byte) => {
      const character = String.fromCharCode(byte);
      return /^[!#$&+.^_`|~0-9A-Za-z-]$/.test(character)
        ? character
        : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    })
    .join("");
}

function contentDisposition(
  originalName: string,
  disposition: "attachment" | "inline",
): string {
  const fallbackFileName = sanitizeOriginalName(originalName);
  const encodedFileName = encodeRfc5987Value(extendedFileName(originalName));

  return `${disposition}; filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`;
}

function parseByteRange(
  header: string | null,
  size: number,
): ByteRange | "unsatisfiable" | null {
  if (!header || header.includes(",")) {
    return null;
  }

  const match = header.match(/^bytes=(\d+)-(\d*)$/i);

  if (!match) {
    return null;
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : undefined;

  if (!Number.isSafeInteger(start) || start >= size) {
    return "unsatisfiable";
  }

  if (
    requestedEnd !== undefined &&
    (!Number.isSafeInteger(requestedEnd) || requestedEnd < start)
  ) {
    return null;
  }

  const end = Math.min(
    requestedEnd ?? start + OPEN_RANGE_CHUNK_BYTES - 1,
    size - 1,
  );

  return { end, start };
}

function isUnavailableFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ["EACCES", "ELOOP", "ENOENT", "ENOTDIR"].includes(
      String((error as NodeJS.ErrnoException).code),
    )
  );
}

async function createFileResponse(
  id: string,
  rangeHeader: string | null,
  now: Date,
  includeBody: boolean,
  forceDownload: boolean,
): Promise<Response> {
  const requestStartedAt = Date.now();
  if (!isPublicUploadId(id)) {
    return unavailableResponse();
  }

  ensureDatabaseMigrated();

  const connection = createSqliteConnection();
  let upload;

  try {
    const db = createDbClient(connection);
    upload = getUploadMetadata(db, id);
  } finally {
    connection.close();
  }

  if (
    !upload ||
    upload.expiresAt.getTime() <= now.getTime() ||
    upload.cleanupClaimId !== null ||
    (upload.maxDownloads !== null &&
      upload.downloadCount >= upload.maxDownloads)
  ) {
    return unavailableResponse();
  }

  let storagePath: string;

  try {
    storagePath = resolveStoredUploadPath(upload.storedName);
  } catch {
    return unavailableResponse();
  }

  let fileHandle;

  try {
    fileHandle = await open(
      storagePath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
  } catch (error) {
    if (isUnavailableFileError(error)) {
      return unavailableResponse();
    }

    throw error;
  }

  try {
    const stats = await fileHandle.stat();

    if (!stats.isFile()) {
      await fileHandle.close();
      return unavailableResponse();
    }

    const classification = upload.encrypted
      ? {
          disposition: "attachment" as const,
          contentType: "application/octet-stream",
        }
      : await classifyUploadContent(fileHandle, stats.size);
    const disposition = forceDownload
      ? "attachment"
      : classification.disposition;
    const range = parseByteRange(rangeHeader, stats.size);
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Disposition": contentDisposition(
        upload.originalName,
        disposition,
      ),
      "Content-Security-Policy": INLINE_CONTENT_SECURITY_POLICY,
      "Content-Type": classification.contentType,
      "X-Content-Type-Options": "nosniff",
    });

    if (range === "unsatisfiable") {
      headers.set("Content-Length", "0");
      headers.set("Content-Range", `bytes */${stats.size}`);
      await fileHandle.close();
      return new Response(null, { headers, status: 416 });
    }

    const start = range?.start ?? 0;
    const end = range?.end ?? stats.size - 1;
    const length = range ? end - start + 1 : stats.size;
    headers.set("Content-Length", String(length));

    if (range) {
      headers.set("Content-Range", `bytes ${start}-${end}/${stats.size}`);
    }

    if (!includeBody) {
      await fileHandle.close();
      return new Response(null, { headers, status: range ? 206 : 200 });
    }

    // Admit only after file/range validation. Never refund interrupted bodies:
    // doing so would let aborted/ranged requests recover a reusable slot.
    const claimConnection = createSqliteConnection();
    let admitted;
    try {
      admitted = claimUploadDownload(
        createDbClient(claimConnection),
        id,
        new Date(now.getTime() + Math.max(0, Date.now() - requestStartedAt)),
      );
    } finally {
      claimConnection.close();
    }
    if (!admitted) {
      await fileHandle.close();
      return unavailableResponse();
    }

    const readStream = range
      ? fileHandle.createReadStream({ autoClose: true, end, start })
      : fileHandle.createReadStream({ autoClose: true });
    const body = Readable.toWeb(readStream) as ReadableStream<Uint8Array>;

    return new Response(body, { headers, status: range ? 206 : 200 });
  } catch (error) {
    await fileHandle.close().catch(() => undefined);

    if (isUnavailableFileError(error)) {
      return unavailableResponse();
    }

    throw error;
  }
}

export function createDownloadResponse(
  id: string,
  rangeHeader: string | null = null,
  now = new Date(),
  forceDownload = false,
): Promise<Response> {
  return createFileResponse(id, rangeHeader, now, true, forceDownload);
}

export function createDownloadHeadResponse(
  id: string,
  rangeHeader: string | null = null,
  now = new Date(),
  forceDownload = false,
): Promise<Response> {
  return createFileResponse(id, rangeHeader, now, false, forceDownload);
}
