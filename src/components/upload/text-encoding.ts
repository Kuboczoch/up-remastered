export const TEXT_ENCODINGS = [
  { label: "UTF-8", value: "utf-8" },
  { label: "UTF-16 little-endian", value: "utf-16le" },
  { label: "UTF-16 big-endian", value: "utf-16be" },
] as const;

export type TextEncoding = (typeof TEXT_ENCODINGS)[number]["value"];

export const DEFAULT_TEXT_ENCODING: TextEncoding = "utf-8";

export function encodeText(
  text: string,
  encoding: TextEncoding = DEFAULT_TEXT_ENCODING,
): Uint8Array<ArrayBuffer> {
  if (encoding === "utf-8") {
    return new TextEncoder().encode(text);
  }

  // TextEncoder intentionally supports only UTF-8. JavaScript strings already
  // expose UTF-16 code units, so the two UTF-16 byte orders need only this
  // small, deterministic conversion rather than a browser-bundled dependency.
  const bytes = new Uint8Array(new ArrayBuffer(text.length * 2));
  const view = new DataView(bytes.buffer);
  const littleEndian = encoding === "utf-16le";

  for (let index = 0; index < text.length; index += 1) {
    view.setUint16(index * 2, text.charCodeAt(index), littleEndian);
  }

  return bytes;
}

export function createTextFile(
  text: string,
  name: string,
  encoding: TextEncoding = DEFAULT_TEXT_ENCODING,
): File {
  return new File([encodeText(text, encoding)], name, {
    type: `text/plain;charset=${encoding}`,
  });
}
