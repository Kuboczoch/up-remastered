import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const locale of ["en", "pl"] as const) {
  test(`${locale} global 404 has localized initial HTML, title and recovery`, async ({
    browser,
    request,
    baseURL,
  }) => {
    const title = locale === "pl" ? "Nie znaleziono strony" : "Page not found";
    const home = locale === "pl" ? "Wróć na stronę główną" : "Return home";
    const languageHeaders: Record<string, string>[] = [
      { "Accept-Language": locale },
      { "Accept-Language": "en", Cookie: `up-locale=${locale}` },
      {
        "Accept-Language": locale,
        "x-up-locale": locale === "pl" ? "en" : "pl",
      },
    ];
    for (const headers of languageHeaders) {
      const response = await request.get("/missing/nested/page", { headers });
      expect(response.status()).toBe(404);
      expect(response.headers()["content-language"]).toBe(locale);
      const html = await response.text();
      expect(html).toContain(`<html lang="${locale}">`);
      expect(html).toContain(`<title>${title}</title>`);
      expect(html).toContain(title);
      for (const token of ["accept-language", "cookie", "rsc"])
        expect(response.headers().vary.toLowerCase()).toContain(token);
    }
    const explicit = await request.get(`/missing/nested/page?lang=${locale}`, {
      headers: { "Accept-Language": locale === "pl" ? "en" : "pl" },
    });
    expect(explicit.status()).toBe(404);
    expect(await explicit.text()).toContain(`<title>${title}</title>`);
    const context = await browser.newContext({ locale, baseURL });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/missing/nested/page?lang=${locale}`);
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    const link = page.getByRole("link", { name: home });
    await expect(link).toHaveAttribute("href", "/");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await link.click();
    await expect(page).toHaveURL("/");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    expect(errors).toEqual([]);
    await context.close();
  });
}
