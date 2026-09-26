import "server-only";

import Busboy from "busboy";
import type { IncomingHttpHeaders } from "node:http";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import { getPublicUrl } from "@/server/config/public-url";
import { getUploadLimits } from "@/server/config/uploads";
import { createDbClient, createSqliteConnection } from "@/server/db/client";
import {
  deleteUploadMetadata,
  getTotalStoredUploadBytes,
  insertUploadMetadataWithinQuota,
} from "@/server/db/uploads";
import { ensureDatabaseMigrated } from "@/server/db/migrate";
import {
  assignPendingUploadId,
  commitPendingUploadFile,
  createPendingUploadFile,
  createPendingUploadWriteStream,
  discardPendingUploadFile,
  sanitizeOriginalName,
  type PendingUploadFile,
} from "@/server/storage/uploads";
import {
  createUploadAccessToken,
  hashUploadAccessToken,
} from "@/server/uploads/access-token";
import {
  isUploadRequestError,
  UploadRequestError,
} from "@/server/uploads/errors";
import { resolveUploadExpiration } from "@/server/uploads/expiration";
import { createPublicUploadId } from "@/server/uploads/public-id";

type UploadFieldMap = Map<string, string>;

type UploadContent = {
  mimeType: string;
  originalName: string;
  size: number;
};
type UploadLimitKind = "stored-bytes" | "upload-size";
type BetterSqliteError = Error & { code?: string };

export type CreatedUpload = {
  accessToken: string;
  expiresAt: string;
  id: string;
  mimeType: string;
  originalName: string;
  shareUrl: string;
  size: number;
};

export type CreateUploadOptions = {
  maxUploadBytes?: number;
};

const TEXT_FIELD_NAME = "text";
const FILE_FIELD_NAME = "file";
const MAX_MULTIPART_FIELD_BYTES = 8 * 1024;
const ALLOWED_MULTIPART_FIELD_NAMES = new Set([
  "expiresAt",
  "expiresInHours",
  "expiresInMinutes",
  "expiresInSeconds",
  TEXT_FIELD_NAME,
]);
const MAX_UPLOAD_ID_ATTEMPTS = 20;
const MAX_MULTIPART_FILES = 10;

function normalizeUploadMimeType(value: string | undefined): string {
  const [rawMediaType, ...rawParameters] = (value ?? "").split(";");
  const mediaType = rawMediaType?.trim().toLowerCase();

  if (!mediaType?.includes("/")) {
    return "application/octet-stream";
  }

  if (mediaType !== "text/plain") {
    return mediaType;
  }

  const charset = rawParameters
    .map(
      (parameter) =>
        parameter.trim().match(/^charset=([A-Za-z0-9._-]+)$/i)?.[1],
    )
    .find(Boolean);

  return `text/plain; charset=${charset?.toLowerCase() ?? "utf-8"}`;
}

function toNodeHeaders(headers: Headers): IncomingHttpHeaders {
  const nodeHeaders: IncomingHttpHeaders = {};

  headers.forEach((value, key) => {
    nodeHeaders[key.toLowerCase()] = value;
  });

  return nodeHeaders;
}

function getUploadLimitError(limitKind: UploadLimitKind) {
  if (limitKind === "stored-bytes") {
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
  limitKind: UploadLimitKind,
): Promise<number> {
  let size = 0;
  const byteCounter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.byteLength;

      if (size > byteLimit) {
        callback(getUploadLimitError(limitKind));
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
  limitKind: UploadLimitKind,
): Promise<number> {
  return writeStreamToPendingFile(
    Readable.from([Buffer.from(text)]),
    pendingFile,
    byteLimit,
    limitKind,
  );
}

function getRawUploadName(request: Request): string {
  const fileName =
    request.headers.get("x-file-name") ?? request.headers.get("x-filename");

  if (fileName) {
    return sanitizeOriginalName(fileName);
  }

  if (request.headers.get("content-type")?.startsWith("text/plain")) {
    return "upload.txt";
  }

  throw new UploadRequestError(
    "Raw uploads must include an X-File-Name header unless they are text/plain.",
    400,
    "missing_file_name",
  );
}

function getRawUploadMimeType(request: Request): string {
  return normalizeUploadMimeType(
    request.headers.get("content-type") ?? undefined,
  );
}

async function parseRawUpload(
  request: Request,
  pendingFile: PendingUploadFile,
  byteLimit: number,
  limitKind: UploadLimitKind,
): Promise<{ content: UploadContent; fields: UploadFieldMap }> {
  if (!request.body) {
    throw new UploadRequestError(
      "Upload request body is required.",
      400,
      "empty_body",
    );
  }
  const originalName = getRawUploadName(request);
  const mimeType = getRawUploadMimeType(request);

  const size = await writeStreamToPendingFile(
    Readable.fromWeb(
      request.body as NodeReadableStream<Uint8Array>,
    ) as NodeJS.ReadableStream,
    pendingFile,
    byteLimit,
    limitKind,
  );

  if (size === 0) {
    throw new UploadRequestError(
      "Upload request body must not be empty.",
      400,
      "missing_upload",
    );
  }

  return {
    content: {
      mimeType,
      originalName,
      size,
    },
    fields: new Map(),
  };
}

function getTextUploadField(fields: UploadFieldMap) {
  const textUpload = fields.get(TEXT_FIELD_NAME);

  if (textUpload === undefined) {
    return undefined;
  }

  return { name: TEXT_FIELD_NAME, value: textUpload };
}

async function parseMultipartUpload(
  request: Request,
  pendingFile: PendingUploadFile,
  byteLimit: number,
  limitKind: UploadLimitKind,
): Promise<{ content: UploadContent; fields: UploadFieldMap }> {
  if (!request.body) {
    throw new UploadRequestError(
      "Upload request body is required.",
      400,
      "empty_body",
    );
  }

  const fields: UploadFieldMap = new Map();
  let parser: ReturnType<typeof Busboy>;

  try {
    parser = Busboy({
      headers: toNodeHeaders(request.headers),
      limits: {
        fields: 50,
        fieldSize: MAX_MULTIPART_FIELD_BYTES,
        fileSize: byteLimit,
        files: MAX_MULTIPART_FILES,
        parts: 60,
      },
    });
  } catch {
    throw new UploadRequestError(
      "Malformed multipart request.",
      400,
      "invalid_multipart",
    );
  }
  const fileWrites: Promise<void>[] = [];
  let parsedContent: UploadContent | undefined;
  let uploadError: Error | undefined;

  parser.on("file", (fieldName, fileStream, fileInfo) => {
    if (fieldName !== FILE_FIELD_NAME) {
      fileStream.resume();
      return;
    }

    if (parsedContent) {
      uploadError = new UploadRequestError(
        "Only one uploaded file is supported.",
        400,
        "too_many_files",
      );
      fileStream.resume();
      return;
    }

    if (fields.has(TEXT_FIELD_NAME)) {
      uploadError = new UploadRequestError(
        "Provide either a file part or a text field, not both.",
        400,
        "ambiguous_upload",
      );
      fileStream.resume();
      return;
    }

    parsedContent = {
      mimeType: normalizeUploadMimeType(fileInfo.mimeType),
      originalName: sanitizeOriginalName(fileInfo.filename || "upload"),
      size: 0,
    };
    fileStream.on("limit", () => {
      uploadError = getUploadLimitError(limitKind);
    });

    const writePromise = writeStreamToPendingFile(
      fileStream,
      pendingFile,
      byteLimit,
      limitKind,
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

  parser.on("field", (name, value, info) => {
    if (!ALLOWED_MULTIPART_FIELD_NAMES.has(name)) {
      return;
    }

    if (name === TEXT_FIELD_NAME && parsedContent) {
      uploadError = new UploadRequestError(
        "Provide either a file part or a text field, not both.",
        400,
        "ambiguous_upload",
      );
      return;
    }

    if (info.valueTruncated) {
      uploadError = getUploadLimitError(limitKind);
      return;
    }

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

  const source = Readable.fromWeb(
    request.body as NodeReadableStream<Uint8Array>,
  );

  try {
    await pipeline(source, parser);
  } catch (error) {
    source.destroy(error instanceof Error ? error : undefined);
    await Promise.allSettled(fileWrites);

    if (uploadError) {
      throw uploadError;
    }

    if (isUploadRequestError(error)) {
      throw error;
    }

    throw new UploadRequestError(
      "Malformed multipart request.",
      400,
      "invalid_multipart",
    );
  }
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
    limitKind,
  );

  return {
    content: {
      mimeType: "text/plain; charset=utf-8",
      originalName: "text.txt",
      size,
    },
    fields,
  };
}

async function parseUploadRequest(
  request: Request,
  pendingFile: PendingUploadFile,
  byteLimit: number,
  limitKind: UploadLimitKind,
) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.toLowerCase().startsWith("multipart/form-data")) {
    return parseMultipartUpload(request, pendingFile, byteLimit, limitKind);
  }

  return parseRawUpload(request, pendingFile, byteLimit, limitKind);
}

function isUploadIdCollisionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ["SQLITE_CONSTRAINT_PRIMARYKEY", "SQLITE_CONSTRAINT_UNIQUE"].includes(
      String((error as BetterSqliteError).code),
    )
  );
}

export async function createUpload(
  request: Request,
  createId: () => string = createPublicUploadId,
  createAccessToken: () => string = createUploadAccessToken,
  options: CreateUploadOptions = {},
): Promise<CreatedUpload> {
  const limits = getUploadLimits();
  ensureDatabaseMigrated();

  const connection = createSqliteConnection();
  const db = createDbClient(connection);
  const pendingFile = await createPendingUploadFile();

  try {
    const totalStoredBytes = getTotalStoredUploadBytes(db);
    const remainingStoredBytes = limits.maxStoredBytes - totalStoredBytes;

    if (remainingStoredBytes <= 0) {
      throw new UploadRequestError(
        "Storage is full.",
        413,
        "total_storage_limit_exceeded",
      );
    }

    const configuredByteLimit = Math.min(
      limits.maxUploadBytes,
      options.maxUploadBytes ?? limits.maxUploadBytes,
    );
    const byteLimit = Math.min(configuredByteLimit, remainingStoredBytes);
    const limitKind =
      remainingStoredBytes <= configuredByteLimit
        ? "stored-bytes"
        : "upload-size";
    const { content, fields } = await parseUploadRequest(
      request,
      pendingFile,
      byteLimit,
      limitKind,
    );
    const now = new Date();
    const expiresAt = resolveUploadExpiration(fields, limits, now);
    const accessToken = createAccessToken();
    const accessTokenHash = hashUploadAccessToken(accessToken);
    let uploadId: string | undefined;

    for (let attempt = 0; attempt < MAX_UPLOAD_ID_ATTEMPTS; attempt += 1) {
      const candidateId = createId();
      const assignedFile = assignPendingUploadId(pendingFile, candidateId);

      try {
        const inserted = insertUploadMetadataWithinQuota(
          db,
          {
            accessTokenHash,
            createdAt: now,
            expiresAt,
            id: candidateId,
            mimeType: content.mimeType,
            originalName: content.originalName,
            size: content.size,
            storagePath: assignedFile.storagePath,
            storedName: assignedFile.storedName,
          },
          limits.maxStoredBytes,
        );

        if (!inserted) {
          throw new UploadRequestError(
            "Upload would exceed the total stored data limit.",
            413,
            "total_storage_limit_exceeded",
          );
        }

        uploadId = candidateId;
        break;
      } catch (error) {
        if (isUploadIdCollisionError(error)) {
          continue;
        }

        throw error;
      }
    }

    if (!uploadId) {
      throw new Error("Could not generate an available upload ID.");
    }

    try {
      await commitPendingUploadFile(pendingFile);
    } catch (error) {
      deleteUploadMetadata(db, uploadId);
      throw error;
    }

    return {
      accessToken,
      expiresAt: expiresAt.toISOString(),
      id: uploadId,
      mimeType: content.mimeType,
      originalName: content.originalName,
      shareUrl: getPublicUrl(`/${uploadId}`),
      size: content.size,
    };
  } catch (error) {
    await discardPendingUploadFile(pendingFile);
    throw error;
  } finally {
    connection.close();
  }
}
