import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { ReadableStream } from "node:stream/web";
import { TextDecoder, TextEncoder } from "node:util";

import { ManageRequest } from "./manage-request";

const TOKEN = "a".repeat(64);

function response(request: Record<string, unknown>, ok = true): Response {
  return {
    json: async () => (ok ? { request } : { error: request }),
    ok,
  } as Response;
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
  window.sessionStorage.clear();
  jest.restoreAllMocks();
});

describe("ManageRequest", () => {
  it("does not fall back to a stale capability for an invalid fragment", async () => {
    window.sessionStorage.setItem("up.upload-request-management-token", TOKEN);
    window.history.replaceState(null, "", "/request/manage#not-a-token");
    const fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock;

    const { getByRole } = render(<ManageRequest />);

    await waitFor(() =>
      expect(getByRole("heading").textContent).toBe("Owner link unavailable"),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      window.sessionStorage.getItem("up.upload-request-management-token"),
    ).toBeNull();
  });

  it("imports the owner capability from the fragment and removes it from history", async () => {
    window.history.replaceState(null, "", `/request/manage#${TOKEN}`);
    const fetchMock = jest.fn<typeof fetch>(async () =>
      response({
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2099-01-01T01:00:00.000Z",
        maxBytes: 1024,
        status: "active",
        statusChangedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    global.fetch = fetchMock;

    const { getByRole } = render(<ManageRequest />);

    await waitFor(() => expect(getByRole("status").textContent).toBe("active"));
    expect(window.location.hash).toBe("");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/upload-requests/manage",
      expect.objectContaining({
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
    );
  });

  it("revokes an active request and reports its resulting status", async () => {
    window.history.replaceState(null, "", `/request/manage#${TOKEN}`);
    const active = {
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2099-01-01T01:00:00.000Z",
      maxBytes: 1024,
      status: "active",
      statusChangedAt: "2026-01-01T00:00:00.000Z",
    };
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(active))
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce(response({ ...active, status: "revoked" }));
    global.fetch = fetchMock;

    const { getByRole } = render(<ManageRequest />);
    await waitFor(() => expect(getByRole("status").textContent).toBe("active"));
    fireEvent.click(getByRole("button", { name: "Revoke request" }));

    await waitFor(() =>
      expect(getByRole("status").textContent).toBe("revoked"),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/upload-requests/manage",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("shows the resulting download when a request was consumed", async () => {
    window.history.replaceState(null, "", `/request/manage#${TOKEN}`);
    global.fetch = jest.fn<typeof fetch>(async () =>
      response({
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2099-01-01T01:00:00.000Z",
        maxBytes: 1024,
        status: "consumed",
        statusChangedAt: "2026-01-01T00:01:00.000Z",
        uploadId: "A1B2C",
      }),
    );

    const { getByRole } = render(<ManageRequest />);

    await waitFor(() =>
      expect(
        getByRole("link", { name: "Open file" }).getAttribute("href"),
      ).toBe("/A1B2C"),
    );
  });

  it("restores the scrubbed capability after refresh and copies its private URL", async () => {
    window.history.replaceState(null, "", "/request/manage");
    window.sessionStorage.setItem("up.upload-request-management-token", TOKEN);
    const writeText = jest.fn<(value: string) => Promise<void>>(
      async () => undefined,
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    global.fetch = jest.fn<typeof fetch>(async () =>
      response({
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2099-01-01T01:00:00.000Z",
        maxBytes: 1024,
        status: "active",
        statusChangedAt: "2026-01-01T00:00:00.000Z",
      }),
    );

    const { getByRole, getByText } = render(<ManageRequest />);
    await waitFor(() => expect(getByRole("status").textContent).toBe("active"));
    expect(
      getByText(/private owner link is a bearer capability/i),
    ).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Copy owner link" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `http://localhost/request/manage#${TOKEN}`,
      ),
    );
  });

  it("applies live status events and exposes the completed upload", async () => {
    window.history.replaceState(null, "", `/request/manage#${TOKEN}`);
    Object.defineProperty(globalThis, "TextDecoder", {
      configurable: true,
      value: TextDecoder,
    });
    const active = {
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2099-01-01T01:00:00.000Z",
      maxBytes: 1024,
      status: "active",
      statusChangedAt: "2026-01-01T00:00:00.000Z",
    };
    const consumed = {
      ...active,
      status: "consumed",
      statusChangedAt: "2026-01-01T00:01:00.000Z",
      uploadId: "A1B2C",
    };
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `event: status\ndata: ${JSON.stringify({ request: consumed })}\n\n`,
          ),
        );
        controller.close();
      },
    });
    global.fetch = jest.fn<typeof fetch>(async (input) =>
      String(input).endsWith("/events")
        ? ({ body, ok: true } as Response)
        : response(active),
    );

    const { getByRole } = render(<ManageRequest />);

    await waitFor(() =>
      expect(getByRole("status").textContent).toBe("consumed"),
    );
    expect(getByRole("link", { name: "Open file" }).getAttribute("href")).toBe(
      "/A1B2C",
    );
    expect(
      (getByRole("button", { name: "Revoke request" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
