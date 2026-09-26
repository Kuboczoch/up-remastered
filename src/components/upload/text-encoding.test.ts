import { describe, expect, it } from "@jest/globals";
import { TextEncoder } from "node:util";

import {
  createTextFile,
  DEFAULT_TEXT_ENCODING,
  encodeText,
} from "./text-encoding";

Object.defineProperty(globalThis, "TextEncoder", {
  configurable: true,
  value: TextEncoder,
});

function readFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", () => reject(reader.error));
    reader.addEventListener("load", () =>
      resolve(reader.result as ArrayBuffer),
    );
    reader.readAsArrayBuffer(file);
  });
}

describe("browser text encoding", () => {
  it("uses UTF-8 by default for bytes and MIME metadata", async () => {
    const file = createTextFile("Aé😀", "pasted-text.txt");

    expect(DEFAULT_TEXT_ENCODING).toBe("utf-8");
    expect(file.type).toBe("text/plain;charset=utf-8");
    expect(Array.from(new Uint8Array(await readFile(file)))).toEqual([
      0x41, 0xc3, 0xa9, 0xf0, 0x9f, 0x98, 0x80,
    ]);
  });

  it.each([
    ["utf-16le", [0x41, 0x00, 0xe9, 0x00, 0x3d, 0xd8, 0x00, 0xde]],
    ["utf-16be", [0x00, 0x41, 0x00, 0xe9, 0xd8, 0x3d, 0xde, 0x00]],
  ] as const)("encodes text as %s without a BOM", (encoding, expected) => {
    expect(Array.from(encodeText("Aé😀", encoding))).toEqual(expected);
    expect(createTextFile("text", "text.txt", encoding).type).toBe(
      `text/plain;charset=${encoding}`,
    );
  });
});
