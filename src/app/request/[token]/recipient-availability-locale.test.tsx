import { render, screen } from "@testing-library/react";
import { RecipientRequestView } from "./recipient-request-view";

const now = new Date("2026-01-01T12:00:00Z");

test.each([
  ["invalid", "Ta prośba o plik jest nieprawidłowa"],
  ["in_progress", "Przesyłanie już trwa"],
  ["consumed", "Ta prośba o plik została już wykorzystana"],
  ["revoked", "Ta prośba o plik została unieważniona"],
  ["expired", "Ta prośba o plik wygasła"],
] as const)(
  "Polish %s keeps unavailable requests non-actionable",
  (status, title) => {
    render(
      <RecipientRequestView
        locale="pl"
        request={{ status }}
        token="unchanged-token"
        now={now}
      />,
    );
    expect(screen.getByRole("heading").textContent).toBe(title);
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "← Strona główna" })
        .getAttribute("href"),
    ).toBe("/");
    const refresh = screen.queryByRole("link", {
      name: "Odśwież status prośby",
    });
    if (status === "in_progress")
      expect(refresh?.getAttribute("href")).toBe("/request/unchanged-token");
    else expect(refresh).toBeNull();
  },
);

test.each(["active", "retry"] as const)(
  "Polish %s uses locale-aware expiry without changing timestamps",
  (status) => {
    const { container } = render(
      <RecipientRequestView
        locale="pl"
        request={{
          status,
          maxBytes: 1536,
          expiresAt: "2026-01-01T13:00:00.000Z",
        }}
        token="unchanged-token"
        now={now}
      />,
    );
    expect(screen.getByRole("heading").textContent).toBe(
      "Wyślij zamówiony plik",
    );
    expect(container.querySelector("time")?.dateTime).toBe(
      "2026-01-01T13:00:00.000Z",
    );
    expect(screen.getByText(/Wygasa za 1 godzinę/).textContent).toContain(
      "UTC",
    );
    expect(
      !!screen.queryByText(/Poprzednie przesyłanie nie zostało ukończone/),
    ).toBe(status === "retry");
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
  },
);
