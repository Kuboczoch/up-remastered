import { expect, test } from "@playwright/test";

test("renders the homepage greeting", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("hello from up - remastered")).toBeVisible();
});
