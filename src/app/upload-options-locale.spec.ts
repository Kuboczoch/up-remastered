import { expect, test } from "@playwright/test";

for (const locale of ["en", "pl"] as const) {
  for (const mobile of [false, true]) {
    test(`${locale} upload options SSR and ${mobile ? "mobile dialog" : "desktop region"} retain keyboard and upload settings`, async ({
      browser,
      request,
      baseURL,
    }) => {
      const pl = locale === "pl";
      const title = pl ? "Opcje zaawansowane" : "Advanced options";
      const response = await request.get("/", {
        headers: { "Accept-Language": locale },
      });
      const html = await response.text();
      expect(html).toContain(`<html lang="${locale}">`);
      expect(html).toContain(pl ? "Chroń kluczem" : "Key protect");
      expect(html).toContain(pl ? "Zapisuj historię" : "Save history");
      expect(response.headers()["content-language"]).toBe(locale);
      for (const token of ["rsc", "accept-language", "cookie"])
        expect(
          response
            .headers()
            .vary.toLowerCase()
            .split(/\s*,\s*/),
        ).toContain(token);
      const context = await browser.newContext({
        locale,
        baseURL,
        viewport: mobile
          ? { width: 390, height: 844 }
          : { width: 1280, height: 900 },
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/");
      const trigger = page.getByRole("button", { name: new RegExp(title) });
      await trigger.click();
      const panel = page.getByRole(mobile ? "dialog" : "region", {
        name: title,
      });
      await expect(panel).toBeVisible();
      const history = panel.getByRole("switch", {
        name: pl ? "Zapisuj historię" : "Save history",
      });
      await expect(history).not.toBeChecked();
      const expiry = panel.getByRole("combobox", {
        name: pl ? "Wygasa po" : "Expires after",
      });
      await expiry.selectOption("3");
      await expect(expiry).toHaveValue("3");
      await expect(expiry.locator("option:checked")).toHaveText(
        pl ? "3 godziny" : "3 hours",
      );
      const slider = panel.getByRole("slider", {
        name: pl ? "Limit pobrań" : "Download limit",
      });
      await expect(slider).toHaveAttribute(
        "aria-valuetext",
        pl ? "Bez limitu" : "Unlimited",
      );
      await slider.focus();
      await page.keyboard.press("Home");
      await expect(slider).toHaveValue("1");
      await expect(slider).toHaveAttribute(
        "aria-valuetext",
        pl ? "1 pobranie" : "1 download",
      );
      await page.keyboard.press("ArrowRight");
      await expect(slider).toHaveAttribute(
        "aria-valuetext",
        pl ? "2 pobrania" : "2 downloads",
      );
      await panel
        .getByRole("switch", { name: pl ? "Chroń kluczem" : "Key protect" })
        .check();
      await panel
        .getByRole("button", {
          name: mobile
            ? pl
              ? "Gotowe"
              : "Done"
            : pl
              ? "Zamknij opcje zaawansowane"
              : "Close advanced options",
          exact: true,
        })
        .click();
      await expect(panel).toBeHidden();
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(expiry).toHaveValue("3");
      await expect(slider).toHaveValue("2");
      await expect(
        panel.getByRole("switch", {
          name: pl ? "Chroń kluczem" : "Key protect",
        }),
      ).toBeChecked();
      await expect(history).not.toBeChecked();
      if (mobile) {
        await page.keyboard.press("Escape");
        await expect(panel).toBeHidden();
        await expect(trigger).toBeFocused();
      } else {
        await panel
          .getByRole("button", {
            name: pl ? "Zamknij opcje zaawansowane" : "Close advanced options",
          })
          .click();
        await expect(panel).toBeHidden();
      }
      expect(errors).toEqual([]);
      await context.close();
    });
  }
}
