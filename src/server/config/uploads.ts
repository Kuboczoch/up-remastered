import "server-only";

import { join, resolve } from "node:path";

const GIB = 1024 * 1024 * 1024;
const DEFAULT_DATA_DIR = "/data";
const DEFAULT_UPLOAD_DIR = join(DEFAULT_DATA_DIR, "uploads");
const DEFAULT_MAX_UPLOAD_BYTES = GIB;
const DEFAULT_MAX_STORED_BYTES = 10 * GIB;
const DEFAULT_EXPIRATION_HOURS = 24;
const DEFAULT_MAX_EXPIRATION_HOURS = 24;

export type UploadLimits = {
  defaultExpirationMs: number;
  maxExpirationMs: number;
  maxStoredBytes: number;
  maxUploadBytes: number;
};

function readPositiveInteger(name: string, defaultValue: number): number {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return defaultValue;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue) || !Number.isInteger(parsedValue)) {
    throw new Error(`${name} must be an integer number of bytes.`);
  }

  if (parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  if (!Number.isSafeInteger(parsedValue)) {
    throw new Error(
      `${name} must be less than or equal to Number.MAX_SAFE_INTEGER.`,
    );
  }

  return parsedValue;
}

function readPositiveHours(name: string, defaultValue: number): number {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return defaultValue;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive number of hours.`);
  }

  return parsedValue;
}

export function getUploadDirectory(): string {
  const configuredUploadDirectory = process.env.UPLOAD_DIR?.trim();

  if (configuredUploadDirectory) {
    return resolve(configuredUploadDirectory);
  }

  const configuredDataDirectory = process.env.DATA_DIR?.trim();

  if (configuredDataDirectory) {
    return resolve(configuredDataDirectory, "uploads");
  }

  return DEFAULT_UPLOAD_DIR;
}

export function getUploadLimits(): UploadLimits {
  const defaultExpirationHours = readPositiveHours(
    "DEFAULT_EXPIRATION_HOURS",
    DEFAULT_EXPIRATION_HOURS,
  );
  const maxExpirationHours = readPositiveHours(
    "MAX_EXPIRATION_HOURS",
    DEFAULT_MAX_EXPIRATION_HOURS,
  );

  if (defaultExpirationHours > maxExpirationHours) {
    throw new Error(
      "DEFAULT_EXPIRATION_HOURS must be less than or equal to MAX_EXPIRATION_HOURS.",
    );
  }

  return {
    defaultExpirationMs: defaultExpirationHours * 60 * 60 * 1000,
    maxExpirationMs: maxExpirationHours * 60 * 60 * 1000,
    maxStoredBytes: readPositiveInteger(
      "MAX_STORED_BYTES",
      DEFAULT_MAX_STORED_BYTES,
    ),
    maxUploadBytes: readPositiveInteger(
      "MAX_UPLOAD_SIZE",
      DEFAULT_MAX_UPLOAD_BYTES,
    ),
  };
}
