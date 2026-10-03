import { afterEach, expect, it, jest } from "@jest/globals";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { DecryptExperience } from "./decrypt-experience";
const original = global.fetch;
afterEach(() => {
  cleanup();
  global.fetch = original;
  window.history.replaceState(null, "", "/");
});
it("does not fetch on landing or when a key is missing", async () => {
  const fetch = jest.fn<typeof global.fetch>();
  global.fetch = fetch;
  render(<DecryptExperience id="A7K2Q" />);
  expect(screen.getByText(/complete link/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /decrypt file/i }));
  expect(fetch).not.toHaveBeenCalled();
});
it("only requests ciphertext after a deliberate click and shows expired recovery", async () => {
  window.history.replaceState(
    null,
    "",
    "/decrypt/A7K2Q#key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  );
  const fetch = jest
    .fn<typeof global.fetch>()
    .mockRejectedValue(
      new Error("This file expired. Ask the sender to upload it again."),
    );
  global.fetch = fetch;
  render(<DecryptExperience id="A7K2Q" />);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /decrypt file/i }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("expired"),
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe("/A7K2Q");
});
