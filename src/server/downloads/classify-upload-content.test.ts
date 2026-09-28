import { afterEach, describe, expect, it } from "@jest/globals";
import { open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { classifyUploadContent } from "@/server/downloads/classify-upload-content";

const createdFiles: string[] = [];

async function classify(content: Uint8Array | string) {
  const path = join(tmpdir(), `up-classifier-${randomUUID()}`);
  const bytes = typeof content === "string" ? Buffer.from(content) : content;
  createdFiles.push(path);
  await writeFile(path, bytes);
  const fileHandle = await open(path, "r");

  try {
    return await classifyUploadContent(fileHandle, bytes.byteLength);
  } finally {
    await fileHandle.close();
  }
}

function inline(contentType: string) {
  return { contentType, disposition: "inline" };
}

const attachment = {
  contentType: "application/octet-stream",
  disposition: "attachment",
};

afterEach(async () => {
  await Promise.all(
    createdFiles.splice(0).map((path) => rm(path, { force: true })),
  );
});

describe("classifyUploadContent", () => {
  it.each([
    ["plain UTF-8 text", "hello, zażółć\n", "text/plain; charset=utf-8"],
    [
      "shell source",
      "#!/bin/sh\nprintf '%s\\n' \"safe as inert source\"\n",
      "text/plain; charset=utf-8",
    ],
    [
      "JavaScript source",
      "const answer = 42;\nconsole.log(answer);\n",
      "text/plain; charset=utf-8",
    ],
  ])("serves %s as inert plain text", async (_name, content, contentType) => {
    await expect(classify(content)).resolves.toEqual(inline(contentType));
  });

  it.each([
    ["HTML", "<!doctype html><script>alert(1)</script>"],
    ["SVG", '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'],
    ["XML", '<?xml version="1.0"?><document />'],
  ])("rejects active %s text", async (_name, content) => {
    await expect(classify(content)).resolves.toEqual(attachment);
  });

  it.each([
    [
      "PNG",
      Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]),
        Buffer.from("IHDR"),
        Buffer.alloc(13),
        Buffer.from([0, 0, 0, 0]),
        Buffer.from("IEND"),
        Buffer.alloc(4),
      ]),
      "image/png",
    ],
    [
      "JPEG",
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0xff, 0xd9]),
      "image/jpeg",
    ],
    ["GIF", Buffer.from("GIF89a\0\0\0\0;", "binary"), "image/gif"],
    [
      "PDF",
      Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n"),
      "application/pdf",
    ],
    ["MP3", Buffer.from([0xff, 0xfb, 0x90, 0x64, 0, 0]), "audio/mpeg"],
    [
      "Ogg Opus",
      Buffer.concat([
        Buffer.from("OggS"),
        Buffer.alloc(24),
        Buffer.from("OpusHead"),
      ]),
      "audio/ogg",
    ],
    [
      "WebM",
      Buffer.concat([
        Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
        Buffer.from("\0\0webm\0", "binary"),
      ]),
      "video/webm",
    ],
  ])("recognizes verified %s content", async (_name, content, contentType) => {
    await expect(classify(content)).resolves.toEqual(inline(contentType));
  });

  it.each([
    ["video MP4", "mp42", "video/mp4"],
    ["audio MP4", "M4A ", "audio/mp4"],
    ["QuickTime", "qt  ", "video/quicktime"],
  ])("recognizes %s by its ftyp brand", async (_name, brand, contentType) => {
    const content = Buffer.alloc(24);
    content.writeUInt32BE(24, 0);
    content.write("ftyp", 4, "ascii");
    content.write(brand, 8, "ascii");
    content.write(brand, 16, "ascii");

    await expect(classify(content)).resolves.toEqual(inline(contentType));
  });

  it("recognizes a bounded WAV container", async () => {
    const content = Buffer.alloc(44);
    content.write("RIFF", 0, "ascii");
    content.writeUInt32LE(content.length - 8, 4);
    content.write("WAVE", 8, "ascii");

    await expect(classify(content)).resolves.toEqual(inline("audio/wav"));
  });

  it("rejects HTML renamed as PNG", async () => {
    await expect(
      classify(Buffer.from("<!doctype html><h1>not a PNG</h1>")),
    ).resolves.toEqual(attachment);
  });

  it("rejects a signature-plus-active-content polyglot", async () => {
    const content = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]),
      Buffer.from("IHDR"),
      Buffer.alloc(13),
      Buffer.from("<script>alert(1)</script>"),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("IEND"),
      Buffer.alloc(4),
    ]);

    await expect(classify(content)).resolves.toEqual(attachment);
  });

  it("keeps bounded UTF-8 text safe when a sample boundary splits a character", async () => {
    const content = Buffer.concat([
      Buffer.alloc(64 * 1024 - 1, "a"),
      Buffer.from("ż"),
      Buffer.alloc(64 * 1024, "b"),
    ]);

    await expect(classify(content)).resolves.toEqual(
      inline("text/plain; charset=utf-8"),
    );
  });

  it("detects active content in the bounded tail sample", async () => {
    const content = Buffer.concat([
      Buffer.alloc(128 * 1024, "a"),
      Buffer.from("<script>alert(1)</script>"),
    ]);

    await expect(classify(content)).resolves.toEqual(attachment);
  });

  it.each([
    ["unknown binary", Buffer.from([0, 1, 2, 3, 4])],
    ["Windows executable", Buffer.from("MZ\0\0program", "binary")],
    ["invalid UTF-8", Buffer.from([0xc3, 0x28])],
    ["unverified Ogg", Buffer.from("OggS\0\0unknown", "binary")],
  ])("downloads %s", async (_name, content) => {
    await expect(classify(content)).resolves.toEqual(attachment);
  });

  it("returns attachment fallback for an invalid size without reading", async () => {
    const path = join(tmpdir(), `up-classifier-${randomUUID()}`);
    createdFiles.push(path);
    await writeFile(path, "hello");
    const fileHandle = await open(path, "r");

    try {
      await expect(classifyUploadContent(fileHandle, -1)).resolves.toEqual(
        attachment,
      );
    } finally {
      await fileHandle.close();
    }
  });
});
