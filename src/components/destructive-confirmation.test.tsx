import { afterEach, expect, it, jest } from "@jest/globals";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { axe } from "jest-axe";
import { DestructiveConfirmation } from "./destructive-confirmation";

afterEach(cleanup);
function mount(onConfirm = jest.fn<() => Promise<void>>(async () => {})) {
  const view = render(
    <section>
      <DestructiveConfirmation
        label="Delete server file"
        title="Delete notes.txt?"
        description="All shared links for notes.txt will stop working. This cannot be undone."
        confirmLabel="Confirm deletion"
        onConfirm={onConfirm}
      />
    </section>,
  );
  const trigger = view.getByRole("button", { name: "Delete server file" });
  fireEvent.click(trigger);
  return { ...view, trigger, onConfirm };
}

it("has an accessible named and described dialog without axe violations", async () => {
  const view = mount();
  expect((await axe(view.getByRole("dialog"))).violations).toEqual([]);
});

it("focuses Cancel, traps Tab in both directions, and returns focus on Escape or Cancel without mutation", () => {
  const view = mount();
  const cancel = view.getByRole("button", { name: "Cancel" });
  const confirm = view.getByRole("button", { name: "Confirm deletion" });
  expect(document.activeElement).toBe(cancel);
  fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(confirm);
  fireEvent.keyDown(confirm, { key: "Tab" });
  expect(document.activeElement).toBe(cancel);
  fireEvent.keyDown(cancel, { key: "Escape" });
  expect(view.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(view.trigger);
  fireEvent.click(view.trigger);
  fireEvent.click(view.getByRole("button", { name: "Cancel" }));
  expect(view.onConfirm).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(view.trigger);
});

it("synchronously guards repeated confirmation, keeps pending work visible, and closes only on success", async () => {
  let finish!: () => void;
  const callback = jest.fn<() => Promise<void>>(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = mount(callback);
  const confirm = view.getByRole("button", { name: "Confirm deletion" });
  act(() => {
    confirm.click();
    confirm.click();
  });
  expect(callback).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(view.getByRole("dialog"), { key: "Escape" });
  expect(view.getByRole("dialog")).toBeTruthy();
  await act(async () => finish());
  expect(view.queryByRole("dialog")).toBeNull();
});

it("announces failures, retains the confirmation for retry and restores inert state", async () => {
  const callback = jest.fn<() => Promise<void>>(async () => {
    throw new Error("Server refused deletion.");
  });
  const view = mount(callback);
  expect(view.container.inert).toBe(true);
  fireEvent.click(view.getByRole("button", { name: "Confirm deletion" }));
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toBe(
      "Server refused deletion.",
    ),
  );
  expect(view.getByRole("dialog")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Cancel" }));
  expect(view.container.inert).not.toBe(true);
});
