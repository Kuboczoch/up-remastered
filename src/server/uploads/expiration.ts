import type { UploadLimits } from "@/server/config/uploads";
import { UploadRequestError } from "@/server/uploads/errors";

type UploadFields = ReadonlyMap<string, string>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const INVALID_EXPIRES_AT_MESSAGE =
  "expiresAt must be a valid future UTC ISO date ending in Z.";

function parseDurationField(fields: UploadFields): number | undefined {
  const seconds = normalizeOptionalField(fields.get("expiresInSeconds"));
  const minutes = normalizeOptionalField(fields.get("expiresInMinutes"));
  const hours = normalizeOptionalField(fields.get("expiresInHours"));
  const suppliedFields = [seconds, minutes, hours].filter(
    (value) => value !== undefined,
  );

  if (suppliedFields.length > 1) {
    throw new UploadRequestError(
      "Provide only one expiration duration field.",
      400,
      "invalid_expiration",
    );
  }

  const rawDuration = seconds ?? minutes ?? hours;

  if (rawDuration === undefined) {
    return undefined;
  }

  const parsedDuration = Number(rawDuration);

  if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
    throw new UploadRequestError(
      "Expiration duration must be a positive number.",
      400,
      "invalid_expiration",
    );
  }

  if (seconds !== undefined) {
    return parsedDuration * 1000;
  }

  if (minutes !== undefined) {
    return parsedDuration * 60 * 1000;
  }

  return parsedDuration * 60 * 60 * 1000;
}

function normalizeOptionalField(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  return value;
}

export function resolveUploadExpiration(
  fields: UploadFields,
  limits: UploadLimits,
  now = new Date(),
): Date {
  const requestedExpiresAt = fields.get("expiresAt");

  if (requestedExpiresAt) {
    if (!ISO_DATE_PATTERN.test(requestedExpiresAt)) {
      throw new UploadRequestError(
        INVALID_EXPIRES_AT_MESSAGE,
        400,
        "invalid_expiration",
      );
    }

    const expiresAt = new Date(requestedExpiresAt);

    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
      throw new UploadRequestError(
        INVALID_EXPIRES_AT_MESSAGE,
        400,
        "invalid_expiration",
      );
    }

    if (expiresAt.getTime() - now.getTime() > limits.maxExpirationMs) {
      throw new UploadRequestError(
        "Requested expiration exceeds the maximum allowed expiration.",
        400,
        "expiration_too_large",
      );
    }

    return expiresAt;
  }

  const requestedDurationMs =
    parseDurationField(fields) ?? limits.defaultExpirationMs;

  if (requestedDurationMs > limits.maxExpirationMs) {
    throw new UploadRequestError(
      "Requested expiration exceeds the maximum allowed expiration.",
      400,
      "expiration_too_large",
    );
  }

  return new Date(now.getTime() + requestedDurationMs);
}
