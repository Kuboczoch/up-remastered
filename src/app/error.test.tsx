import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

import ErrorPage from "./error";

jest.mock("next/navigation", () => ({}));

describe("ErrorPage", () => {
  it("offers recovery without exposing error details", async () => {
    const reset = jest.fn();
    const { container } = render(
      <ErrorPage
        error={new Error("sensitive /data/uploads/private.txt")}
        reset={reset}
      />,
    );

    expect(screen.queryByText(/private\.txt|\/data\/uploads/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect((await axe(container)).violations).toEqual([]);
  });
});
