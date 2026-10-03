/** @jest-environment node */
import { createCipheriv, createDecipheriv } from "node:crypto";
import { describe, expect, it } from "@jest/globals";
import {
  decryptFile,
  encryptFile,
  MAX_ENCRYPTED_FILE_BYTES,
} from "./encryption";

const VECTOR_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const VECTOR = Buffer.from(
  "VVBFTkMBAAAAAAAAAAAAAAAAzqdAFDZCBQ9qK+fpmIX4ewYPceRD3l5W/YCB9wVjF7T/PtRQOWWRFyCBNwY6XH30Q1XL4YG7fzBhXR1lDRwMGtDEj3YhqC0zYJWshij9AsjZwyXfkIWnL/K8CGZUXh2tq/pWzegjyhJasL3F4Cz8Kb4K4asoN+DzY4e3DpMXYBJDYqTSCr2k+jL66DQsnNKGoBRwluJyT6jlDfU34LGlfgPWips46ifVsgAA8g==",
  "base64",
);

// Independently reauthenticate malformed plaintext so rejection exercises the
// metadata/ZIP parser, not merely the GCM authentication failure path.
function authenticatedFixture(mutate: (plain: Buffer) => Buffer): ArrayBuffer {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.alloc(32),
    VECTOR.subarray(6, 18),
  );
  decipher.setAAD(VECTOR.subarray(0, 18));
  decipher.setAuthTag(VECTOR.subarray(-16));
  const plain = Buffer.concat([
    decipher.update(VECTOR.subarray(18, -16)),
    decipher.final(),
  ]);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.alloc(32),
    VECTOR.subarray(6, 18),
  );
  cipher.setAAD(VECTOR.subarray(0, 18));
  const ciphertext = Buffer.concat([
    cipher.update(mutate(plain)),
    cipher.final(),
  ]);
  return Uint8Array.from(
    Buffer.concat([VECTOR.subarray(0, 18), ciphertext, cipher.getAuthTag()]),
  ).buffer;
}

function replaceMetadata(plain: Buffer, metadata: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(metadata.length);
  return Buffer.concat([
    length,
    metadata,
    plain.subarray(4 + plain.readUInt32BE(0)),
  ]);
}

describe("protected file envelope", () => {
  it("decrypts a fixed independent Python ZIP / OpenSSL envelope vector", async () => {
    // Zero key/IV are TEST-ONLY; production uses fresh random bytes. ZIP was
    // generated with Python zipfile (DOS date 1980-01-01, cleared attributes).
    const fixture = VECTOR;
    const result = await decryptFile(
      Uint8Array.from(fixture).buffer,
      VECTOR_KEY,
    );
    expect(result.name).toBe("vector.txt");
    expect(result.type).toBe("text/plain");
    expect(await result.text()).toBe("hello");
  });
  it("is independently authenticated by the OpenSSL AES-GCM implementation", async () => {
    const result = await encryptFile(
      new File(["hello"], "vector.txt", { type: "text/plain" }),
    );
    const bytes = Buffer.from(await result.file.arrayBuffer());
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(result.key, "base64url"),
      bytes.subarray(6, 18),
    );
    decipher.setAAD(bytes.subarray(0, 18));
    decipher.setAuthTag(bytes.subarray(-16));
    const plaintext = Buffer.concat([
      decipher.update(bytes.subarray(18, -16)),
      decipher.final(),
    ]);
    const metadataLength = plaintext.readUInt32BE(0);
    expect(
      JSON.parse(plaintext.subarray(4, 4 + metadataLength).toString()),
    ).toEqual({ name: "vector.txt", type: "text/plain" });
    const archive = plaintext.subarray(4 + metadataLength);
    expect(archive.readUInt32LE(0)).toBe(0x04034b50);
    expect(archive.readUInt16LE(8)).toBe(0); // stored ZIP entry
    expect(archive.readUInt32LE(18)).toBe(5);
    expect(archive.subarray(30, 34).toString()).toBe("file");
    expect(archive.subarray(34, 39).toString()).toBe("hello");
    expect(archive.readUInt32LE(39)).toBe(0x02014b50);
    expect(archive.readUInt32LE(89)).toBe(0x06054b50);
  });
  it("round trips binary bytes and private Unicode metadata", async () => {
    const file = new File([new Uint8Array([0, 255, 1, 2])], "秘密.txt", {
      type: "text/plain",
    });
    const encrypted = await encryptFile(file);
    expect(encrypted.file.name).toBe("encrypted.up");
    expect(encrypted.file.type).toBe("application/octet-stream");
    expect(await encrypted.file.text()).not.toContain("秘密");
    expect(encrypted.key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const result = await decryptFile(
      await encrypted.file.arrayBuffer(),
      encrypted.key,
    );
    expect(result.name).toBe(file.name);
    expect(result.type).toBe(file.type);
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(
      new Uint8Array(await file.arrayBuffer()),
    );
  });
  it.each<[string, (plain: Buffer) => Buffer]>([
    ["truncated metadata length", () => Buffer.alloc(3)],
    [
      "oversized metadata length",
      (plain) => {
        plain.writeUInt32BE(plain.length);
        return plain;
      },
    ],
    ["invalid JSON", (plain) => replaceMetadata(plain, Buffer.from("{"))],
    ["null metadata", (plain) => replaceMetadata(plain, Buffer.from("null"))],
    [
      "non-string filename",
      (plain) =>
        replaceMetadata(
          plain,
          Buffer.from('{"name":42,"type":"text/plain","size":15}'),
        ),
    ],
    [
      "non-string content type",
      (plain) =>
        replaceMetadata(
          plain,
          Buffer.from('{"name":"vector.txt","type":null,"size":15}'),
        ),
    ],
    [
      "invalid UTF-8 metadata",
      (plain) => replaceMetadata(plain, Buffer.from([0xff])),
    ],
    [
      "missing content type",
      (plain) => replaceMetadata(plain, Buffer.from('{"name":"vector.txt"}')),
    ],
    [
      "invalid ZIP signature",
      (plain) => {
        plain[4 + plain.readUInt32BE(0)] ^= 0xff;
        return plain;
      },
    ],
    [
      "truncated ZIP directory",
      (plain) => plain.subarray(0, plain.length - 10),
    ],
    [
      "unexpected ZIP entry name",
      (plain) => {
        const zipOffset = 4 + plain.readUInt32BE(0);
        plain[zipOffset + 30] ^= 0xff;
        return plain;
      },
    ],
  ])("rejects authenticated malformed %s", async (_name, mutate) => {
    await expect(
      decryptFile(authenticatedFixture(mutate), VECTOR_KEY),
    ).rejects.toThrow();
  });

  it.each([0, 5, 17, 18, 33, 50])(
    "rejects an envelope truncated to %i bytes",
    async (length) => {
      await expect(
        decryptFile(
          Uint8Array.from(VECTOR.subarray(0, length)).buffer,
          VECTOR_KEY,
        ),
      ).rejects.toThrow();
    },
  );

  it("rejects interior ciphertext tampering independently of the authentication tag", async () => {
    const tampered = Uint8Array.from(VECTOR);
    tampered[18 + Math.floor((tampered.length - 34) / 2)] ^= 0x80;
    await expect(decryptFile(tampered.buffer, VECTOR_KEY)).rejects.toThrow();
  });

  it("generates fresh keys and IVs for identical files", async () => {
    const file = new File(["hello"], "hello.txt");
    const a = await encryptFile(file);
    const b = await encryptFile(file);
    expect(a.key).not.toBe(b.key);
    expect(new Uint8Array(await a.file.arrayBuffer())).not.toEqual(
      new Uint8Array(await b.file.arrayBuffer()),
    );
  });
  it("rejects wrong keys, modified ciphertext, header and missing keys", async () => {
    const a = await encryptFile(new File(["secret"], "secret.txt"));
    const b = await encryptFile(new File(["other"], "other.txt"));
    const bytes = await a.file.arrayBuffer();
    await expect(decryptFile(bytes, b.key)).rejects.toThrow(/key|damaged/i);
    const modified = new Uint8Array(bytes.slice(0));
    modified[modified.length - 1] ^= 1;
    await expect(decryptFile(modified.buffer, a.key)).rejects.toThrow(
      /key|damaged/i,
    );
    modified[0] ^= 1;
    await expect(decryptFile(modified.buffer, a.key)).rejects.toThrow();
    await expect(decryptFile(bytes, "")).rejects.toThrow(/key/i);
  });
  it("fails closed above the explicit memory limit and after cancellation", async () => {
    const fake = { size: MAX_ENCRYPTED_FILE_BYTES + 1 } as File;
    await expect(encryptFile(fake)).rejects.toThrow(/32 MiB/);
    const controller = new AbortController();
    controller.abort();
    await expect(
      encryptFile(new File(["x"], "x"), controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
