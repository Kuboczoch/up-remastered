import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ACCESS_TOKEN_BYTES = 64;

export function createUploadAccessToken(): string {
  return randomBytes(ACCESS_TOKEN_BYTES).toString("hex");
}

export function hashUploadAccessToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function matchesUploadAccessToken(
  token: string,
  expectedHash: string,
): boolean {
  const actual = Buffer.from(hashUploadAccessToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
