// Versioned, authenticated envelope. See docs/pages/download/encryption.md.
export const MAX_ENCRYPTED_FILE_BYTES = 32 * 1024 * 1024;
const MAX_METADATA_BYTES = 64 * 1024;
export const MAX_ENCRYPTED_ENVELOPE_BYTES =
  MAX_ENCRYPTED_FILE_BYTES + MAX_METADATA_BYTES + 38;
const MAGIC = new Uint8Array([85, 80, 69, 78, 67, 1]);
const HEADER_BYTES = MAGIC.length + 12;

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new DOMException("Upload cancelled.", "AbortError");
}
function requireCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Key protection requires a browser with Web Crypto on HTTPS (or localhost). No plaintext was uploaded.",
    );
  }
  return globalThis.crypto;
}
function keyString(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function validateEncryptionKey(key: string): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(key)) return false;
  try {
    const bytes = Uint8Array.from(
      atob(key.replace(/-/g, "+").replace(/_/g, "/") + "="),
      (c) => c.charCodeAt(0),
    );
    return bytes.length === 32 && keyString(bytes) === key;
  } catch {
    return false;
  }
}

export async function encryptFile(
  file: File,
  signal?: AbortSignal,
): Promise<{ file: File; key: string }> {
  checkAbort(signal);
  if (file.size > MAX_ENCRYPTED_FILE_BYTES)
    throw new Error(
      "Key protection supports files up to 32 MiB. Choose a smaller file; encryption never falls back to plaintext.",
    );
  const crypto = requireCrypto();
  const metadata = new TextEncoder().encode(
    JSON.stringify({ name: file.name, type: file.type, size: file.size }),
  );
  if (metadata.length > MAX_METADATA_BYTES)
    throw new Error("The file name is too long for key protection.");
  const data = new Uint8Array(await file.arrayBuffer());
  checkAbort(signal);
  const plaintext = new Uint8Array(4 + metadata.length + data.length);
  new DataView(plaintext.buffer).setUint32(0, metadata.length, false);
  plaintext.set(metadata, 4);
  plaintext.set(data, 4 + metadata.length);
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const header = new Uint8Array(HEADER_BYTES);
  header.set(MAGIC);
  header.set(crypto.getRandomValues(new Uint8Array(12)), MAGIC.length);
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, [
    "encrypt",
  ]);
  checkAbort(signal);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: header.slice(MAGIC.length),
      additionalData: header,
      tagLength: 128,
    },
    key,
    plaintext,
  );
  checkAbort(signal);
  return {
    file: new File([header, ciphertext], "encrypted.up", {
      type: "application/octet-stream",
    }),
    key: keyString(rawKey),
  };
}

export async function decryptFile(
  envelope: ArrayBuffer,
  keyStringValue: string,
): Promise<File> {
  if (!validateEncryptionKey(keyStringValue))
    throw new Error(
      "Missing or invalid key. Ask the sender for the complete link, including #key=….",
    );
  const crypto = requireCrypto();
  if (envelope.byteLength > MAX_ENCRYPTED_ENVELOPE_BYTES)
    throw new Error(
      "This protected file exceeds the 32 MiB browser memory limit.",
    );
  const bytes = new Uint8Array(envelope);
  if (
    bytes.length < HEADER_BYTES + 16 ||
    MAGIC.some((byte, i) => bytes[i] !== byte)
  )
    throw new Error(
      "Unsupported or damaged protected file. Ask the sender to upload it again.",
    );
  try {
    const rawKey = Uint8Array.from(
      atob(keyStringValue.replace(/-/g, "+").replace(/_/g, "/") + "="),
      (c) => c.charCodeAt(0),
    );
    const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, [
      "decrypt",
    ]);
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes.slice(MAGIC.length, HEADER_BYTES),
        additionalData: bytes.slice(0, HEADER_BYTES),
        tagLength: 128,
      },
      key,
      bytes.slice(HEADER_BYTES),
    );
    const plain = new Uint8Array(decrypted);
    const metadataLength = new DataView(decrypted).getUint32(0, false);
    if (
      metadataLength > MAX_METADATA_BYTES ||
      4 + metadataLength > plain.length
    )
      throw new Error("Invalid metadata");
    const metadata: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        plain.slice(4, 4 + metadataLength),
      ),
    );
    if (
      typeof metadata !== "object" ||
      !metadata ||
      !("name" in metadata) ||
      typeof metadata.name !== "string" ||
      !("type" in metadata) ||
      typeof metadata.type !== "string" ||
      !("size" in metadata) ||
      typeof metadata.size !== "number" ||
      !Number.isSafeInteger(metadata.size) ||
      metadata.size < 0 ||
      metadata.size > MAX_ENCRYPTED_FILE_BYTES
    )
      throw new Error("Invalid metadata");
    const payload = plain.slice(4 + metadataLength);
    if (payload.length !== metadata.size) throw new Error("Invalid size");
    // Strip path/control characters: metadata is untrusted even after authentication.
    const name =
      metadata.name
        .split(/[\\/]/)
        .pop()
        ?.replace(/[\u0000-\u001f\u007f]/g, "_") || "download";
    return new File([payload], name, { type: metadata.type });
  } catch {
    throw new Error(
      "Unable to decrypt: the key is wrong or the file is damaged. Ask the sender for the complete link or a new upload.",
    );
  }
}
