import { afterEach, expect, it, jest } from "@jest/globals";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { UploadExperience } from "./upload-experience";

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  jest.restoreAllMocks();
});

it("enables only implemented Advanced settings without accessing history before consent", () => {
  sessionStorage.setItem("up-remastered:upload-history:v1", "legacy");
  const write = jest.spyOn(Storage.prototype, "setItem");
  const remove = jest.spyOn(Storage.prototype, "removeItem");
  global.fetch = jest.fn<typeof fetch>(() => new Promise(() => {}));
  const { getByRole, container } = render(
    <UploadExperience initialMaxBytes={1000000} />,
  );
  fireEvent.click(getByRole("tab", { name: /^Text$/ }));
  fireEvent.click(getByRole("button", { name: /Advanced options/ }));
  const controls = container.querySelectorAll<
    HTMLInputElement | HTMLSelectElement
  >("#advanced-options input, #advanced-options select");
  expect(controls).toHaveLength(5);
  controls.forEach((control) =>
    expect(control.disabled).toBe(
      ![
        "save-history",
        "key-protect",
        "expiry-hours",
        "download-limit",
      ].includes(control.id),
    ),
  );
  const history = getByRole("switch", {
    name: "Save history",
  }) as HTMLInputElement;
  expect(history.checked).toBe(false);
  expect(history.disabled).toBe(false);
  expect(container.querySelector(".history-card")).toBeNull();
  expect(container.querySelector("#advanced-options")?.textContent).not.toMatch(
    /coming later|not available yet/i,
  );
  expect(
    (getByRole("button", { name: "Done" }) as HTMLButtonElement).disabled,
  ).toBe(false);
  expect(
    (
      getByRole("button", {
        name: "Close advanced options",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
