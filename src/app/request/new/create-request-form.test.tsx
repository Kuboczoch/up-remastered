import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { CreateRequestForm } from "./create-request-form";

describe("CreateRequestForm", () => {
  it("keeps initial server and hydration markup independent of the clock", () => {
    const clock = jest.spyOn(Date, "now");
    clock.mockReturnValueOnce(1).mockReturnValueOnce(9_999_999);

    const first = renderToString(
      <CreateRequestForm
        maxExpirationMs={24 * 60 * 60_000}
        maxUploadBytes={1024 ** 3}
      />,
    );
    const second = renderToString(
      <CreateRequestForm
        maxExpirationMs={24 * 60 * 60_000}
        maxUploadBytes={1024 ** 3}
      />,
    );

    expect(second).toBe(first);
    expect(first).toContain("Server maximum:");
    expect(first).toContain("1 GiB");
    clock.mockRestore();
  });

  it("hydrates clock-independent server markup without a mismatch", async () => {
    const clock = jest.spyOn(Date, "now");
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const form = (
      <CreateRequestForm
        maxExpirationMs={24 * 60 * 60_000}
        maxUploadBytes={1024 ** 3}
      />
    );
    clock.mockReturnValue(1);
    const container = document.createElement("div");
    container.innerHTML = renderToString(form);

    clock.mockReturnValue(9_999_999);
    render(form, { container, hydrate: true });

    await waitFor(() =>
      expect(
        (
          container.querySelector(
            'select[name="expirationPreset"]',
          ) as HTMLSelectElement | null
        )?.disabled,
      ).toBe(false),
    );
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    clock.mockRestore();
  });

  it("submits custom IEC quantities as exact integer bytes", async () => {
    const fetchMock = jest.fn<typeof fetch>(async () =>
      Promise.resolve({
        json: async () => ({
          createdAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-01-01T01:00:00.000Z",
          managementUrl: "https://example.test/request/manage#owner-token",
          managementToken: "owner-token",
          maxBytes: 512,
          status: "active",
          statusChangedAt: "2026-01-01T00:00:00.000Z",
          uploadUrl: "https://example.test/request/token",
        }),
        ok: true,
      } as Response),
    );
    global.fetch = fetchMock;
    const { getByLabelText, getByRole } = render(
      <CreateRequestForm
        maxExpirationMs={24 * 60 * 60_000}
        maxUploadBytes={1024 ** 3}
      />,
    );

    fireEvent.change(getByLabelText("Maximum upload size"), {
      target: { value: "custom" },
    });
    fireEvent.change(getByLabelText("Size amount"), {
      target: { value: "0.5" },
    });
    fireEvent.change(getByLabelText("Size unit"), {
      target: { value: "KiB" },
    });
    fireEvent.click(getByRole("button", { name: "Create upload request" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ maxBytes: 512 });
  });

  it("copies the public and private links returned by the server", async () => {
    const writeText = jest.fn<(value: string) => Promise<void>>(
      async () => undefined,
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    global.fetch = jest.fn<typeof fetch>(async () =>
      Promise.resolve({
        json: async () => ({
          createdAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2099-01-01T01:00:00.000Z",
          managementUrl: "https://example.test/request/manage#owner-token",
          managementToken: "owner-token",
          maxBytes: 1024,
          status: "active",
          statusChangedAt: "2026-01-01T00:00:00.000Z",
          uploadUrl: "https://example.test/request/upload-token",
        }),
        ok: true,
      } as Response),
    );
    const { getByRole } = render(
      <CreateRequestForm
        maxExpirationMs={24 * 60 * 60_000}
        maxUploadBytes={1024}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Create upload request" }));
    await waitFor(() =>
      expect(getByRole("button", { name: "Copy upload link" })).toBeTruthy(),
    );
    fireEvent.click(getByRole("button", { name: "Copy upload link" }));
    fireEvent.click(getByRole("button", { name: "Copy owner link" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenNthCalledWith(
        2,
        "https://example.test/request/manage#owner-token",
      ),
    );
    expect(writeText).toHaveBeenNthCalledWith(
      1,
      "https://example.test/request/upload-token",
    );
  });
});
