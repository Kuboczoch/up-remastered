/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { GET as inspectRequest } from "@/app/api/upload-requests/manage/route";
import {
  createRequestedUpload,
  revokeRequestedUpload,
} from "@/server/upload-requests/requested-upload";

import { GET as streamRequest } from "./route";

const PUBLIC_TOKEN = "a".repeat(64);
const MANAGEMENT_TOKEN = "b".repeat(64);
const UNKNOWN_TOKEN = "c".repeat(64);
const NOW = new Date("2026-09-26T18:00:00.000Z");
const ENV_KEYS = [
  "DATABASE_URL",
  "UPLOAD_DIR",
  "UP_PUBLIC_ORIGIN",
  "DEFAULT_EXPIRATION_HOURS",
  "MAX_EXPIRATION_HOURS",
  "MAX_STORED_BYTES",
  "MAX_UPLOAD_SIZE",
] as const;

let tempDir: string;
let originalEnv: Record<string, string | undefined>;

beforeEach(async () => {
  originalEnv = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );
  tempDir = await mkdtemp(join(tmpdir(), "up-request-events-"));
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

function createRequest() {
  const tokens = [PUBLIC_TOKEN, MANAGEMENT_TOKEN];
  return createRequestedUpload(
    { expiresAt: "2026-09-26T19:00:00.000Z", maxBytes: 16 },
    NOW,
    () => tokens.shift()!,
  );
}

function authorizedRequest(headers: HeadersInit = {}) {
  return new Request("https://up.example/api/upload-requests/manage/events", {
    headers: {
      authorization: `Bearer ${MANAGEMENT_TOKEN}`,
      ...headers,
    },
  });
}

describe("GET /api/upload-requests/manage/events", () => {
  it("authorizes the owner and serializes a terminal snapshot without secrets", async () => {
    createRequest();
    expect(revokeRequestedUpload(MANAGEMENT_TOKEN, NOW)?.status).toBe(
      "revoked",
    );

    const response = await streamRequest(authorizedRequest());
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/event-stream; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe(
      "no-store, no-transform",
    );
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(body).toContain("event: status");
    expect(body).toContain('"status":"revoked"');
    expect(body).toContain(`"statusChangedAt":"${NOW.toISOString()}"`);
    expect(body).not.toContain(PUBLIC_TOKEN);
    expect(body).not.toContain(MANAGEMENT_TOKEN);
    expect(body).not.toContain("accessToken");
  });

  it("honors Last-Event-ID without replaying the terminal revision", async () => {
    createRequest();
    revokeRequestedUpload(MANAGEMENT_TOKEN, NOW);
    const eventId = `revoked:${NOW.toISOString()}`;

    const response = await streamRequest(
      authorizedRequest({ "last-event-id": eventId }),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toBe("retry: 2000\n\n");
  });

  it("returns the same non-disclosing 404 for missing, malformed, and unknown capabilities", async () => {
    for (const authorization of [
      undefined,
      "Bearer malformed",
      `Bearer ${UNKNOWN_TOKEN}`,
    ]) {
      const response = await streamRequest(
        new Request("https://up.example/api/upload-requests/manage/events", {
          headers: authorization ? { authorization } : undefined,
        }),
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "upload_request_unavailable",
          message: "This upload request is unavailable.",
        },
      });
    }
  });

  it("keeps the existing owner inspection response secret-free", async () => {
    createRequest();

    const response = await inspectRequest(authorizedRequest());
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"status":"expired"');
    expect(body).not.toContain(PUBLIC_TOKEN);
    expect(body).not.toContain(MANAGEMENT_TOKEN);
    expect(body).not.toContain("accessToken");
  });
});
