import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { ReadableStream } from "node:stream/web";
import { TextDecoder, TextEncoder } from "node:util";

import { ManageRequest } from "./manage/manage-request";
import { CreateRequestForm } from "./new/create-request-form";
import type {
  RequestDetails,
  RequestStatus,
} from "./use-upload-request-status";

const TOKEN = "a".repeat(64);
const reserved = {
  createdAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2099-01-01T01:00:00.000Z",
  maxBytes: 1024,
  status: "active" as const,
  statusChangedAt: "2026-01-01T00:00:00.000Z",
  uploadId: "A1B2C",
};
const messages = {
  active: "Waiting for upload.",
  retry:
    "Waiting for upload. The previous attempt failed; the recipient can try the same upload link again.",
  in_progress: "Upload in progress. The file is not available yet.",
  revoked:
    "This request was revoked. Its upload link can no longer be used. Create a new request to receive a file.",
  expired:
    "This request expired without receiving a file. Create a new request to receive a file.",
};

Object.defineProperty(globalThis, "TextDecoder", {
  configurable: true,
  value: TextDecoder,
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
  window.sessionStorage.clear();
  jest.restoreAllMocks();
});

async function ownerPage(kind: "creation" | "manager", status: RequestStatus) {
  const details: RequestDetails = { ...reserved, status };
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      stream = controller;
    },
  });
  const fetchMock = jest.fn<typeof fetch>(async (input) => {
    if (String(input).endsWith("/events"))
      return { body, ok: true } as Response;
    return {
      ok: true,
      json: async () =>
        String(input).endsWith("/configuration")
          ? { maxFileLifetime: 3600000, maxTemporaryFileSize: 1024 }
          : String(input).endsWith("/manage")
            ? { request: details }
            : {
                ...details,
                managementToken: TOKEN,
                managementUrl: `http://localhost/request/manage#${TOKEN}`,
                uploadUrl: `http://localhost/request/${"b".repeat(64)}`,
              },
    } as Response;
  });
  global.fetch = fetchMock;
  window.history.replaceState(null, "", `/request/manage#${TOKEN}`);
  const view = render(
    kind === "creation" ? <CreateRequestForm /> : <ManageRequest />,
  );
  if (kind === "creation") {
    const submit = view.getByRole("button", { name: "Create upload request" });
    await waitFor(() =>
      expect((submit as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(submit);
  }
  await waitFor(() =>
    expect(view.getByRole("status").textContent).toContain(
      status.replace("_", " "),
    ),
  );
  return {
    ...view,
    fetchMock,
    async update(status: RequestStatus) {
      await act(async () => {
        stream.enqueue(
          new TextEncoder().encode(
            `event: status\ndata: ${JSON.stringify({ request: { ...details, status, statusChangedAt: "2026-01-01T00:01:00.000Z" } })}\n\n`,
          ),
        );
        if (["consumed", "revoked", "expired"].includes(status)) stream.close();
      });
    },
  };
}

for (const kind of ["creation", "manager"] as const) {
  describe(`${kind} owner lifecycle`, () => {
    for (const status of Object.keys(messages) as (keyof typeof messages)[]) {
      it(`does not treat a reserved ID as an uploaded file in ${status}`, async () => {
        const view = await ownerPage(kind, status);
        expect(view.getByText(messages[status])).toBeTruthy();
        expect(view.queryByRole("link", { name: "Open file" })).toBeNull();
        expect(view.queryByText(/Uploaded file:/)).toBeNull();
        const revoke = view.queryByRole("button", {
          name: "Revoke request",
        }) as HTMLButtonElement | null;
        if (["active", "retry"].includes(status))
          expect(revoke?.disabled).toBe(false);
        else if (status === "in_progress") expect(revoke?.disabled).toBe(true);
        else expect(revoke).toBeNull();
      });
    }

    it("opens only a consumed file on initial load", async () => {
      const view = await ownerPage(kind, "consumed");
      expect(
        view.getByRole("link", { name: "Open file" }).getAttribute("href"),
      ).toBe("/A1B2C");
      expect(view.queryByRole("button", { name: "Revoke request" })).toBeNull();
    });

    for (const status of ["consumed", "revoked", "expired"] as const) {
      it(`applies an SSE transition from a reserved ID to ${status}`, async () => {
        const view = await ownerPage(kind, "active");
        expect(view.queryByRole("link", { name: "Open file" })).toBeNull();
        await view.update("in_progress");
        expect(view.getByText(messages.in_progress)).toBeTruthy();
        expect(view.queryByRole("link", { name: "Open file" })).toBeNull();
        await view.update(status);
        await waitFor(() =>
          expect(view.getByRole("status").textContent).toContain(status),
        );
        expect(
          view.queryByRole("button", { name: "Revoke request" }),
        ).toBeNull();
        if (status === "consumed")
          expect(
            view.getByRole("link", { name: "Open file" }).getAttribute("href"),
          ).toBe("/A1B2C");
        else {
          expect(view.getByText(messages[status])).toBeTruthy();
          expect(view.queryByRole("link", { name: "Open file" })).toBeNull();
        }
      });
    }
  });
}
