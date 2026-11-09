import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

import Loading from "./l10n/[locale]/loading";
import { LocaleProvider } from "@/lib/i18n/provider";

describe("Loading", () => {
  it("announces the localized loading state", async () => {
    const { container } = render(
      <LocaleProvider locale="pl">
        <Loading />
      </LocaleProvider>,
    );
    expect(screen.getByRole("heading", { name: "Proszę czekać" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "Trwa wczytywanie żądanej zawartości.",
    );
    expect((await axe(container)).violations).toEqual([]);
  });
  it("announces loading state accessibly", async () => {
    const { container } = render(<Loading />);

    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect((await axe(container)).violations).toEqual([]);
  });
});
