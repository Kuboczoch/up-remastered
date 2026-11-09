import { expect, test } from "@playwright/test";

for (const locale of ["en", "pl"] as const) {
  for (const state of ["ready", "invalid"] as const) {
    test(`${locale} ${state} recipient Home navigation restores metadata through history`, async ({
      browser,
      baseURL,
      request,
    }) => {
      const context = await browser.newContext({
        locale: locale === "pl" ? "en" : "pl",
        baseURL,
      });
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        let path = "/request/not-a-valid-token";
        if (state === "ready") {
          const response = await request.post("/api/upload-requests", {
            data: {
              maxBytes: 1536,
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          });
          expect(response.status()).toBe(201);
          path = new URL((await response.json()).uploadUrl).pathname;
        }
        const title =
          locale === "pl"
            ? "Prześlij zamówiony plik | Up - Remastered"
            : "Upload a requested file | Up - Remastered";
        await page.goto(`${path}?lang=${locale}`);
        await expect(page).toHaveTitle(title);
        await expect(page.locator('input[type="file"]')).toHaveCount(
          state === "ready" ? 1 : 0,
        );
        await page
          .getByRole("link", {
            name: locale === "pl" ? "← Strona główna" : "← Home",
            exact: true,
          })
          .click();
        await expect(page).toHaveURL("/");
        await expect(page).toHaveTitle("Up - Remastered");
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await page.goBack();
        await expect(page).toHaveURL(`${path}?lang=${locale}`);
        await expect(page).toHaveTitle(title);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator('input[type="file"]')).toHaveCount(
          state === "ready" ? 1 : 0,
        );
        await page.goForward();
        await expect(page).toHaveURL("/");
        await expect(page).toHaveTitle("Up - Remastered");
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}
