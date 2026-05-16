import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";

import Home from "./page";

describe("Home", () => {
  it("renders the homepage greeting", () => {
    expect(Home()).toEqual(
      <main>
        <h1>hello from up - remastered</h1>
      </main>,
    );
  });

  it("has no component-level accessibility violations", async () => {
    const { container } = render(<Home />);
    const results = await axe(container);

    expect(results.violations).toEqual([]);
  });
});
