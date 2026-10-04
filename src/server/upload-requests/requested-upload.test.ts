import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { eq } from "drizzle-orm";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createDbClient, createSqliteConnection } from "@/server/db/client";
import { uploadRequests } from "@/server/db/schema";
import { UploadRequestError } from "@/server/uploads/errors";

import {
  createRequestedUpload,
  fulfillRequestedUpload,
  getActiveRequestedUpload,
  getRecipientRequestAvailability,
  inspectRequestedUpload,
  revokeRequestedUpload,
  validateUploadRequestInput,
} from "./requested-upload";
import { hashCapabilityToken } from "./capability-token";

let tempDir: string;
let originalEnv: Record<string, string | undefined>;
const ENV_KEYS = [
  "DATABASE_URL",
  "UPLOAD_DIR",
  "UP_PUBLIC_ORIGIN",
  "DEFAULT_EXPIRATION_HOURS",
  "MAX_EXPIRATION_HOURS",
  "MAX_STORED_BYTES",
  "MAX_UPLOAD_SIZE",
] as const;
const NOW = new Date("2026-09-26T18:00:00.000Z");
const PUBLIC_TOKEN = "a".repeat(64);
const MANAGEMENT_TOKEN = "b".repeat(64);
const RESERVED_UPLOAD_ID = "R3QST";

beforeEach(async () => {
  originalEnv = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );
  tempDir = await mkdtemp(join(tmpdir(), "up-request-"));
  process.env.DATABASE_URL = pathToFileURL(join(tempDir, "app.db")).toString();
  process.env.UPLOAD_DIR = join(tempDir, "uploads");
  process.env.UP_PUBLIC_ORIGIN = "https://up.example";
  process.env.DEFAULT_EXPIRATION_HOURS = "1";
  process.env.MAX_EXPIRATION_HOURS = "24";
  process.env.MAX_STORED_BYTES = "1024";
  process.env.MAX_UPLOAD_SIZE = "128";
});

afterEach(async () => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(tempDir, { force: true, recursive: true });
});

function input(maxBytes = 16) {
  return { expiresAt: "2026-09-26T19:00:00.000Z", maxBytes };
}

function raw(body: string) {
  return new Request("https://up.example/api/upload", {
    body,
    headers: { "content-type": "text/plain", "x-file-name": "request.txt" },
    method: "POST",
  });
}

function createRequest() {
  const tokens = [PUBLIC_TOKEN, MANAGEMENT_TOKEN];
  return createRequestedUpload(
    input(),
    NOW,
    () => tokens.shift()!,
    () => RESERVED_UPLOAD_ID,
  );
}

describe("requested uploads", () => {
  it("validates bounded strict-UTC input", () => {
    expect(validateUploadRequestInput(input(), NOW)).toMatchObject({
      maxBytes: 16,
    });
    for (const invalid of [
      { expiresAt: "2026-09-26 19:00:00", maxBytes: 16 },
      { expiresAt: "2026-09-26T19:00:00.000Z", maxBytes: 0 },
      { expiresAt: "2026-09-26T19:00:00.000Z", maxBytes: 129 },
      { ...input(), redirect: "https://evil.example" },
    ]) {
      expect(() => validateUploadRequestInput(invalid, NOW)).toThrow(
        UploadRequestError,
      );
    }
  });

  it("stores only token hashes and exposes separate owner/public capabilities", () => {
    const created = createRequest();
    const connection = createSqliteConnection();
    const row = createDbClient(connection)
      .select()
      .from(uploadRequests)
      .where(
        eq(uploadRequests.publicTokenHash, hashCapabilityToken(PUBLIC_TOKEN)),
      )
      .get();
    connection.close();

    expect(created).toMatchObject({
      managementToken: MANAGEMENT_TOKEN,
      managementUrl: `https://up.example/request/manage#${MANAGEMENT_TOKEN}`,
      maxBytes: 16,
      shareUrl: `https://up.example/${RESERVED_UPLOAD_ID}`,
      status: "active",
      statusChangedAt: NOW.toISOString(),
      uploadId: RESERVED_UPLOAD_ID,
      uploadUrl: `https://up.example/request/${PUBLIC_TOKEN}`,
    });
    expect(row).toMatchObject({
      managementTokenHash: hashCapabilityToken(MANAGEMENT_TOKEN),
      publicTokenHash: hashCapabilityToken(PUBLIC_TOKEN),
      uploadId: RESERVED_UPLOAD_ID,
    });
    expect(JSON.stringify(row)).not.toContain(PUBLIC_TOKEN);
    expect(JSON.stringify(row)).not.toContain(MANAGEMENT_TOKEN);
  });

  it("allows exactly one successful upload under the request cap", async () => {
    createRequest();
    const [first, second] = await Promise.allSettled([
      fulfillRequestedUpload(PUBLIC_TOKEN, raw("first"), NOW),
      fulfillRequestedUpload(PUBLIC_TOKEN, raw("second"), NOW),
    ]);

    expect([first.status, second.status].sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(getActiveRequestedUpload(PUBLIC_TOKEN, NOW)).toBeUndefined();
    expect(inspectRequestedUpload(MANAGEMENT_TOKEN, NOW)).toMatchObject({
      shareUrl: `https://up.example/${RESERVED_UPLOAD_ID}`,
      status: "consumed",
      uploadId: RESERVED_UPLOAD_ID,
    });
    await expect(
      fulfillRequestedUpload(PUBLIC_TOKEN, raw("third"), NOW),
    ).rejects.toMatchObject({
      code: "upload_request_unavailable",
      status: 404,
    });
  });

  it.each(["raw", "multipart"])(
    "releases an actually aborted %s stream, removes partial files, and accepts retry",
    async (kind) => {
      createRequest();
      const controller = new AbortController();
      const disposed = jest.fn();
      const stream = new ReadableStream<Uint8Array>({
        start(streamController) {
          streamController.enqueue(
            Buffer.from(
              kind === "raw"
                ? "partial"
                : '--slow\r\nContent-Disposition: form-data; name="file"; filename="slow.txt"\r\nContent-Type: text/plain\r\n\r\npartial',
            ),
          );
        },
        cancel: disposed,
      });
      const request = new Request(
        "http://localhost/api/upload-requests/upload",
        {
          body: stream,
          duplex: "half",
          headers: {
            "content-type":
              kind === "raw"
                ? "text/plain"
                : "multipart/form-data; boundary=slow",
            "x-file-name": "slow.txt",
          },
          method: "POST",
          signal: controller.signal,
        } as RequestInit,
      );
      const upload = fulfillRequestedUpload(PUBLIC_TOKEN, request, NOW);
      // Register rejection immediately; no fabricated stream results or mocked persistence.
      const outcome = upload.then(
        () => "fulfilled",
        () => "rejected",
      );
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(inspectRequestedUpload(MANAGEMENT_TOKEN, NOW)?.status).toBe(
        "in_progress",
      );
      expect(getRecipientRequestAvailability(PUBLIC_TOKEN, NOW)).toEqual({
        status: "in_progress",
      });
      controller.abort();
      expect(
        await Promise.race([
          outcome,
          new Promise((resolve) =>
            setTimeout(() => resolve("still waiting"), 500),
          ),
        ]),
      ).toBe("rejected");
      expect(disposed).toHaveBeenCalledTimes(1);
      expect(inspectRequestedUpload(MANAGEMENT_TOKEN, NOW)?.status).toBe(
        "retry",
      );
      expect(getRecipientRequestAvailability(PUBLIC_TOKEN, NOW)).toMatchObject({
        status: "retry",
        maxBytes: 16,
      });
      const entries = await readdir(process.env.UPLOAD_DIR!, {
        recursive: true,
      });
      expect(entries).toEqual([]);
      await fulfillRequestedUpload(PUBLIC_TOKEN, raw("ok"), NOW);
      expect(inspectRequestedUpload(MANAGEMENT_TOKEN, NOW)?.status).toBe(
        "consumed",
      );
    },
  );

  it("accepts a multipart file exactly at the advertised request limit", async () => {
    createRequest();
    const body = new FormData();
    body.set(
      "file",
      new File(["x".repeat(16)], "exact.txt", { type: "text/plain" }),
    );
    const request = new Request("https://up.test/upload", {
      method: "POST",
      body,
    });
    const result = await fulfillRequestedUpload(PUBLIC_TOKEN, request, NOW);
    expect(result.size).toBe(16);
  });

  it("distinguishes expired and revoked requests without exposing private metadata", () => {
    createRequest();
    expect(
      getRecipientRequestAvailability(
        PUBLIC_TOKEN,
        new Date("2027-01-01T00:00:00Z"),
      ),
    ).toEqual({ status: "expired" });
    revokeRequestedUpload(MANAGEMENT_TOKEN, NOW);
    expect(getRecipientRequestAvailability(PUBLIC_TOKEN, NOW)).toEqual({
      status: "revoked",
    });
  });

  it("only exposes recipient-safe availability and request limits", async () => {
    expect(getRecipientRequestAvailability("invalid", NOW)).toEqual({
      status: "invalid",
    });
    expect(getRecipientRequestAvailability(PUBLIC_TOKEN, NOW)).toEqual({
      status: "invalid",
    });
    const created = createRequest();
    expect(getRecipientRequestAvailability(PUBLIC_TOKEN, NOW)).toEqual({
      status: "active",
      maxBytes: 16,
      expiresAt: created.expiresAt,
    });
    await fulfillRequestedUpload(PUBLIC_TOKEN, raw("ok"), NOW);
    expect(getRecipientRequestAvailability(PUBLIC_TOKEN, NOW)).toEqual({
      status: "consumed",
    });
  });

  it("releases a failed claim but enforces maxBytes", async () => {
    createRequest();
    await expect(
      fulfillRequestedUpload(PUBLIC_TOKEN, raw("x".repeat(17)), NOW),
    ).rejects.toMatchObject({ code: "upload_too_large", status: 413 });
    expect(getActiveRequestedUpload(PUBLIC_TOKEN, NOW)?.status).toBe("retry");
    await expect(
      fulfillRequestedUpload(PUBLIC_TOKEN, raw("ok"), NOW),
    ).resolves.toMatchObject({
      size: 2,
    });
  });

  it("lets only the owner inspect and revoke an active request", () => {
    createRequest();
    expect(inspectRequestedUpload("c".repeat(64), NOW)).toBeUndefined();
    expect(revokeRequestedUpload(MANAGEMENT_TOKEN, NOW)?.status).toBe(
      "revoked",
    );
    expect(getActiveRequestedUpload(PUBLIC_TOKEN, NOW)).toBeUndefined();
    expect(revokeRequestedUpload(MANAGEMENT_TOKEN, NOW)?.status).toBe(
      "revoked",
    );
  });

  it("reports expired and consumed owner states without allowing revocation", async () => {
    createRequest();
    const expiredAt = new Date("2026-09-26T19:00:00.000Z");
    expect(inspectRequestedUpload(MANAGEMENT_TOKEN, expiredAt)?.status).toBe(
      "expired",
    );
    expect(revokeRequestedUpload(MANAGEMENT_TOKEN, expiredAt)?.status).toBe(
      "expired",
    );

    await fulfillRequestedUpload(PUBLIC_TOKEN, raw("ok"), NOW);
    expect(revokeRequestedUpload(MANAGEMENT_TOKEN, NOW)).toMatchObject({
      status: "consumed",
      uploadId: expect.stringMatching(/^[0-9A-Z]{5}$/),
    });
  });
});
