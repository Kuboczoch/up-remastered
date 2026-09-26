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
  it("streams an available file with safe download headers", async () => {
    const { id, storedName } = insertUpload();
    await writeFile(join(process.env.UPLOAD_DIR!, storedName), "hello");

    const response = await createDownloadResponse(
      id,
      null,
      new Date("2026-01-02T00:00:00.000Z"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("content-length")).toBe("5");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="report.txt"',
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
      'attachment; filename="report.txt"',
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

  it("forces active browser content to download instead of executing inline", async () => {
    const { id, storedName } = insertUpload({
      mimeType: "text/html",
      originalName: "page.html",
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

    expect(response.headers.get("content-type")).toBe("text/html");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="page.html"',
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await response.body?.cancel();
  });

  it("delivers QuickTime movies with ranges and a safe attachment disposition", async () => {
    const { id, storedName } = insertUpload({
      mimeType: "video/quicktime",
      originalName: "clip.mov",
    });
    await writeFile(join(process.env.UPLOAD_DIR!, storedName), "movie");

    const response = await createDownloadResponse(
      id,
      "bytes=1-3",
      new Date("2026-01-02T00:00:00.000Z"),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("video/quicktime");
    expect(response.headers.get("content-range")).toBe("bytes 1-3/5");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="clip.mov"',
    );
    await expect(response.text()).resolves.toBe("ovi");
  });

  it("falls back from unsafe media types without injecting headers", async () => {
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
      "application/octet-stream",
    );
    expect(response.headers.get("x-unsafe")).toBeNull();
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
