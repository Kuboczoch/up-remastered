import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";

import packageMetadata from "../../package.json";
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
      getByRole("heading", { name: "Share temporary files and text." }),
    ).toBeTruthy();
    expect(getByText("Everything expires automatically.")).toBeTruthy();
    const footer = getByRole("contentinfo");

    expect(footer).toBeTruthy();
    expect(footer.querySelector('a[href="/request/new"]')?.textContent).toBe(
      "Request a file",
    );
    const repositoryLink = getByRole("link", {
      name: "GitHub repository (opens in a new tab)",
    });

    expect(repositoryLink.textContent).toBe("GitHub");
    expect(repositoryLink.getAttribute("href")).toBe(
      "https://github.com/Kuboczoch/up-remastered",
    );
    expect(repositoryLink.getAttribute("rel")).toBe("noreferrer");
    expect(repositoryLink.getAttribute("target")).toBe("_blank");
    expect(getByText(`v${packageMetadata.version}`)).toBeTruthy();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    await waitFor(() => {
      expect(getByLabelText("Choose file")).toBeTruthy();
      expect(getByText("1 KiB max")).toBeTruthy();
    });
    fireEvent.click(getByRole("button", { name: "Text" }));
    expect(getByLabelText("Or upload text")).toBeTruthy();
    const structuredData = JSON.parse(script?.textContent ?? "null") as {
      url: string;
    };
    expect(structuredData).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Up - Remastered",
    });
    expect(new URL(structuredData.url).pathname).toBe("/");

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });

  it("has no component-level accessibility violations", async () => {
    const { container, getByText } = render(<Home />);
    await waitFor(() => expect(getByText("1 KiB max")).toBeTruthy());
    const results = await axe(container);

    expect(results.violations).toEqual([]);
  });
});
