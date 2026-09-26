import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

import Loading from "./loading";

describe("Loading", () => {
  it("announces loading state accessibly", async () => {
    const { container } = render(<Loading />);

    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect((await axe(container)).violations).toEqual([]);
  });
});
