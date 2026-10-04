import { render, screen } from "@testing-library/react";
import { RecipientRequestView } from "./recipient-request-view";
const now = new Date("2026-01-01T12:00:00Z");

test.each([
  "invalid",
  "in_progress",
  "consumed",
  "revoked",
  "expired",
] as const)(
  "gives actionable safe guidance for %s without an upload form",
  (status) => {
    render(
      <RecipientRequestView
        request={{ status }}
        token="disposable"
        now={now}
      />,
    );
    expect(screen.queryByLabelText("Choose file")).toBeNull();
    expect(screen.getByRole("heading").textContent).toMatch(
      status === "consumed"
        ? /already been used/
        : status === "in_progress"
          ? /already in progress/
          : new RegExp(status),
    );
    expect(
      screen.getByRole("link", { name: "← Home" }).getAttribute("href"),
    ).toBe("/");
    if (status === "in_progress") {
      expect(
        screen.getByRole("link", { name: "Refresh request status" }),
      ).toBeDefined();
      expect(screen.getByText(/Wait for the current upload/)).toBeDefined();
    } else {
      expect(screen.getByText(/new request/)).toBeDefined();
      expect(
        screen.queryByRole("link", { name: "Refresh request status" }),
      ).toBeNull();
    }
  },
);

test.each(["active", "retry"] as const)(
  "shows stable UTC expiry, remaining lifetime and readable limit for %s",
  (status) => {
    const { container } = render(
      <RecipientRequestView
        request={{
          status,
          maxBytes: 1073741824,
          expiresAt: "2026-01-01T13:00:00.000Z",
        }}
        token="disposable"
        now={now}
      />,
    );
    expect(screen.getByText(/Expires in 1 hour/).textContent).toContain(
      "1 Jan 2026, 13:00 UTC",
    );
    expect(container.querySelector("time")?.dateTime).toBe(
      "2026-01-01T13:00:00.000Z",
    );
    expect(
      screen.getByText("Maximum 1 GiB. This link is single-use."),
    ).toBeDefined();
    expect(!!screen.queryByText(/previous upload did not complete/)).toBe(
      status === "retry",
    );
  },
);
