import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`keeps a graphite-only theme at ${width}px with ${colorScheme} OS preference`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(32, 33, 39)",
      );
      await expect(page.locator(".upload-card")).toHaveCSS(
        "background-color",
        "rgb(43, 44, 53)",
      );
      await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
        "content",
        "#202127",
      );
      await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
        "content",
        "dark",
      );
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

      await page.getByRole("button", { name: "Text", exact: true }).click();
      const text = page.getByLabel("Or upload text");
      await expect(text).toHaveCSS("background-color", "rgb(43, 44, 53)");
      await text.focus();
      await expect(text).toHaveCSS("outline-color", "rgb(164, 154, 245)");
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

      await page.goto("/request/new");
      await expect(page.getByLabel("Maximum upload size in bytes")).toHaveCSS(
        "background-color",
        "rgb(43, 44, 53)",
      );
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    });
  }
}

test("keeps upload results and QR dialog dark while preserving QR contrast", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#file-picker").setInputFiles({
    buffer: Buffer.from("dark theme"),
    mimeType: "text/plain",
    name: "theme.txt",
  });
  await expect(page.getByRole("heading", { name: "theme.txt" })).toBeVisible();
  await expect(page.locator(".result-url")).toHaveCSS(
    "background-color",
    "rgb(43, 44, 53)",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Show QR code" }).click();
  await expect(page.getByRole("dialog")).toHaveCSS(
    "background-color",
    "rgb(43, 44, 53)",
  );
  await expect(page.getByTestId("qr-code")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
