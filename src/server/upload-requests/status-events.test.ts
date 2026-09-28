import { describe, expect, it } from "@jest/globals";

import type { UploadRequestDetails } from "./requested-upload";
import {
  createUploadRequestStatusStream,
  uploadRequestEventId,
} from "./status-events";

const BASE_REQUEST: UploadRequestDetails = {
  createdAt: "2026-09-26T18:00:00.000Z",
  expiresAt: "2026-09-26T19:00:00.000Z",
  maxBytes: 16,
  status: "active",
  statusChangedAt: "2026-09-26T18:00:00.000Z",
};

function state(
  status: UploadRequestDetails["status"],
  statusChangedAt: string,
): UploadRequestDetails {
  return { ...BASE_REQUEST, status, statusChangedAt };
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";

  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) return result;
    result += decoder.decode(chunk.value, { stream: true });
  }
}

describe("requested-upload status events", () => {
  it("publishes ordered status revisions and closes after a terminal state", async () => {
    const revisions = [
      state("in_progress", "2026-09-26T18:01:00.000Z"),
      state("retry", "2026-09-26T18:01:01.000Z"),
      state("consumed", "2026-09-26T18:01:02.000Z"),
    ];
    const body = await readAll(
      createUploadRequestStatusStream("b".repeat(64), BASE_REQUEST, undefined, {
        heartbeatIntervalMs: 1_000,
        inspect: () => revisions.shift() ?? revisions.at(-1),
        maxLifetimeMs: 1_000,
        pollIntervalMs: 1,
      }),
    );

    expect(body).toContain("retry: 2000");
    expect(body.match(/event: status/g)).toHaveLength(4);
    expect(body).toContain('"status":"active"');
    expect(body).toContain('"status":"in_progress"');
    expect(body).toContain('"status":"retry"');
    expect(body).toContain('"status":"consumed"');
  });

  it("suppresses the replayed revision and still reports a later terminal state", async () => {
    const revoked = state("revoked", "2026-09-26T18:02:00.000Z");
    const body = await readAll(
      createUploadRequestStatusStream(
        "b".repeat(64),
        BASE_REQUEST,
        uploadRequestEventId(BASE_REQUEST),
        {
          heartbeatIntervalMs: 1_000,
          inspect: () => revoked,
          maxLifetimeMs: 1_000,
          pollIntervalMs: 1,
        },
      ),
    );

    expect(body.match(/event: status/g)).toHaveLength(1);
    expect(body).not.toContain('"status":"active"');
    expect(body).toContain('"status":"revoked"');
  });

  it("bounds non-terminal streams", async () => {
    const body = await readAll(
      createUploadRequestStatusStream("b".repeat(64), BASE_REQUEST, undefined, {
        heartbeatIntervalMs: 2,
        inspect: () => BASE_REQUEST,
        maxLifetimeMs: 8,
        pollIntervalMs: 1,
      }),
    );

    expect(body).toContain(": keep-alive");
    expect(body.match(/event: status/g)).toHaveLength(1);
  });

  it("stops polling when the consumer disconnects", async () => {
    let inspections = 0;
    const stream = createUploadRequestStatusStream(
      "b".repeat(64),
      BASE_REQUEST,
      undefined,
      {
        heartbeatIntervalMs: 100,
        inspect: () => {
          inspections += 1;
          return BASE_REQUEST;
        },
        maxLifetimeMs: 100,
        pollIntervalMs: 2,
      },
    );
    const reader = stream.getReader();

    await reader.read();
    await reader.cancel();
    const inspectionsAfterCancel = inspections;
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(inspections).toBe(inspectionsAfterCancel);
  });
});
