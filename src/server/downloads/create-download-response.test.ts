import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createDbClient, createSqliteConnection } from "@/server/db/client";
import { migrateDatabase } from "@/server/db/migrate";
import { uploadMetadata } from "@/server/db/schema";
import {
  createDownloadHeadResponse,
  createDownloadResponse,
} from "@/server/downloads/create-download-response";

let tempDir: string;
let originalDatabaseUrl: string | undefined;
let originalUploadDir: string | undefined;

beforeEach(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL;
  originalUploadDir = process.env.UPLOAD_DIR;
  tempDir = await mkdtemp(join(tmpdir(), "up-download-"));
  process.env.DATABASE_URL = pathToFileURL(join(tempDir, "app.db")).toString();
  process.env.UPLOAD_DIR = join(tempDir, "uploads");
  await mkdir(process.env.UPLOAD_DIR, { recursive: true });
  migrateDatabase();
});

afterEach(async () => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }

  if (originalUploadDir === undefined) {
    delete process.env.UPLOAD_DIR;
  } else {
    process.env.UPLOAD_DIR = originalUploadDir;
  }

  await rm(tempDir, { force: true, recursive: true });
});

function insertUpload({
  expiresAt = new Date("2026-02-01T00:00:00.000Z"),
  id = "A7Z20",
  mimeType = "text/plain",
  originalName = "report.txt",
  storedName = `${id}.bin`,
}: {
  expiresAt?: Date;
  id?: string;
  mimeType?: string;
  originalName?: string;
  storedName?: string;
} = {}) {
  const connection = createSqliteConnection();
  const db = createDbClient(connection);

  try {
    db.insert(uploadMetadata)
      .values({
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt,
        id,
        mimeType,
        originalName,
        size: 5,
        storagePath: join(process.env.UPLOAD_DIR!, storedName),
        storedName,
      })
      .run();
  } finally {
    connection.close();
  }

  return { id, storedName };
}

describe("createDownloadResponse", () => {
  it("streams verified inert text inline with isolated response headers", async () => {
    const { id, storedName } = insertUpload();
    await writeFile(join(process.env.UPLOAD_DIR!, storedName), "hello");

    const response = await createDownloadResponse(
      id,
      null,
      new Date("2026-01-02T00:00:00.000Z"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("content-length")).toBe("5");
    expect(response.headers.get("content-disposition")).toBe(
      "inline; filename=\"report.txt\"; filename*=UTF-8''report.txt",
    );
    expect(response.headers.get("content-security-policy")).toBe(
      "sandbox; default-src 'none'",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(response.text()).resolves.toBe("hello");
  });

  it("serves HEAD metadata without opening a response stream", async () => {
    const { id, storedName } = insertUpload();
    await writeFile(join(process.env.UPLOAD_DIR!, storedName), "hello");

    const response = await createDownloadHeadResponse(
      id,
      null,
      new Date("2026-01-02T00:00:00.000Z"),
    );

    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    expect(response.headers.get("content-length")).toBe("5");
    expect(response.headers.get("content-disposition")).toBe(
      "inline; filename=\"report.txt\"; filename*=UTF-8''report.txt",
    );
  });

  it("serves valid single byte ranges", async () => {
    const { id, storedName } = insertUpload();
    await writeFile(join(process.env.UPLOAD_DIR!, storedName), "hello");

    const response = await createDownloadResponse(
      id,
      "bytes=1-3",
      new Date("2026-01-02T00:00:00.000Z"),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-range")).toBe("bytes 1-3/5");
    expect(response.headers.get("content-length")).toBe("3");
    await expect(response.text()).resolves.toBe("ell");
  });

  it("falls back to full content for unsupported ranges", async () => {
    const { id, storedName } = insertUpload();
    await writeFile(join(process.env.UPLOAD_DIR!, storedName), "hello");

    const response = await createDownloadResponse(
      id,
      "bytes=-2",
      new Date("2026-01-02T00:00:00.000Z"),
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("hello");
  });

  it("returns 416 when a range starts beyond EOF", async () => {
    const { id, storedName } = insertUpload();
    await writeFile(join(process.env.UPLOAD_DIR!, storedName), "hello");

    const response = await createDownloadResponse(
      id,
      "bytes=5-",
      new Date("2026-01-02T00:00:00.000Z"),
    );

    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */5");
  });

  it("returns the same unavailable response for malformed and missing IDs", async () => {
    const malformed = await createDownloadResponse("abc");
    const missing = await createDownloadResponse("ZZZZZ");

    expect(malformed.status).toBe(404);
    expect(missing.status).toBe(404);
    await expect(malformed.text()).resolves.toBe("File unavailable.\n");
    await expect(missing.text()).resolves.toBe("File unavailable.\n");
  });

  it("rejects expired uploads at download time", async () => {
    const { id, storedName } = insertUpload({
      expiresAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await writeFile(join(process.env.UPLOAD_DIR!, storedName), "hello");

    const response = await createDownloadResponse(
      id,
      null,
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(response.status).toBe(404);
  });

  it("handles missing physical files gracefully", async () => {
    const { id } = insertUpload();

    const response = await createDownloadResponse(
      id,
      null,
      new Date("2026-01-02T00:00:00.000Z"),
    );

    expect(response.status).toBe(404);
  });

  it("forces renamed HTML to download instead of executing inline", async () => {
    const { id, storedName } = insertUpload({
      mimeType: "image/png",
      originalName: "photo.png",
    });
    await writeFile(
      join(process.env.UPLOAD_DIR!, storedName),
      "<script>alert(1)</script>",
    );

    const response = await createDownloadResponse(
      id,
      null,
      new Date("2026-01-02T00:00:00.000Z"),
    );

    expect(response.headers.get("content-type")).toBe(
      "application/octet-stream",
    );
    expect(response.headers.get("content-disposition")).toBe(
      "attachment; filename=\"photo.png\"; filename*=UTF-8''photo.png",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await response.body?.cancel();
  });

  it("delivers verified QuickTime movies inline with ranges", async () => {
    const { id, storedName } = insertUpload({
      mimeType: "video/quicktime",
      originalName: "clip.mov",
    });
    const movie = Buffer.alloc(24);
    movie.writeUInt32BE(24, 0);
    movie.write("ftyp", 4, "ascii");
    movie.write("qt  ", 8, "ascii");
    movie.write("qt  ", 16, "ascii");
    await writeFile(join(process.env.UPLOAD_DIR!, storedName), movie);

    const response = await createDownloadResponse(
      id,
      "bytes=1-3",
      new Date("2026-01-02T00:00:00.000Z"),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("video/quicktime");
    expect(response.headers.get("content-range")).toBe("bytes 1-3/24");
    expect(response.headers.get("content-disposition")).toBe(
      "inline; filename=\"clip.mov\"; filename*=UTF-8''clip.mov",
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      movie.subarray(1, 4),
    );
  });

  it("uses verified content instead of unsafe stored media types", async () => {
    const { id, storedName } = insertUpload({
      mimeType: "text/html\r\nX-Unsafe: yes",
    });
    await writeFile(join(process.env.UPLOAD_DIR!, storedName), "hello");

    const response = await createDownloadResponse(
      id,
      null,
      new Date("2026-01-02T00:00:00.000Z"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("x-unsafe")).toBeNull();
    await response.body?.cancel();
  });

  it("forces verified safe content to download when requested", async () => {
    const { id, storedName } = insertUpload();
    await writeFile(join(process.env.UPLOAD_DIR!, storedName), "hello");

    const response = await createDownloadResponse(
      id,
      null,
      new Date("2026-01-02T00:00:00.000Z"),
      true,
    );

    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toBe(
      "attachment; filename=\"report.txt\"; filename*=UTF-8''report.txt",
    );
    await response.body?.cancel();
  });

  it("emits CRLF-safe RFC 6266 fallback and UTF-8 filenames", async () => {
    const { id, storedName } = insertUpload({
      originalName: "folder/zażółć\r\nreport.txt",
    });
    await writeFile(join(process.env.UPLOAD_DIR!, storedName), "hello");

    const response = await createDownloadResponse(
      id,
      null,
      new Date("2026-01-02T00:00:00.000Z"),
    );

    expect(response.headers.get("content-disposition")).toBe(
      "inline; filename=\"za______report.txt\"; filename*=UTF-8''za%C5%BC%C3%B3%C5%82%C4%87__report.txt",
    );
    await response.body?.cancel();
  });

  it.each([
    ["scripted SVG", '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'],
    ["unsupported binary", Buffer.from([0, 1, 2, 3, 4])],
    [
      "signature polyglot",
      Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]),
        Buffer.from("IHDR"),
        Buffer.alloc(13),
        Buffer.from("<script>alert(1)</script>"),
        Buffer.from([0, 0, 0, 0]),
        Buffer.from("IEND"),
        Buffer.alloc(4),
      ]),
    ],
  ])("forces %s to an opaque attachment", async (_name, content) => {
    const { id, storedName } = insertUpload({ originalName: "unsafe.bin" });
    await writeFile(join(process.env.UPLOAD_DIR!, storedName), content);

    const response = await createDownloadResponse(
      id,
      null,
      new Date("2026-01-02T00:00:00.000Z"),
    );

    expect(response.headers.get("content-type")).toBe(
      "application/octet-stream",
    );
    expect(
      response.headers.get("content-disposition")?.startsWith("attachment;"),
    ).toBe(true);
    await response.body?.cancel();
  });

  it("rejects stored paths outside the upload directory", async () => {
    const { id } = insertUpload({ storedName: "../outside.bin" });
    await writeFile(join(tempDir, "outside.bin"), "hello");

    const response = await createDownloadResponse(
      id,
      null,
      new Date("2026-01-02T00:00:00.000Z"),
    );

    expect(response.status).toBe(404);
  });
});
