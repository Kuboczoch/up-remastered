import "server-only";

import type { FileHandle } from "node:fs/promises";

const SAMPLE_BYTES = 64 * 1024;
const ACTIVE_CONTENT_PATTERN =
  /<\s*(?:!doctype\s+html|\?xml\b|html\b|head\b|body\b|script\b|svg\b|iframe\b|object\b|embed\b|math\b)/i;

const ATTACHMENT_CLASSIFICATION = {
  contentType: "application/octet-stream",
  disposition: "attachment",
} as const;

export type UploadContentClassification =
  | {
      contentType:
        | "application/pdf"
        | "audio/flac"
        | "audio/mpeg"
        | "audio/mp4"
        | "audio/ogg"
        | "audio/wav"
        | "image/gif"
        | "image/jpeg"
        | "image/png"
        | "image/webp"
        | "text/plain; charset=utf-8"
        | "video/mp4"
        | "video/ogg"
        | "video/quicktime"
        | "video/webm";
      disposition: "inline";
    }
  | typeof ATTACHMENT_CLASSIFICATION;

type Sample = {
  head: Buffer;
  tail: Buffer;
};

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function includesBytes(
  bytes: Uint8Array,
  signature: readonly number[],
): boolean {
  if (signature.length === 0) {
    return true;
  }

  for (let offset = 0; offset <= bytes.length - signature.length; offset += 1) {
    if (signature.every((byte, index) => bytes[offset + index] === byte)) {
      return true;
    }
  }

  return false;
}

function asciiIncludes(bytes: Uint8Array, value: string): boolean {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).includes(
    value,
    "ascii",
  );
}

function asciiString(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString(
    "ascii",
  );
}

function sampleEnd(sample: Sample): Buffer {
  return sample.tail.length === 0 ? sample.head : sample.tail;
}

function hasActiveContent(sample: Sample): boolean {
  return (
    ACTIVE_CONTENT_PATTERN.test(sample.head.toString("latin1")) ||
    ACTIVE_CONTENT_PATTERN.test(sample.tail.toString("latin1"))
  );
}

function hasPngSignature(sample: Sample): boolean {
  return (
    startsWith(sample.head, [137, 80, 78, 71, 13, 10, 26, 10]) &&
    startsWith(sample.head.subarray(12), [73, 72, 68, 82]) &&
    includesBytes(sampleEnd(sample), [0, 0, 0, 0, 73, 69, 78, 68])
  );
}

function hasJpegSignature(sample: Sample): boolean {
  return (
    startsWith(sample.head, [0xff, 0xd8, 0xff]) &&
    includesBytes(sampleEnd(sample), [0xff, 0xd9])
  );
}

function hasGifSignature(sample: Sample): boolean {
  const header = asciiString(sample.head.subarray(0, 6));
  return (
    (header === "GIF87a" || header === "GIF89a") &&
    sampleEnd(sample).includes(0x3b)
  );
}

function readUInt32Le(bytes: Uint8Array, offset: number): number | undefined {
  if (bytes.length < offset + 4) {
    return undefined;
  }

  return Buffer.from(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).readUInt32LE(offset);
}

function readUInt32Be(bytes: Uint8Array, offset: number): number | undefined {
  if (bytes.length < offset + 4) {
    return undefined;
  }

  return Buffer.from(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).readUInt32BE(offset);
}

function hasRiffType(
  sample: Sample,
  size: number,
  type: "WAVE" | "WEBP",
): boolean {
  const declaredSize = readUInt32Le(sample.head, 4);

  return (
    asciiString(sample.head.subarray(0, 4)) === "RIFF" &&
    asciiString(sample.head.subarray(8, 12)) === type &&
    declaredSize !== undefined &&
    declaredSize + 8 === size
  );
}

function classifyOgg(
  head: Uint8Array,
): UploadContentClassification | undefined {
  if (!startsWith(head, [0x4f, 0x67, 0x67, 0x53])) {
    return undefined;
  }

  if (asciiIncludes(head, "theora")) {
    return { contentType: "video/ogg", disposition: "inline" };
  }

  if (
    asciiIncludes(head, "OpusHead") ||
    asciiIncludes(head, "vorbis") ||
    asciiIncludes(head, "Speex   ") ||
    asciiIncludes(head, "fLaC")
  ) {
    return { contentType: "audio/ogg", disposition: "inline" };
  }

  return ATTACHMENT_CLASSIFICATION;
}

function hasMpegAudioFrame(bytes: Uint8Array, offset = 0): boolean {
  if (bytes.length < offset + 2) {
    return false;
  }

  return bytes[offset] === 0xff && (bytes[offset + 1] & 0xe6) === 0xe2;
}

function hasMp3Signature(head: Uint8Array): boolean {
  if (hasMpegAudioFrame(head)) {
    return true;
  }

  if (asciiString(head.subarray(0, 3)) !== "ID3" || head.length < 10) {
    return false;
  }

  const sizeBytes = head.subarray(6, 10);
  if (sizeBytes.some((byte) => byte > 0x7f)) {
    return false;
  }

  const tagSize = sizeBytes.reduce((size, byte) => (size << 7) | byte, 0);
  return hasMpegAudioFrame(head, 10 + tagSize);
}

function classifyIsoBaseMedia(
  head: Uint8Array,
  size: number,
): UploadContentClassification | undefined {
  const boxSize = readUInt32Be(head, 0);
  if (
    boxSize === undefined ||
    boxSize < 16 ||
    boxSize > size ||
    boxSize > head.length ||
    asciiString(head.subarray(4, 8)) !== "ftyp"
  ) {
    return undefined;
  }

  const brands = asciiString(head.subarray(8, boxSize));

  if (brands.includes("qt  ")) {
    return { contentType: "video/quicktime", disposition: "inline" };
  }

  if (["M4A ", "M4B ", "M4P "].some((brand) => brands.includes(brand))) {
    return { contentType: "audio/mp4", disposition: "inline" };
  }

  if (
    ["isom", "iso2", "mp41", "mp42", "avc1", "M4V "].some((brand) =>
      brands.includes(brand),
    )
  ) {
    return { contentType: "video/mp4", disposition: "inline" };
  }

  return ATTACHMENT_CLASSIFICATION;
}

function classifyBinary(
  sample: Sample,
  size: number,
): UploadContentClassification | undefined {
  if (hasPngSignature(sample)) {
    return { contentType: "image/png", disposition: "inline" };
  }

  if (hasJpegSignature(sample)) {
    return { contentType: "image/jpeg", disposition: "inline" };
  }

  if (hasGifSignature(sample)) {
    return { contentType: "image/gif", disposition: "inline" };
  }

  if (
    hasRiffType(sample, size, "WEBP") &&
    ["VP8 ", "VP8L", "VP8X"].includes(asciiString(sample.head.subarray(12, 16)))
  ) {
    return { contentType: "image/webp", disposition: "inline" };
  }

  if (
    asciiString(sample.head.subarray(0, 5)) === "%PDF-" &&
    asciiIncludes(sampleEnd(sample), "%%EOF")
  ) {
    return { contentType: "application/pdf", disposition: "inline" };
  }

  if (hasRiffType(sample, size, "WAVE")) {
    return { contentType: "audio/wav", disposition: "inline" };
  }

  if (startsWith(sample.head, [0x66, 0x4c, 0x61, 0x43])) {
    return { contentType: "audio/flac", disposition: "inline" };
  }

  if (hasMp3Signature(sample.head)) {
    return { contentType: "audio/mpeg", disposition: "inline" };
  }

  const oggClassification = classifyOgg(sample.head);
  if (oggClassification) {
    return oggClassification;
  }

  const isoClassification = classifyIsoBaseMedia(sample.head, size);
  if (isoClassification) {
    return isoClassification;
  }

  if (
    startsWith(sample.head, [0x1a, 0x45, 0xdf, 0xa3]) &&
    asciiIncludes(sample.head, "webm")
  ) {
    return { contentType: "video/webm", disposition: "inline" };
  }

  return undefined;
}

function decodeTextSample(sample: Sample): string | undefined {
  if (sample.head.includes(0) || sample.tail.includes(0)) {
    return undefined;
  }

  if (sample.tail.length === 0) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(sample.head);
    } catch {
      return undefined;
    }
  }

  let tailStart = 0;
  while (
    tailStart < Math.min(3, sample.tail.length) &&
    (sample.tail[tailStart] & 0xc0) === 0x80
  ) {
    tailStart += 1;
  }

  try {
    const head = new TextDecoder("utf-8", { fatal: true }).decode(sample.head, {
      stream: true,
    });
    const tail = new TextDecoder("utf-8", { fatal: true }).decode(
      sample.tail.subarray(tailStart),
    );
    return `${head}\n${tail}`;
  } catch {
    return undefined;
  }
}

function isPlainText(sample: Sample): boolean {
  const text = decodeTextSample(sample);

  if (text === undefined) {
    return false;
  }

  for (const character of text) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint < 0x20 && ![0x09, 0x0a, 0x0c, 0x0d].includes(codePoint)) {
      return false;
    }
  }

  return !ACTIVE_CONTENT_PATTERN.test(text);
}

async function readSample(
  fileHandle: FileHandle,
  size: number,
): Promise<Sample> {
  const headLength = Math.min(size, SAMPLE_BYTES);
  const head = Buffer.alloc(headLength);
  const { bytesRead: headBytesRead } = await fileHandle.read(
    head,
    0,
    headLength,
    0,
  );

  if (headBytesRead !== headLength) {
    throw new Error("Stored file changed while being classified.");
  }

  if (size <= SAMPLE_BYTES) {
    return { head, tail: Buffer.alloc(0) };
  }

  const tailLength = Math.min(size - headLength, SAMPLE_BYTES);
  const tail = Buffer.alloc(tailLength);
  const { bytesRead: tailBytesRead } = await fileHandle.read(
    tail,
    0,
    tailLength,
    size - tailLength,
  );

  if (tailBytesRead !== tailLength) {
    throw new Error("Stored file changed while being classified.");
  }

  return { head, tail };
}

export async function classifyUploadContent(
  fileHandle: FileHandle,
  size: number,
): Promise<UploadContentClassification> {
  if (!Number.isSafeInteger(size) || size < 0) {
    return ATTACHMENT_CLASSIFICATION;
  }

  const sample = await readSample(fileHandle, size);
  const binaryClassification = classifyBinary(sample, size);

  if (binaryClassification) {
    return binaryClassification.disposition === "inline" &&
      hasActiveContent(sample)
      ? ATTACHMENT_CLASSIFICATION
      : binaryClassification;
  }

  if (isPlainText(sample)) {
    return {
      contentType: "text/plain; charset=utf-8",
      disposition: "inline",
    };
  }

  return ATTACHMENT_CLASSIFICATION;
}
