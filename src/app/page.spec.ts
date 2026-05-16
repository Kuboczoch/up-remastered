import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders the homepage greeting", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("hello from up - remastered")).toBeVisible();
});

test("has no browser-level accessibility violations", async ({ page }) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});
