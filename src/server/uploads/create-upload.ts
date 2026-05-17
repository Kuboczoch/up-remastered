import "server-only";

import Busboy from "busboy";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import { getPublicUrl } from "@/server/config/public-url";
import { getUploadLimits } from "@/server/config/uploads";
import type { UploadLimits } from "@/server/config/uploads";
import { createDbClient, createSqliteConnection } from "@/server/db/client";
import {
  getTotalStoredUploadBytes,
  hasActiveUploadId,
  insertUploadMetadata,
} from "@/server/db/uploads";
import { ensureDatabaseMigrated } from "@/server/db/migrate";
import {
  commitPendingUploadFile,
  createPendingUploadFile,
  createPendingUploadWriteStream,
  deleteStoredUploadFile,
  discardPendingUploadFile,
  sanitizeOriginalName,
  type PendingUploadFile,
} from "@/server/storage/uploads";
import { UploadRequestError } from "@/server/uploads/errors";
import { resolveUploadExpiration } from "@/server/uploads/expiration";

type UploadFieldMap = Map<string, string>;

type UploadContent = {
  mimeType: string;
  originalName: string;
  size: number;
};

export type CreatedUpload = {
  expiresAt: string;
  id: string;
  mimeType: string;
  originalName: string;
  shareUrl: string;
  size: number;
  token: string;
};

const EXPIRATION_FIELD_NAMES = new Set([
  "expiresAt",
  "expiresInHours",
  "expiresInMinutes",
  "expiresInSeconds",
  "expirationHours",
]);
const UPLOAD_ID_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const UPLOAD_ID_LENGTH = 5;
const MAX_UPLOAD_ID_ATTEMPTS = 20;

function createToken(): string {
  return randomBytes(18).toString("base64url");
}

function createUploadId(): string {
  let id = "";

  for (let index = 0; index < UPLOAD_ID_LENGTH; index += 1) {
    id += UPLOAD_ID_ALPHABET[randomInt(UPLOAD_ID_ALPHABET.length)];
  }

  return id;
}

function createUniqueActiveUploadId(db: ReturnType<typeof createDbClient>) {
  for (let attempt = 0; attempt < MAX_UPLOAD_ID_ATTEMPTS; attempt += 1) {
    const uploadId = createUploadId();

    if (!hasActiveUploadId(db, uploadId)) {
      return uploadId;
    }
  }

  throw new Error("Could not generate an available upload ID.");
}

function toNodeHeaders(headers: Headers): IncomingHttpHeaders {
  const nodeHeaders: IncomingHttpHeaders = {};

  headers.forEach((value, key) => {
    nodeHeaders[key.toLowerCase()] = value;
  });

  return nodeHeaders;
}

function getUploadLimitError(byteLimit: number, limits: UploadLimits) {
  if (byteLimit < limits.maxUploadBytes) {
    return new UploadRequestError(
      "Upload would exceed the total stored data limit.",
      413,
      "total_storage_limit_exceeded",
    );
  }

  return new UploadRequestError(
    "Upload exceeds the maximum upload size.",
    413,
    "upload_too_large",
  );
}

async function writeStreamToPendingFile(
  source: NodeJS.ReadableStream,
  pendingFile: PendingUploadFile,
  byteLimit: number,
  limits: UploadLimits,
): Promise<number> {
  let size = 0;
  const byteCounter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.byteLength;

      if (size > byteLimit) {
        callback(getUploadLimitError(byteLimit, limits));
        return;
      }

      callback(null, chunk);
    },
  });

  await pipeline(
    source,
    byteCounter,
    createPendingUploadWriteStream(pendingFile),
  );

  return size;
}

async function writeTextToPendingFile(
  text: string,
  pendingFile: PendingUploadFile,
  byteLimit: number,
  limits: UploadLimits,
): Promise<number> {
  return writeStreamToPendingFile(
    Readable.from([Buffer.from(text)]),
    pendingFile,
    byteLimit,
    limits,
  );
}

function getRawUploadName(request: Request): string {
  return sanitizeOriginalName(
    request.headers.get("x-file-name") ??
      request.headers.get("x-filename") ??
      (request.headers.get("content-type")?.startsWith("text/")
        ? "upload.txt"
        : "upload.bin"),
  );
}

function getRawUploadMimeType(request: Request): string {
  return (
    request.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream"
  );
}

async function parseRawUpload(
  request: Request,
  pendingFile: PendingUploadFile,
  byteLimit: number,
  limits: UploadLimits,
): Promise<{ content: UploadContent; fields: UploadFieldMap }> {
  if (!request.body) {
    throw new UploadRequestError(
      "Upload request body is required.",
      400,
      "empty_body",
    );
  }

  const size = await writeStreamToPendingFile(
    Readable.fromWeb(
      request.body as NodeReadableStream<Uint8Array>,
    ) as NodeJS.ReadableStream,
    pendingFile,
    byteLimit,
    limits,
  );

  return {
    content: {
      mimeType: getRawUploadMimeType(request),
      originalName: getRawUploadName(request),
      size,
    },
    fields: new Map(),
  };
}

function getTextUploadField(fields: UploadFieldMap) {
  for (const [name, value] of fields) {
    if (!EXPIRATION_FIELD_NAMES.has(name)) {
      return { name, value };
    }
  }

  return undefined;
}

async function parseMultipartUpload(
  request: Request,
  pendingFile: PendingUploadFile,
  byteLimit: number,
  limits: UploadLimits,
): Promise<{ content: UploadContent; fields: UploadFieldMap }> {
  if (!request.body) {
    throw new UploadRequestError(
      "Upload request body is required.",
      400,
      "empty_body",
    );
  }

  const fields: UploadFieldMap = new Map();
  const parser = Busboy({
    headers: toNodeHeaders(request.headers),
    limits: {
      fields: 50,
      fileSize: byteLimit,
      files: 1,
      parts: 60,
    },
  });
  const fileWrites: Promise<void>[] = [];
  let parsedContent: UploadContent | undefined;
  let uploadError: Error | undefined;

  parser.on("file", (_fieldName, fileStream, fileInfo) => {
    if (parsedContent) {
      uploadError = new UploadRequestError(
        "Only one uploaded file is supported.",
        400,
        "too_many_files",
      );
      fileStream.resume();
      return;
    }

    parsedContent = {
      mimeType: fileInfo.mimeType || "application/octet-stream",
      originalName: sanitizeOriginalName(fileInfo.filename || "upload"),
      size: 0,
    };
    fileStream.on("limit", () => {
      uploadError = getUploadLimitError(byteLimit, limits);
    });

    const writePromise = writeStreamToPendingFile(
      fileStream,
      pendingFile,
      byteLimit,
      limits,
    )
      .then((size) => {
        if (parsedContent) {
          parsedContent.size = size;
        }
      })
      .catch((error: unknown) => {
        uploadError =
          error instanceof Error
            ? error
            : new Error("Failed to stream uploaded file.");
      });

    fileWrites.push(writePromise);
  });

  parser.on("field", (name, value) => {
    fields.set(name, value);
  });
  parser.on("filesLimit", () => {
    uploadError = new UploadRequestError(
      "Only one uploaded file is supported.",
      400,
      "too_many_files",
    );
  });
  parser.on("fieldsLimit", () => {
    uploadError = new UploadRequestError(
      "Too many form fields were provided.",
      400,
      "too_many_fields",
    );
  });
  parser.on("partsLimit", () => {
    uploadError = new UploadRequestError(
      "Too many multipart parts were provided.",
      400,
      "too_many_parts",
    );
  });

  await pipeline(
    Readable.fromWeb(
      request.body as NodeReadableStream<Uint8Array>,
    ) as NodeJS.ReadableStream,
    parser,
  );
  await Promise.all(fileWrites);

  if (uploadError) {
    throw uploadError;
  }

  if (parsedContent) {
    return { content: parsedContent, fields };
  }

  const textUpload = getTextUploadField(fields);

  if (!textUpload) {
    throw new UploadRequestError(
      "Provide a file part or a text form field to upload.",
      400,
      "missing_upload",
    );
  }

  const size = await writeTextToPendingFile(
    textUpload.value,
    pendingFile,
    byteLimit,
    limits,
  );

  return {
    content: {
      mimeType: "text/plain",
      originalName: sanitizeOriginalName(`${textUpload.name}.txt`),
      size,
    },
    fields,
  };
}

async function parseUploadRequest(
  request: Request,
  pendingFile: PendingUploadFile,
  byteLimit: number,
  limits: UploadLimits,
) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.toLowerCase().startsWith("multipart/form-data")) {
    return parseMultipartUpload(request, pendingFile, byteLimit, limits);
  }

  return parseRawUpload(request, pendingFile, byteLimit, limits);
}

export async function createUpload(request: Request): Promise<CreatedUpload> {
  const limits = getUploadLimits();
  ensureDatabaseMigrated();

  const connection = createSqliteConnection();
  const db = createDbClient(connection);
  const uploadId = createUniqueActiveUploadId(db);
  const storageKey = randomUUID();
  const token = createToken();
  const pendingFile = await createPendingUploadFile(storageKey);

  try {
    const totalStoredBytes = getTotalStoredUploadBytes(db);
    const remainingStoredBytes = limits.maxStoredBytes - totalStoredBytes;

    if (remainingStoredBytes <= 0) {
      throw new UploadRequestError(
        "Upload would exceed the total stored data limit.",
        413,
        "total_storage_limit_exceeded",
      );
    }

    const byteLimit = Math.min(limits.maxUploadBytes, remainingStoredBytes);
    const { content, fields } = await parseUploadRequest(
      request,
      pendingFile,
      byteLimit,
      limits,
    );
    const now = new Date();
    const expiresAt = resolveUploadExpiration(fields, limits, now);

    await commitPendingUploadFile(pendingFile);

    try {
      insertUploadMetadata(db, {
        createdAt: now,
        expiresAt,
        id: uploadId,
        mimeType: content.mimeType,
        originalName: content.originalName,
        size: content.size,
        storagePath: pendingFile.storagePath,
        storageKey,
        storedName: pendingFile.storedName,
        token,
      });
    } catch (error) {
      await deleteStoredUploadFile(pendingFile);
      throw error;
    }

    return {
      expiresAt: expiresAt.toISOString(),
      id: uploadId,
      mimeType: content.mimeType,
      originalName: content.originalName,
      shareUrl: getPublicUrl(`/api/download/${token}`),
      size: content.size,
      token,
    };
  } catch (error) {
    await discardPendingUploadFile(pendingFile);
    throw error;
  } finally {
    connection.close();
  }
}
