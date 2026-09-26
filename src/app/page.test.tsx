import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { render, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";

import Home from "./page";

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    json: async () => ({
      defaultFileLifetime: 3_600_000,
      maxFileLifetime: 86_400_000,
      maxPermanentFileSize: 0,
      maxTemporaryFileSize: 1_024,
      permanentAllowed: false,
    }),
    ok: true,
  })) as unknown as jest.MockedFunction<typeof fetch>;
});

describe("Home", () => {
  it("renders upload controls and structured data", async () => {
    const { container, getByLabelText, getByRole, getByText } = render(
      <Home />,
    );
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );

    expect(
      getByRole("heading", { name: "Share one thing, quickly." }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(getByLabelText("Choose file")).toBeTruthy();
      expect(getByLabelText("Or upload text")).toBeTruthy();
      expect(getByText("Maximum 1.0 KiB")).toBeTruthy();
    });
    expect(JSON.parse(script?.textContent ?? "null")).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "up - remastered",
      url: "http://localhost:3000/",
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });

  it("has no component-level accessibility violations", async () => {
    const { container, getByText } = render(<Home />);
    await waitFor(() => expect(getByText("Maximum 1.0 KiB")).toBeTruthy());
    const results = await axe(container);

    expect(results.violations).toEqual([]);
  });
});
