import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { eq } from "drizzle-orm";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createDbClient, createSqliteConnection } from "@/server/db/client";
import { ensureDatabaseMigrated } from "@/server/db/migrate";
import { uploadIdReservations, uploadMetadata } from "@/server/db/schema";
import { hashUploadAccessToken } from "@/server/uploads/access-token";
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
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    "stores a finite %s-download limit with zero admissions",
    async (limit) => {
      const result = await createUpload(
        createMultipartRequest("hello", { maxDownloads: String(limit) }),
        () => "ABCDE",
      );
      expect(result).toMatchObject({ maxDownloads: limit });
      expect(readUploadRow(result.id)).toMatchObject({
        maxDownloads: limit,
        downloadCount: 0,
      });
    },
  );
  it.each([undefined, "unlimited"])(
    "defaults %s to unlimited",
    async (limit) => {
      const result = await createUpload(
        createMultipartRequest(
          "hello",
          limit === undefined ? {} : { maxDownloads: limit },
        ),
        () => "ABCDE",
      );
      expect(result).toMatchObject({ maxDownloads: null });
      expect(readUploadRow(result.id)).toMatchObject({
        maxDownloads: null,
        downloadCount: 0,
      });
    },
  );
  it.each(["", "0", "11", "1.5", "01", " 1", "1 ", "+1", "1e0", "Unlimited"])(
    "rejects invalid download limit %j",
    async (limit) => {
      await expect(
        createUpload(createMultipartRequest("hello", { maxDownloads: limit })),
      ).rejects.toMatchObject({ code: "invalid_max_downloads", status: 400 });
    },
  );
  it("rejects duplicate limit fields", async () => {
    const form = new FormData();
    form.append("text", "hello");
    form.append("maxDownloads", "1");
    form.append("maxDownloads", "unlimited");
    await expect(
      createUpload(
        new Request("http://localhost:3000/api/upload", {
          method: "POST",
          body: form,
        }),
      ),
    ).rejects.toMatchObject({ code: "invalid_max_downloads", status: 400 });
  });
  it("streams multipart files to disk and writes hashed token metadata", async () => {
    const accessToken = "a".repeat(128);
    const upload = await createUpload(
      createMultipartRequest("hello"),
      undefined,
      () => accessToken,
    );
    const row = readUploadRow(upload.id);

    expect(upload).toMatchObject({
      accessToken,
      mimeType: "text/plain; charset=utf-8",
      originalName: "hello.txt",
      shareUrl: `http://localhost:3000/${upload.id}`,
      size: 5,
    });
    expect(upload.id).toMatch(/^[0-9A-Z]{5}$/);
    expect(row).toMatchObject({
      accessTokenHash: hashUploadAccessToken(accessToken),
      id: upload.id,
      originalName: "hello.txt",
      size: 5,
    });
    await expect(readFile(row?.storagePath ?? "", "utf8")).resolves.toBe(
      "hello",
    );
  });

  it("retries ID collisions before committing metadata and storage", async () => {
    const firstUpload = await createUpload(
      createRawRequest("first"),
      () => "AAAAA",
    );
    const candidateIds = ["AAAAA", "BBBBB"];
    const secondUpload = await createUpload(
      createRawRequest("second"),
      () => candidateIds.shift() ?? "CCCCC",
    );

    expect(firstUpload.id).toBe("AAAAA");
    expect(secondUpload.id).toBe("BBBBB");
    await expect(
      readFile(readUploadRow(firstUpload.id)?.storagePath ?? "", "utf8"),
    ).resolves.toBe("first");
    await expect(
      readFile(readUploadRow(secondUpload.id)?.storagePath ?? "", "utf8"),
    ).resolves.toBe("second");
  });

  it("skips IDs reserved before upload metadata exists", async () => {
    ensureDatabaseMigrated();
    const connection = createSqliteConnection();
    createDbClient(connection)
      .insert(uploadIdReservations)
      .values({ id: "AAAAA", createdAt: new Date() })
      .run();
    connection.close();
    const candidateIds = ["AAAAA", "BBBBB"];

    const upload = await createUpload(
      createRawRequest("reserved namespace"),
      () => candidateIds.shift() ?? "CCCCC",
    );

    expect(upload.id).toBe("BBBBB");
  });

  it("persists simultaneous upload requests without breaking SQLite", async () => {
    const uploads = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        createUpload(createRawRequest(`parallel-${index}`)),
      ),
    );

    expect(new Set(uploads.map(({ id }) => id)).size).toBe(8);
    for (const upload of uploads) {
      expect(readUploadRow(upload.id)).toMatchObject({ id: upload.id });
    }
  });

  it("accepts raw text uploads", async () => {
    const upload = await createUpload(createRawRequest("hello from cli"));
    const row = readUploadRow(upload.id);

    expect(upload).toMatchObject({
      mimeType: "text/plain; charset=utf-8",
      originalName: "note.txt",
      size: 14,
    });
    await expect(readFile(row?.storagePath ?? "", "utf8")).resolves.toBe(
      "hello from cli",
    );
  });

  it("ignores bounded extra multipart fields and file parts", async () => {
    const form = new FormData();
    form.set("client", "upstream");
    form.set("preview", new Blob(["ignored"]), "preview.txt");
    form.set("file", new Blob(["kept"]), "kept.bin");
    const request = new Request("http://localhost:3000/api/upload", {
      body: form,
      method: "POST",
    });

    const upload = await createUpload(request);

    expect(upload).toMatchObject({ originalName: "kept.bin", size: 4 });
  });

  it("falls back to application/octet-stream for missing MIME", async () => {
    const form = new FormData();
    form.set("file", new Blob(["data"]), "unknown.bin");
    const request = new Request("http://localhost:3000/api/upload", {
      body: form,
      method: "POST",
    });

    await expect(createUpload(request)).resolves.toMatchObject({
      mimeType: "application/octet-stream",
    });
  });

  it("normalizes malformed multipart requests", async () => {
    const request = new Request("http://localhost:3000/api/upload", {
      body: "broken",
      headers: { "content-type": "multipart/form-data" },
      method: "POST",
    });

    await expect(createUpload(request)).rejects.toMatchObject({
      code: "invalid_multipart",
      status: 400,
    } satisfies Partial<UploadRequestError>);
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
