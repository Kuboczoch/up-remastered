import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { eq } from "drizzle-orm";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createDbClient, createSqliteConnection } from "@/server/db/client";
import { uploadMetadata } from "@/server/db/schema";
import { createUpload } from "@/server/uploads/create-upload";
import { UploadRequestError } from "@/server/uploads/errors";

let tempDir: string;
let originalEnv: Record<string, string | undefined>;
const TEST_ENV_KEYS = [
  "DATABASE_URL",
  "UPLOAD_DIR",
  "UP_PUBLIC_ORIGIN",
  "DEFAULT_EXPIRATION_HOURS",
  "MAX_EXPIRATION_HOURS",
  "MAX_STORED_BYTES",
  "MAX_UPLOAD_SIZE",
] as const;

beforeEach(async () => {
  originalEnv = Object.fromEntries(
    TEST_ENV_KEYS.map((key) => [key, process.env[key]]),
  );
  tempDir = await mkdtemp(join(tmpdir(), "up-upload-"));

  process.env.DATABASE_URL = pathToFileURL(join(tempDir, "app.db")).toString();
  process.env.UPLOAD_DIR = join(tempDir, "uploads");
  process.env.UP_PUBLIC_ORIGIN = "http://localhost:3000";
  process.env.DEFAULT_EXPIRATION_HOURS = "1";
  process.env.MAX_EXPIRATION_HOURS = "24";
  process.env.MAX_STORED_BYTES = "1024";
  process.env.MAX_UPLOAD_SIZE = "128";
});

afterEach(async () => {
  for (const key of TEST_ENV_KEYS) {
    const value = originalEnv[key];

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  await rm(tempDir, { force: true, recursive: true });
});

function createRawRequest(body: string) {
  return new Request("http://localhost:3000/api/upload", {
    body,
    headers: {
      "content-type": "text/plain",
      "x-file-name": "note.txt",
    },
    method: "POST",
  });
}

function createMultipartRequest(
  fileBody: string,
  fields: Record<string, string> = {},
) {
  const form = new FormData();

  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value);
  }

  form.set("file", new Blob([fileBody], { type: "text/plain" }), "hello.txt");

  return new Request("http://localhost:3000/api/upload", {
    body: form,
    method: "POST",
  });
}

function readUploadRow(id: string) {
  const connection = createSqliteConnection();
  const db = createDbClient(connection);

  try {
    return db
      .select()
      .from(uploadMetadata)
      .where(eq(uploadMetadata.id, id))
      .get();
  } finally {
    connection.close();
  }
}

describe("createUpload", () => {
  it("streams multipart files to disk and writes SQLite metadata", async () => {
    const upload = await createUpload(createMultipartRequest("hello"));
    const row = readUploadRow(upload.id);

    expect(upload).toMatchObject({
      mimeType: "text/plain",
      originalName: "hello.txt",
      shareUrl: `http://localhost:3000/api/download/${upload.id}`,
      size: 5,
    });
    expect(upload.id).toMatch(/^[0-9A-Za-z]{5}$/);
    expect(row).toMatchObject({
      id: upload.id,
      originalName: "hello.txt",
      size: 5,
    });
    await expect(readFile(row?.storagePath ?? "", "utf8")).resolves.toBe(
      "hello",
    );
  });

  it("accepts raw text uploads", async () => {
    const upload = await createUpload(createRawRequest("hello from cli"));
    const row = readUploadRow(upload.id);

    expect(upload).toMatchObject({
      mimeType: "text/plain",
      originalName: "note.txt",
      size: 14,
    });
    await expect(readFile(row?.storagePath ?? "", "utf8")).resolves.toBe(
      "hello from cli",
    );
  });

  it("rejects empty raw uploads", async () => {
    await expect(createUpload(createRawRequest(""))).rejects.toMatchObject({
      code: "missing_upload",
      status: 400,
    } satisfies Partial<UploadRequestError>);
  });

  it("rejects uploads larger than the configured single upload limit", async () => {
    process.env.MAX_UPLOAD_SIZE = "4";

    await expect(createUpload(createRawRequest("12345"))).rejects.toMatchObject(
      {
        code: "upload_too_large",
        status: 413,
      } satisfies Partial<UploadRequestError>,
    );
  });

  it("rejects uploads that exceed the total stored data quota", async () => {
    process.env.MAX_STORED_BYTES = "5";

    await createUpload(createRawRequest("1234"));

    await expect(createUpload(createRawRequest("12"))).rejects.toMatchObject({
      code: "total_storage_limit_exceeded",
      status: 413,
    } satisfies Partial<UploadRequestError>);
  });

  it("rejects expirations beyond the configured maximum", async () => {
    await expect(
      createUpload(createMultipartRequest("hello", { expiresInHours: "25" })),
    ).rejects.toMatchObject({
      code: "expiration_too_large",
      status: 400,
    } satisfies Partial<UploadRequestError>);
  });

  it("rejects non-ISO expiresAt values", async () => {
    await expect(
      createUpload(
        createMultipartRequest("hello", { expiresAt: "Jan 1 2026" }),
      ),
    ).rejects.toMatchObject({
      code: "invalid_expiration",
      status: 400,
    } satisfies Partial<UploadRequestError>);
  });
});
