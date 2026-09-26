import "server-only";

import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { Readable } from "node:stream";

import { createDbClient, createSqliteConnection } from "@/server/db/client";
import { ensureDatabaseMigrated } from "@/server/db/migrate";
import { getUploadMetadata } from "@/server/db/uploads";
import {
  resolveStoredUploadPath,
  sanitizeOriginalName,
} from "@/server/storage/uploads";
import { isPublicUploadId } from "@/server/uploads/public-id";

const SAFE_MEDIA_TYPE =
  /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const UNAVAILABLE_BODY = "File unavailable.\n";

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

function safeContentType(mimeType: string): string {
  return SAFE_MEDIA_TYPE.test(mimeType) ? mimeType : "application/octet-stream";
}

function contentDisposition(originalName: string): string {
  const fileName = sanitizeOriginalName(originalName);

  return `attachment; filename="${fileName}"`;
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
  now: Date,
  includeBody: boolean,
): Promise<Response> {
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

  if (!upload || upload.expiresAt.getTime() <= now.getTime()) {
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

    const headers = {
      "Cache-Control": "no-store",
      "Content-Disposition": contentDisposition(upload.originalName),
      "Content-Length": String(stats.size),
      "Content-Type": safeContentType(upload.mimeType),
      "X-Content-Type-Options": "nosniff",
    };

    if (!includeBody) {
      await fileHandle.close();
      return new Response(null, { headers });
    }

    const body = Readable.toWeb(
      fileHandle.createReadStream({ autoClose: true }),
    ) as ReadableStream<Uint8Array>;

    return new Response(body, { headers });
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
  now = new Date(),
): Promise<Response> {
  return createFileResponse(id, now, true);
}

export function createDownloadHeadResponse(
  id: string,
  now = new Date(),
): Promise<Response> {
  return createFileResponse(id, now, false);
}
