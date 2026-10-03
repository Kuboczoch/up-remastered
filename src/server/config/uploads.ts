import "server-only";

import { resolve } from "node:path";

import { getServerEnv } from "@/env";

export type UploadLimits = {
  defaultExpirationMs: number;
  maxExpirationMs: number;
  maxStoredBytes: number;
  maxUploadBytes: number;
};

export function getUploadDirectory(): string {
  const env = getServerEnv();

  if (env.UPLOAD_DIR) {
    return resolve(env.UPLOAD_DIR);
  }

  return resolve(env.DATA_DIR, "uploads");
}

export function getUploadLimits(): UploadLimits {
  const env = getServerEnv();

  return {
    defaultExpirationMs: env.DEFAULT_EXPIRATION_HOURS * 60 * 60 * 1000,
    maxExpirationMs: env.MAX_EXPIRATION_HOURS * 60 * 60 * 1000,
    maxStoredBytes: env.MAX_STORED_BYTES,
    maxUploadBytes: env.MAX_UPLOAD_SIZE,
  };
}
