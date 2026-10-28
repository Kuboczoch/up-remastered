import { afterEach, expect, it, jest } from "@jest/globals";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { LocaleProvider } from "@/lib/i18n/provider";
import { UploadExperience } from "./upload-experience";

afterEach(() => {
  cleanup();
  localStorage.clear();
  jest.restoreAllMocks();
});

it("localizes Polish options, fractional hours and accessible download plurals without changing values", () => {
  global.fetch = jest.fn<typeof fetch>(() => new Promise(() => {}));
  const view = render(
    <LocaleProvider locale="pl">
      <UploadExperience
        initialMaxBytes={4096}
        initialExpirationHours={0.5}
        maxExpirationHours={24}
      />
    </LocaleProvider>,
  );
  fireEvent.click(view.getByRole("button", { name: /Opcje zaawansowane/ }));
  expect(view.getByRole("region", { name: "Opcje zaawansowane" })).toBeTruthy();
  const expiry = view.getByLabelText("Wygasa po") as HTMLSelectElement;
  expect(expiry.value).toBe("0.5");
  expect(Array.from(expiry.options, (option) => option.text)).toEqual([
    "0,5 godziny",
    "1 godzina",
    "3 godziny",
    "6 godzin",
    "12 godzin",
    "24 godziny",
  ]);
  expect(
    (view.getByRole("switch", { name: "Zapisuj historię" }) as HTMLInputElement)
      .checked,
  ).toBe(false);
  expect(view.getByRole("switch", { name: "Chroń kluczem" })).toBeTruthy();
  expect(view.getByText(/AES-256-GCM w Twojej przeglądarce/)).toBeTruthy();
  const slider = view.getByRole("slider", { name: "Limit pobrań" });
  expect(slider.getAttribute("aria-valuetext")).toBe("Bez limitu");
  for (const [value, text] of [
    [1, "1 pobranie"],
    [2, "2 pobrania"],
    [5, "5 pobrań"],
    [10, "10 pobrań"],
  ] as const) {
    fireEvent.change(slider, { target: { value } });
    expect(slider.getAttribute("aria-valuetext")).toBe(text);
    expect(view.getByText(text)).toBeTruthy();
    expect((slider as HTMLInputElement).value).toBe(String(value));
  }
  fireEvent.click(view.getByRole("button", { name: "Gotowe" }));
  expect(view.queryByRole("region", { name: "Opcje zaawansowane" })).toBeNull();
});

it("localizes storage failure feedback while keeping the history switch functional", () => {
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("storage denied");
  });
  global.fetch = jest.fn<typeof fetch>(() => new Promise(() => {}));
  const view = render(
    <LocaleProvider locale="pl">
      <UploadExperience initialMaxBytes={4096} />
    </LocaleProvider>,
  );
  fireEvent.click(view.getByRole("button", { name: /Opcje zaawansowane/ }));
  const toggle = view.getByRole("switch", {
    name: "Zapisuj historię",
  }) as HTMLInputElement;
  expect(toggle.getAttribute("aria-describedby")).toBe(
    "history-preference-warning",
  );
  expect(
    view.getByText(
      /Nie udało się zapisać lub odczytać ustawienia zapisywania historii/,
    ),
  ).toBeTruthy();
  fireEvent.click(toggle);
  expect(toggle.checked).toBe(true);
  fireEvent.click(
    view.getByRole("button", { name: "Zamknij opcje zaawansowane" }),
  );
  expect(view.queryByRole("region", { name: "Opcje zaawansowane" })).toBeNull();
});
