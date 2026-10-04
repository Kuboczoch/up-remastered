import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { CreateRequestForm } from "./create-request-form";

const limitsResponse = {
  json: async () => ({
    maxFileLifetime: 24 * 60 * 60_000,
    maxTemporaryFileSize: 1024 ** 3,
  }),
  ok: true,
} as Response;

describe("CreateRequestForm", () => {
  beforeEach(() => {
    global.fetch = jest.fn<typeof fetch>(async () => limitsResponse);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it("keeps initial server and hydration markup independent of the clock", () => {
    const clock = jest.spyOn(Date, "now");
    clock.mockReturnValueOnce(1).mockReturnValueOnce(9_999_999);

    const first = renderToString(<CreateRequestForm />);
    const second = renderToString(<CreateRequestForm />);

    expect(second).toBe(first);
    expect(first).toContain("Loading server limits");
    expect(first).toContain("disabled");
    clock.mockRestore();
  });

  it("hydrates clock-independent server markup without a mismatch", async () => {
    const clock = jest.spyOn(Date, "now");
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const form = <CreateRequestForm />;
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
    fetchMock.mockResolvedValueOnce(limitsResponse);
    global.fetch = fetchMock;
    const { getByLabelText, getByRole } = render(<CreateRequestForm />);

    await waitFor(() =>
      expect(
        (getByLabelText("Maximum upload size") as HTMLSelectElement).disabled,
      ).toBe(false),
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

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
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
    global.fetch = jest
      .fn<typeof fetch>(async () =>
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
      )
      .mockResolvedValueOnce(limitsResponse);
    const { getByRole } = render(<CreateRequestForm />);

    await waitFor(() =>
      expect(
        (
          getByRole("button", {
            name: "Create upload request",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
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
