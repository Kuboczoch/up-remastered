/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { RequestedUploadForm } from "./requested-upload-form";

const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn();
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

function choose(maxBytes = 1024, size = 16) {
  render(<RequestedUploadForm maxBytes={maxBytes} token="disposable" />);
  jest
    .spyOn(FormData.prototype, "get")
    .mockReturnValue(new File(["x".repeat(size)], "disposable.txt"));
}
async function submit() {
  await act(async () =>
    fireEvent.submit(
      screen.getByRole("button", { name: "Upload file" }).closest("form")!,
    ),
  );
}

test.each([
  [1073741824, "1 GiB"],
  [2621440, "2.5 MiB"],
])("uses shared readable limit for %s", (maxBytes, label) => {
  render(<RequestedUploadForm maxBytes={maxBytes} token="disposable" />);
  expect(
    screen.getByText(`Maximum ${label}. This link is single-use.`),
  ).toBeDefined();
});

test.each([
  [1024, "1 KiB"],
  [2621440, "2.5 MiB"],
])(
  "uses readable limit in oversize validation for %s without sending bytes",
  async (maxBytes, label) => {
    choose(maxBytes, maxBytes + 1);
    await submit();
    expect(screen.getByRole("alert").textContent).toBe(
      `The file must be no larger than ${label}.`,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  },
);

test("unavailable response disables resubmission and requires safe status check", async () => {
  choose();
  jest.mocked(global.fetch).mockResolvedValue({ status: 404 } as Response);
  await submit();
  expect(
    (screen.getByRole("button", { name: "Upload file" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (screen.getByLabelText("Choose file") as HTMLInputElement).disabled,
  ).toBe(true);
  expect(
    screen
      .getByRole("link", { name: "Check request status" })
      .getAttribute("href"),
  ).toBe("/request/disposable");
  expect(screen.getByRole("alert").textContent).toContain("Do not retry");
  await submit();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("recoverable validation response permits correction", async () => {
  choose();
  const fetchMock = jest.mocked(global.fetch);
  fetchMock.mockResolvedValue({
    status: 413,
    ok: false,
    json: async () => ({ error: { message: "Too large." } }),
  } as Response);
  await submit();
  expect(screen.getByRole("alert").textContent).toBe("Too large.");
  expect(
    (screen.getByRole("button", { name: "Upload file" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  expect(screen.queryByRole("link")).toBeNull();
});
