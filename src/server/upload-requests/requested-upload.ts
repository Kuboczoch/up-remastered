import "server-only";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import { getPublicUrl } from "@/server/config/public-url";
import { getUploadLimits } from "@/server/config/uploads";
import { createDbClient, createSqliteConnection } from "@/server/db/client";
import {
  claimUploadRequest,
  consumeUploadRequest,
  getUploadRequestByManagementHash,
  getUploadRequestByPublicHash,
  insertUploadRequestWithReservation,
  releaseUploadRequestClaim,
  revokeUploadRequest as revokeStoredUploadRequest,
} from "@/server/db/upload-requests";
import { ensureDatabaseMigrated } from "@/server/db/migrate";
import type { UploadRequest } from "@/server/db/schema";
import {
  createUpload,
  type CreatedUpload,
} from "@/server/uploads/create-upload";
import { UploadRequestError } from "@/server/uploads/errors";
import { deleteUploadWithAccessToken } from "@/server/uploads/manage-upload";
import {
  createPublicUploadId,
  isPublicUploadId,
} from "@/server/uploads/public-id";

import {
  createCapabilityToken,
  hashCapabilityToken,
  isCapabilityToken,
} from "./capability-token";

const MAX_TOKEN_GENERATION_ATTEMPTS = 5;
const STRICT_UTC_ISO_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export type RequestedUploadStatus =
  | "active"
  | "consumed"
  | "expired"
  | "in_progress"
  | "retry"
  | "revoked";

export type UploadRequestDetails = {
  createdAt: string;
  expiresAt: string;
  maxBytes: number;
  shareUrl?: string;
  status: RequestedUploadStatus;
  statusChangedAt: string;
  uploadId?: string;
};

export type CreatedUploadRequest = UploadRequestDetails & {
  managementUrl: string;
  managementToken: string;
  uploadUrl: string;
};

function statusOf(request: UploadRequest, now: Date): RequestedUploadStatus {
  if (request.revokedAt) return "revoked";
  if (request.consumedAt) return "consumed";
  if (request.expiresAt.getTime() <= now.getTime()) return "expired";
  if (request.claimId) return "in_progress";
  if (request.retryAt) return "retry";
  return "active";
}

function statusChangedAt(request: UploadRequest, now: Date): Date {
  const status = statusOf(request, now);
  if (status === "revoked") return request.revokedAt!;
  if (status === "consumed") return request.consumedAt!;
  if (status === "expired") return request.expiresAt;
  if (status === "in_progress") return request.claimedAt!;
  if (status === "retry") return request.retryAt!;
  return request.createdAt;
}

function toDetails(request: UploadRequest, now: Date): UploadRequestDetails {
  return {
    createdAt: request.createdAt.toISOString(),
    expiresAt: request.expiresAt.toISOString(),
    maxBytes: request.maxBytes,
    ...(request.uploadId
      ? { shareUrl: getPublicUrl(`/${request.uploadId}`) }
      : {}),
    status: statusOf(request, now),
    statusChangedAt: statusChangedAt(request, now).toISOString(),
    ...(request.uploadId ? { uploadId: request.uploadId } : {}),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String(error.code).startsWith("SQLITE_CONSTRAINT")
  );
}

export function validateUploadRequestInput(
  input: unknown,
  now = new Date(),
): { expiresAt: Date; maxBytes: number } {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !["expiresAt", "maxBytes"].includes(key))
  ) {
    throw new UploadRequestError(
      "Request body must contain only expiresAt and maxBytes.",
      400,
      "invalid_upload_request",
    );
  }

  const { expiresAt: rawExpiresAt, maxBytes } = input as Record<
    string,
    unknown
  >;
  const expiresAt =
    typeof rawExpiresAt === "string" &&
    STRICT_UTC_ISO_PATTERN.test(rawExpiresAt)
      ? new Date(rawExpiresAt)
      : new Date(NaN);
  const limits = getUploadLimits();

  if (
    !Number.isInteger(maxBytes) ||
    (maxBytes as number) < 1 ||
    (maxBytes as number) > limits.maxUploadBytes
  ) {
    throw new UploadRequestError(
      `maxBytes must be an integer between 1 and ${limits.maxUploadBytes}.`,
      400,
      "invalid_max_bytes",
    );
  }

  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= now.getTime() ||
    expiresAt.getTime() > now.getTime() + limits.maxExpirationMs
  ) {
    throw new UploadRequestError(
      "expiresAt must be in the future and within the server expiration limit.",
      400,
      "invalid_expiration",
    );
  }

  return { expiresAt, maxBytes: maxBytes as number };
}

export function createRequestedUpload(
  input: unknown,
  now = new Date(),
  createToken: () => string = createCapabilityToken,
  createId: () => string = createPublicUploadId,
): CreatedUploadRequest {
  const validated = validateUploadRequestInput(input, now);
  ensureDatabaseMigrated();
  const connection = createSqliteConnection();
  const db = createDbClient(connection);

  try {
    for (
      let attempt = 0;
      attempt < MAX_TOKEN_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      const publicToken = createToken();
      const managementToken = createToken();
      const uploadId = createId();

      if (
        !isCapabilityToken(publicToken) ||
        !isCapabilityToken(managementToken)
      ) {
        throw new Error(
          "Capability token generator returned an invalid token.",
        );
      }

      if (!isPublicUploadId(uploadId)) {
        throw new Error("Upload ID generator returned an invalid ID.");
      }

      try {
        const request: UploadRequest = {
          claimId: null,
          claimedAt: null,
          consumedAt: null,
          createdAt: now,
          expiresAt: validated.expiresAt,
          managementTokenHash: hashCapabilityToken(managementToken),
          maxBytes: validated.maxBytes,
          publicTokenHash: hashCapabilityToken(publicToken),
          retryAt: null,
          revokedAt: null,
          uploadId,
        };
        insertUploadRequestWithReservation(db, request, now);

        return {
          ...toDetails(request, now),
          managementToken,
          managementUrl: getPublicUrl(`/request/manage#${managementToken}`),
          uploadUrl: getPublicUrl(`/request/${publicToken}`),
        };
      } catch (error) {
        if (isUniqueConstraintError(error)) continue;
        throw error;
      }
    }
  } finally {
    connection.close();
  }

  throw new Error("Could not generate unique upload request capabilities.");
}

export type RecipientRequestAvailability =
  | { status: "active" | "retry"; expiresAt: string; maxBytes: number }
  | { status: "invalid" | "consumed" | "expired" | "in_progress" | "revoked" };

// Never return owner metadata, reserved upload IDs or capability hashes to the recipient page.
export function getRecipientRequestAvailability(
  publicToken: string,
  now = new Date(),
): RecipientRequestAvailability {
  if (!isCapabilityToken(publicToken)) return { status: "invalid" };
  ensureDatabaseMigrated();
  const connection = createSqliteConnection();
  try {
    const request = getUploadRequestByPublicHash(
      createDbClient(connection),
      hashCapabilityToken(publicToken),
    );
    if (!request) return { status: "invalid" };
    const status = statusOf(request, now);
    if (status === "active" || status === "retry")
      return {
        status,
        maxBytes: request.maxBytes,
        expiresAt: request.expiresAt.toISOString(),
      };
    return { status };
  } finally {
    connection.close();
  }
}

export function getActiveRequestedUpload(
  publicToken: string,
  now = new Date(),
): UploadRequestDetails | undefined {
  if (!isCapabilityToken(publicToken)) return undefined;
  ensureDatabaseMigrated();
  const connection = createSqliteConnection();

  try {
    const request = getUploadRequestByPublicHash(
      createDbClient(connection),
      hashCapabilityToken(publicToken),
    );
    if (!request) return undefined;
    const status = statusOf(request, now);
    return status === "active" || status === "retry"
      ? toDetails(request, now)
      : undefined;
  } finally {
    connection.close();
  }
}

export function inspectRequestedUpload(
  managementToken: string,
  now = new Date(),
): UploadRequestDetails | undefined {
  if (!isCapabilityToken(managementToken)) return undefined;
  ensureDatabaseMigrated();
  const connection = createSqliteConnection();

  try {
    const request = getUploadRequestByManagementHash(
      createDbClient(connection),
      hashCapabilityToken(managementToken),
    );
    return request ? toDetails(request, now) : undefined;
  } finally {
    connection.close();
  }
}

export function revokeRequestedUpload(
  managementToken: string,
  now = new Date(),
): UploadRequestDetails | undefined {
  if (!isCapabilityToken(managementToken)) return undefined;
  ensureDatabaseMigrated();
  const connection = createSqliteConnection();

  try {
    const request = revokeStoredUploadRequest(
      createDbClient(connection),
      hashCapabilityToken(managementToken),
      now,
    );
    return request ? toDetails(request, now) : undefined;
  } finally {
    connection.close();
  }
}

export async function fulfillRequestedUpload(
  publicToken: string,
  request: Request,
  now = new Date(),
): Promise<CreatedUpload> {
  if (!isCapabilityToken(publicToken)) throw unavailableRequestError();
  ensureDatabaseMigrated();
  const publicTokenHash = hashCapabilityToken(publicToken);
  const claimId = createCapabilityToken();
  const connection = createSqliteConnection();
  let claimed: UploadRequest | undefined;
  try {
    claimed = claimUploadRequest(
      createDbClient(connection),
      publicTokenHash,
      claimId,
      now,
    );
  } finally {
    connection.close();
  }
  if (!claimed) throw unavailableRequestError();

  let upload: CreatedUpload | undefined;
  let body: Readable | undefined;
  try {
    // Web Request.signal does not itself dispose the body. Bind it explicitly
    // so abort closes stalled sources and the upload parser removes partial files.
    if (request.body) {
      body = Readable.fromWeb(request.body as NodeReadableStream<Uint8Array>, {
        signal: request.signal,
      });
      body.on("error", () => {}); // Validation may reject before the parser subscribes.
    }
    const cancellableRequest = body
      ? new Request(request.url, {
          body: Readable.toWeb(body),
          duplex: "half",
          headers: request.headers,
          method: request.method,
          signal: request.signal,
        } as RequestInit)
      : request;
    request.signal.throwIfAborted();
    upload = await createUpload(cancellableRequest, undefined, undefined, {
      maxUploadBytes: claimed.maxBytes,
      ...(claimed.uploadId ? { reservedUploadId: claimed.uploadId } : {}),
    });
    request.signal.throwIfAborted();
    const consumeConnection = createSqliteConnection();
    let consumed: boolean;
    try {
      consumed = consumeUploadRequest(
        createDbClient(consumeConnection),
        publicTokenHash,
        claimId,
        upload.id,
        new Date(),
      );
    } finally {
      consumeConnection.close();
    }
    if (!consumed) throw unavailableRequestError();
    return upload;
  } catch (error) {
    // Cancellation/revocation after persistence must not leave an orphan file.
    // Only release the claim after cleanup, so retry cannot collide with cleanup.
    if (upload)
      await deleteUploadWithAccessToken(upload.id, upload.accessToken);
    const releaseConnection = createSqliteConnection();
    try {
      releaseUploadRequestClaim(
        createDbClient(releaseConnection),
        publicTokenHash,
        claimId,
        new Date(),
      );
    } finally {
      releaseConnection.close();
    }
    throw error;
  } finally {
    body?.destroy();
  }
}

function unavailableRequestError(): UploadRequestError {
  return new UploadRequestError(
    "This upload request is unavailable.",
    404,
    "upload_request_unavailable",
  );
}
