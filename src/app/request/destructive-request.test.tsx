import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { ReadableStream } from "node:stream/web";
import { TextDecoder } from "node:util";

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

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      void controller;
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
  return { ...view, fetchMock };
}

for (const kind of ["creation", "manager"] as const) {
  describe(`${kind} destructive confirmation`, () => {
    it("announces confirmed revocation after authoritative API success", async () => {
      const view = await ownerPage(kind, "active");
      const originalFetch = view.fetchMock.getMockImplementation()!;
      view.fetchMock.mockImplementation(async (input, init) =>
        init?.method === "DELETE"
          ? ({
              ok: true,
              json: async () => ({
                request: {
                  ...reserved,
                  status: "revoked",
                  statusChangedAt: "2026-01-01T00:02:00.000Z",
                },
              }),
            } as Response)
          : originalFetch(input, init),
      );
      fireEvent.click(view.getByRole("button", { name: "Revoke request" }));
      fireEvent.click(
        view.getByRole("button", { name: "Confirm revoke request" }),
      );
      await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
      await waitFor(() =>
        expect(view.getByRole("status").textContent).toContain("revoked"),
      );
    });

    it("cancels safely and retains the request on revoke API failure", async () => {
      const view = await ownerPage(kind, "active");
      const trigger = view.getByRole("button", { name: "Revoke request" });
      fireEvent.click(trigger);
      expect(
        view.getByRole("dialog", { name: "Revoke upload request?" }),
      ).toBeTruthy();
      fireEvent.click(view.getByRole("button", { name: "Cancel" }));
      expect(
        view.fetchMock.mock.calls.filter(
          ([, init]) => init?.method === "DELETE",
        ),
      ).toHaveLength(0);
      view.fetchMock.mockImplementationOnce(
        async () =>
          ({
            ok: false,
            json: async () => ({
              error: { message: "Could not revoke the request." },
            }),
          }) as Response,
      );
      fireEvent.click(trigger);
      fireEvent.click(
        view.getByRole("button", { name: "Confirm revoke request" }),
      );
      await waitFor(() =>
        expect(
          view
            .getAllByRole("alert")
            .some((node) => node.textContent?.includes("Could not revoke")),
        ).toBe(true),
      );
      expect(view.getByRole("dialog")).toBeTruthy();
      expect(view.getByRole("status").textContent).toContain("active");
      expect(
        view.fetchMock.mock.calls.filter(
          ([, init]) => init?.method === "DELETE",
        ),
      ).toHaveLength(1);
    });
  });
}
