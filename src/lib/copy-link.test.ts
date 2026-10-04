import { expect, it, jest } from "@jest/globals";
import { copyLink } from "./copy-link";

it("reports manual recovery when clipboard is absent", async () => {
  expect(await copyLink("https://example.test/a#key=secret", {})).toBe(
    "manual",
  );
});
it("reports permission rejection without claiming success", async () => {
  const writeText = jest
    .fn<(text: string) => Promise<void>>()
    .mockRejectedValue(new Error("denied"));
  expect(
    await copyLink("https://example.test/a", { clipboard: { writeText } }),
  ).toBe("manual");
});
it("copies the complete URL unchanged", async () => {
  const writeText = jest
    .fn<(text: string) => Promise<void>>()
    .mockResolvedValue(undefined);
  expect(
    await copyLink("https://example.test/a#key=secret", {
      clipboard: { writeText },
    }),
  ).toBe("copied");
  expect(writeText).toHaveBeenCalledWith("https://example.test/a#key=secret");
});

it.each([
  undefined,
  {},
  { writeText: undefined },
  { writeText: "not callable" },
])(
  "reports manual recovery for malformed or missing clipboard APIs: %p",
  async (clipboard) => {
    expect(
      await copyLink("https://example.test/request/manage#secret", {
        clipboard: clipboard as Pick<Clipboard, "writeText"> | undefined,
      }),
    ).toBe("manual");
  },
);
it("handles synchronous clipboard failures", async () => {
  expect(
    await copyLink("link", {
      clipboard: {
        writeText: () => {
          throw new Error("Unavailable");
        },
      },
    }),
  ).toBe("manual");
});
it("does not claim success before the clipboard promise settles", async () => {
  let finish!: () => void;
  const writeText = jest.fn<(text: string) => Promise<void>>(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  let settled = false;
  const pending = copyLink("https://example.test/request/manage#secret", {
    clipboard: { writeText },
  }).then((outcome) => {
    settled = true;
    return outcome;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  finish();
  expect(await pending).toBe("copied");
});
