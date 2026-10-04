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
