import { createHash, randomBytes } from "node:crypto";

const CAPABILITY_TOKEN_BYTES = 32;
const CAPABILITY_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function createCapabilityToken(): string {
  return randomBytes(CAPABILITY_TOKEN_BYTES).toString("hex");
}

export function hashCapabilityToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isCapabilityToken(token: string): boolean {
  return CAPABILITY_TOKEN_PATTERN.test(token);
}
