import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";

import Home from "./page";

describe("Home", () => {
  it("renders the homepage greeting and structured data", () => {
    const { container, getByRole } = render(<Home />);
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );

    expect(
      getByRole("heading", { name: "hello from up - remastered" }),
    ).toBeTruthy();
    expect(script).not.toBeNull();
    expect(JSON.parse(script?.textContent ?? "null")).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "up - remastered",
      url: "http://localhost:3000/",
    });
  });

  it("has no component-level accessibility violations", async () => {
    const { container } = render(<Home />);
    const results = await axe(container);

    expect(results.violations).toEqual([]);
  });
});
