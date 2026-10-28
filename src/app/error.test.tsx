import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

import ErrorPage from "./l10n/[locale]/error";
import { LocaleProvider } from "@/lib/i18n/provider";

jest.mock("next/navigation", () => ({}));

describe("ErrorPage", () => {
  it("localizes recovery without exposing private error details", async () => {
    const reset = jest.fn();
    const { container } = render(
      <LocaleProvider locale="pl">
        <ErrorPage error={new Error("private-secret")} reset={reset} />
      </LocaleProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Coś poszło nie tak" }),
    ).toBeTruthy();
    expect(container.textContent).not.toContain("private-secret");
    fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect((await axe(container)).violations).toEqual([]);
  });
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
