import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { LocaleProvider } from "@/lib/i18n/provider";

import { CreateRequestForm } from "./create-request-form";

const limitsResponse = {
  json: async () => ({
    maxFileLifetime: 24 * 60 * 60_000,
    maxTemporaryFileSize: 1024 ** 3,
  }),
  ok: true,
} as Response;

describe("CreateRequestForm", () => {
  it("renders Polish input labels on the server and after hydration", async () => {
    const form = (
      <LocaleProvider locale="pl">
        <CreateRequestForm
          initialLimits={{
            maxExpirationMs: 86_400_000,
            maxUploadBytes: 1024 ** 3,
          }}
        />
      </LocaleProvider>
    );
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = renderToString(form);
    expect(container.textContent).not.toContain("Wczytywanie limitów serwera…");
    expect(container.textContent).toContain("Maksimum serwera: 1 GiB");
    expect(container.textContent).not.toContain("Loading server limits");
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { getByLabelText, getByRole, getByText } = render(form, {
      container,
      hydrate: true,
    });
    await waitFor(() =>
      expect(
        (getByLabelText("Maksymalny rozmiar pliku") as HTMLSelectElement)
          .disabled,
      ).toBe(false),
    );
    expect(getByRole("option", { name: "1 godzina" })).toBeTruthy();
    expect(
      getByRole("option", { name: "Maksimum serwera: 1 GiB" }),
    ).toBeTruthy();
    fireEvent.change(getByLabelText("Maksymalny rozmiar pliku"), {
      target: { value: "custom" },
    });
    fireEvent.change(getByLabelText("Rozmiar"), { target: { value: "0.1" } });
    fireEvent.click(getByRole("button", { name: "Utwórz prośbę o plik" }));
    await waitFor(() =>
      expect(
        getByText("Rozmiar musi odpowiadać całkowitej liczbie bajtów."),
      ).toBeTruthy(),
    );
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("renders usable limits during a stalled refresh without resetting custom input", async () => {
    let resolveLimits!: (response: Response) => void;
    global.fetch = jest.fn<typeof fetch>().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveLimits = resolve;
      }),
    );
    const view = render(
      <CreateRequestForm
        initialLimits={{
          maxExpirationMs: 86_400_000,
          maxUploadBytes: 1024 ** 3,
        }}
      />,
    );
    expect(
      (
        view.getByRole("button", {
          name: "Create upload request",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(view.queryByText("Loading server limits…")).toBeNull();
    fireEvent.change(view.getByLabelText("Maximum upload size"), {
      target: { value: "custom" },
    });
    fireEvent.change(view.getByLabelText("Size amount"), {
      target: { value: "2" },
    });
    fireEvent.change(view.getByLabelText("Size unit"), {
      target: { value: "KiB" },
    });
    fireEvent.change(view.getByLabelText("Request expires"), {
      target: { value: "custom" },
    });
    fireEvent.change(view.getByLabelText("Custom expiration date and time"), {
      target: { value: "2030-01-02T03:04" },
    });
    await act(async () => {
      resolveLimits(limitsResponse);
    });
    expect(
      (view.getByLabelText("Request expires") as HTMLSelectElement).value,
    ).toBe("custom");
    expect(
      (
        view.getByLabelText(
          "Custom expiration date and time",
        ) as HTMLInputElement
      ).value,
    ).toBe("2030-01-02T03:04");
    expect(
      (view.getByLabelText("Maximum upload size") as HTMLSelectElement).value,
    ).toBe("custom");
    expect((view.getByLabelText("Size amount") as HTMLInputElement).value).toBe(
      "2",
    );
    expect((view.getByLabelText("Size unit") as HTMLSelectElement).value).toBe(
      "KiB",
    );
  });

  it("preserves an unchanged generated expiration maximum on refresh", async () => {
    let resolveLimits!: (response: Response) => void;
    global.fetch = jest.fn<typeof fetch>().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveLimits = resolve;
      }),
    );
    const maxExpirationMs = 90 * 60_000;
    const view = render(
      <CreateRequestForm
        initialLimits={{ maxExpirationMs, maxUploadBytes: 1024 ** 3 }}
      />,
    );
    fireEvent.change(view.getByLabelText("Request expires"), {
      target: { value: String(maxExpirationMs) },
    });
    await act(async () => {
      resolveLimits({
        ok: true,
        json: async () => ({
          maxFileLifetime: maxExpirationMs,
          maxTemporaryFileSize: 1024 ** 3,
        }),
      } as Response);
    });
    expect(
      (view.getByLabelText("Request expires") as HTMLSelectElement).value,
    ).toBe(String(maxExpirationMs));
  });

  it("localizes configuration retry without exposing server text", async () => {
    global.fetch = jest
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("private backend details"))
      .mockResolvedValue(limitsResponse);
    const { findByRole, getByRole, getByLabelText, queryByText } = render(
      <LocaleProvider locale="pl">
        <CreateRequestForm
          initialLimits={{
            maxExpirationMs: 86_400_000,
            maxUploadBytes: 1024 ** 3,
          }}
        />
      </LocaleProvider>,
    );
    expect((await findByRole("alert")).textContent).toBe(
      "Nie udało się wczytać limitów serwera. Spróbuj ponownie.",
    );
    expect(queryByText("private backend details")).toBeNull();
    expect(
      (getByLabelText("Maksymalny rozmiar pliku") as HTMLSelectElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        getByRole("button", {
          name: "Utwórz prośbę o plik",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(getByRole("button", { name: "Wczytaj limity ponownie" }));
    await waitFor(() =>
      expect(
        (getByLabelText("Maksymalny rozmiar pliku") as HTMLSelectElement)
          .disabled,
      ).toBe(false),
    );
  });
  beforeEach(() => {
    global.fetch = jest.fn<typeof fetch>(async () => limitsResponse);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it("keeps initial server and hydration markup independent of the clock", () => {
    const clock = jest.spyOn(Date, "now");
    clock.mockReturnValueOnce(1).mockReturnValueOnce(9_999_999);

    const first = renderToString(
      <CreateRequestForm
        initialLimits={{
          maxExpirationMs: 86_400_000,
          maxUploadBytes: 1024 ** 3,
        }}
      />,
    );
    const second = renderToString(
      <CreateRequestForm
        initialLimits={{
          maxExpirationMs: 86_400_000,
          maxUploadBytes: 1024 ** 3,
        }}
      />,
    );

    expect(second).toBe(first);
    expect(first).not.toContain("Loading server limits");
    expect(first).toContain("Server maximum: 1 GiB");
    expect(first).toContain("disabled");
    clock.mockRestore();
  });

  it("hydrates clock-independent server markup without a mismatch", async () => {
    const clock = jest.spyOn(Date, "now");
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const form = (
      <CreateRequestForm
        initialLimits={{
          maxExpirationMs: 86_400_000,
          maxUploadBytes: 1024 ** 3,
        }}
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
    fetchMock.mockResolvedValueOnce(limitsResponse);
    global.fetch = fetchMock;
    const { getByLabelText, getByRole } = render(
      <CreateRequestForm
        initialLimits={{
          maxExpirationMs: 86_400_000,
          maxUploadBytes: 1024 ** 3,
        }}
      />,
    );

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
    const { getByRole } = render(
      <CreateRequestForm
        initialLimits={{
          maxExpirationMs: 86_400_000,
          maxUploadBytes: 1024 ** 3,
        }}
      />,
    );

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
