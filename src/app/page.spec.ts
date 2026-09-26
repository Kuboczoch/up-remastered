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

test("renders an intentional not-found page", async ({ page }) => {
  const response = await page.goto("/this-route/does-not-exist");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Return home" })).toHaveAttribute(
    "href",
    "/",
  );

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
