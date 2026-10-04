import { expect, test } from "@playwright/test";

const historyKey = "up-remastered:upload-history:v1";
const consentKey = "up-remastered:history-consent";
const legacy = [
  {
    accessToken: "legacy-token",
    id: "AAA1A",
    originalName: "legacy-review.txt",
    size: 2,
    expiresAt: "2099-01-01T00:00:00Z",
    savedAt: "2026-01-01T00:00:00Z",
    shareUrl: "http://127.0.0.1:3000/AAA1A",
  },
];

test("real two-tab revocation erases receiving legacy history before re-enable", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  await other.evaluate(
    ({ historyKey, legacy }) =>
      sessionStorage.setItem(historyKey, JSON.stringify(legacy)),
    { historyKey, legacy },
  );
  await other.getByRole("button", { name: /Advanced options/ }).click();
  const otherSwitch = other.getByRole("switch", { name: "Save history" });
  await expect(otherSwitch).not.toBeChecked();
  expect(
    await other.evaluate((key) => sessionStorage.getItem(key), historyKey),
  ).toBe(JSON.stringify(legacy));
  await page.getByRole("button", { name: /Advanced options/ }).click();
  const firstSwitch = page.getByRole("switch", { name: "Save history" });
  await firstSwitch.check();
  await expect(otherSwitch).toBeChecked();
  await firstSwitch.uncheck();
  await expect(otherSwitch).not.toBeChecked();
  await expect
    .poll(() =>
      other.evaluate((key) => sessionStorage.getItem(key), historyKey),
    )
    .toBeNull();
  await otherSwitch.check();
  await expect(firstSwitch).toBeChecked();
  expect(
    await other.evaluate((key) => localStorage.getItem(key), historyKey),
  ).toBeNull();
  await expect(other.locator(".history-card")).toBeHidden();
});

test("real two-tab clear erases receiving legacy history without revoking consent", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Advanced options/ }).click();
  await page.getByRole("switch", { name: "Save history" }).check();
  await page.getByRole("button", { name: "Close advanced options" }).click();
  const other = await context.newPage();
  await other.goto("/");
  await other.getByRole("button", { name: /Advanced options/ }).click();
  await expect(
    other.getByRole("switch", { name: "Save history" }),
  ).toBeChecked();
  await other.evaluate(
    ({ historyKey, legacy }) =>
      sessionStorage.setItem(historyKey, JSON.stringify(legacy)),
    { historyKey, legacy },
  );
  await page.locator("#file-picker").setInputFiles({
    buffer: Buffer.from("review"),
    name: "review-clear.txt",
    mimeType: "text/plain",
  });
  await expect(
    page.getByRole("heading", { name: "review-clear.txt" }),
  ).toBeVisible();
  await expect(other.locator(".history-card")).toContainText(
    "review-clear.txt",
  );
  // Remove persisted records externally first: the explicit clear must still
  // broadcast even when removeItem itself emits no storage event.
  await page.evaluate((key) => localStorage.removeItem(key), historyKey);
  await page
    .getByRole("button", { name: "Clear history", exact: true })
    .click();
  await expect
    .poll(() =>
      other.evaluate((key) => sessionStorage.getItem(key), historyKey),
    )
    .toBeNull();
  await expect(
    other.getByRole("switch", { name: "Save history" }),
  ).toBeChecked();
  expect(
    await other.evaluate((key) => localStorage.getItem(key), consentKey),
  ).toBe("true");
  await other.reload();
  await expect(other.locator(".history-card")).toBeHidden();
  expect(
    await other.evaluate((key) => localStorage.getItem(key), historyKey),
  ).toBeNull();
  await page.getByRole("button", { name: "Upload another file" }).click();
  await page.locator("#file-picker").setInputFiles({
    buffer: Buffer.from("after"),
    name: "after-clear.txt",
    mimeType: "text/plain",
  });
  await expect(page.locator(".history-card")).toContainText("after-clear.txt");
});

test("mobile blocked consent warning is visible inside open options dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "up-remastered:history-consent")
        throw new DOMException("Blocked", "SecurityError");
      return setItem.call(this, key, value);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Advanced options/ }).click();
  const dialog = page.getByRole("dialog", { name: "Advanced options" });
  await dialog.getByRole("switch", { name: "Save history" }).click();
  const status = dialog.getByRole("status");
  await expect(status).toHaveText(
    "History could not be enabled because browser storage is unavailable.",
  );
  await expect(status).toBeInViewport({ ratio: 1 });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("switch", { name: "Save history" }),
  ).not.toBeChecked();
  expect(
    await status.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const panel = element.closest('[role="dialog"]')!.getBoundingClientRect();
      return rect.top >= panel.top && rect.bottom <= panel.bottom;
    }),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Done", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Close advanced options" }),
  ).toBeFocused();
});
