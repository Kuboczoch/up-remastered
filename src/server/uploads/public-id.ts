import { randomInt } from "node:crypto";

const PUBLIC_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PUBLIC_ID_LENGTH = 5;
const PUBLIC_ID_PATTERN = /^[0-9A-Z]{5}$/;

export function createPublicUploadId(): string {
  let id = "";

  for (let index = 0; index < PUBLIC_ID_LENGTH; index += 1) {
    id += PUBLIC_ID_ALPHABET[randomInt(PUBLIC_ID_ALPHABET.length)];
  }

  return id;
}

export function isPublicUploadId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value);
}
