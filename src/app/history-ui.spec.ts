import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`history defaults off, has no helper or routine feedback, and preserves explicit consent at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const openOptions = async () => {
      await page.getByRole("button", { name: /Advanced options/ }).click();
      return page.getByRole("switch", { name: "Save history" });
    };
    let toggle = await openOptions();
    await expect(toggle).not.toBeChecked();
    const setting = page.locator(".switch-setting").filter({ has: toggle });
    await expect(setting).toHaveText("Save history");
    await expect(setting.locator("small")).toHaveCount(0);
    await expect(page.locator("#history-help")).toHaveCount(0);
    await expect(page.locator("#advanced-options .history-status")).toHaveCount(
      0,
    );
    await toggle.check();
    await expect(page.locator("body")).not.toContainText("History enabled");
    await expect(page.locator("#advanced-options .history-status")).toHaveCount(
      0,
    );
    await page.reload();
    toggle = await openOptions();
    await expect(toggle).toBeChecked();
    const other = await context.newPage();
    await other.goto("/");
    await other.getByRole("button", { name: /Advanced options/ }).click();
    const otherToggle = other.getByRole("switch", { name: "Save history" });
    await expect(otherToggle).toBeChecked();
    for (const enabled of [false, true, false]) {
      await toggle.setChecked(enabled);
      if (enabled) await expect(otherToggle).toBeChecked();
      else await expect(otherToggle).not.toBeChecked();
      for (const tab of [page, other]) {
        await expect(
          tab.locator("#advanced-options .history-status"),
        ).toHaveCount(0);
        await expect(tab.locator("body")).not.toContainText("History enabled");
        await expect(tab.locator("body")).not.toContainText("History disabled");
      }
    }
    await page.reload();
    toggle = await openOptions();
    await expect(toggle).not.toBeChecked();
  });
}
