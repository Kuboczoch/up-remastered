import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

import NotFound from "./not-found";

describe("NotFound", () => {
  it("renders an accessible route home", async () => {
    const { container } = render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Return home" }).getAttribute("href"),
    ).toBe("/");
    expect((await axe(container)).violations).toEqual([]);
  });
});
