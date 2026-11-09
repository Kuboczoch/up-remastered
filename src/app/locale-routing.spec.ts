import { expect, test } from "@playwright/test";

test("upload-rail navigation restores localized request metadata through history", async ({
  browser,
  baseURL,
}) => {
  for (const locale of ["pl", "en"]) {
    const context = await browser.newContext({
      locale: locale === "pl" ? "en" : "pl",
      baseURL,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const polish = locale === "pl";
    const requestTitle = polish ? "Poproś o plik" : "Request a file";
    await page.goto(`/?lang=${locale}`);
    await page
      .getByRole("link", { name: `${requestTitle} ↗`, exact: true })
      .click();
    await expect(page).toHaveURL("/request/new");
    await expect(page).toHaveTitle(new RegExp(requestTitle));
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page
      .getByRole("link", {
        name: polish ? "← Wróć do przesyłania" : "← Back to uploads",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL("/");
    await expect(page).toHaveTitle("Up - Remastered");
    await page.goBack();
    await expect(page).toHaveURL("/request/new");
    await expect(page).toHaveTitle(new RegExp(requestTitle));
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page.goBack();
    await expect(page).toHaveURL(`/?lang=${locale}`);
    await expect(page).toHaveTitle("Up - Remastered");
    await page.goForward();
    await expect(page).toHaveURL("/request/new");
    await expect(page).toHaveTitle(new RegExp(requestTitle));
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    expect(errors).toEqual([]);
    await context.close();
  }
});

test("public-link navigation and browser history retain explicit locale and metadata", async ({
  browser,
  baseURL,
}) => {
  for (const locale of ["pl", "en"]) {
    const context = await browser.newContext({
      locale: locale === "pl" ? "en" : "pl",
      baseURL,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (entry) => {
      if (entry.type() === "error") errors.push(entry.text());
    });
    const polish = locale === "pl";
    const requestTitle = polish ? "Poproś o plik" : "Request a file";
    await page.goto(`/request/manage?lang=${locale}`);
    await expect(page).toHaveTitle(
      new RegExp(polish ? "Zarządzaj prośbą o plik" : "Manage upload request"),
    );
    await page.getByRole("link", { name: requestTitle, exact: true }).click();
    await expect(page).toHaveURL("/request/new");
    await expect(page).toHaveTitle(new RegExp(requestTitle));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `${requestTitle}.`,
    );
    await page
      .getByRole("link", {
        name: polish
          ? "Up - Remastered — strona główna"
          : "Up - Remastered home",
      })
      .click();
    await expect(page).toHaveURL("/");
    await expect(page).toHaveTitle("Up - Remastered");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      polish
        ? "Mały, samodzielnie hostowany serwis do tymczasowego udostępniania plików."
        : "Small self-hosted temporary file hosting service.",
    );
    await page.goBack();
    await expect(page).toHaveURL("/request/new");
    await expect(page).toHaveTitle(new RegExp(requestTitle));
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page.goForward();
    await expect(page).toHaveURL("/");
    await expect(page).toHaveTitle("Up - Remastered");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(
      page.getByText(
        polish ? "Z założenia tymczasowe." : "Temporary by design.",
      ),
    ).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  }
});

test("request creation serves localized metadata, accessible inputs and validation", async ({
  browser,
  request,
  baseURL,
}) => {
  const errors: string[] = [];
  for (const locale of ["pl", "en", "pl"]) {
    // Chromium's configured browser locale owns Accept-Language on navigation.
    // Fresh contexts model fresh visitors, not explicit preference cookies.
    const context = await browser.newContext({ locale, baseURL });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (entry) => {
      if (entry.type() === "error") errors.push(entry.text());
    });
    const polish = locale === "pl";
    const title = polish ? "Poproś o plik" : "Request a file";
    const response = await request.get("/request/new", {
      headers: { "Accept-Language": locale },
    });
    const html = await response.text();
    expect(html).toContain(`${title}.</h1>`);
    expect(html).toContain(
      polish ? "Utwórz prośbę o plik" : "Create upload request",
    );
    expect(html).toMatch(new RegExp(`<title>[^<]*${title}[^<]*</title>`));
    await page.goto("/request/new");
    await expect(page).toHaveTitle(new RegExp(title));
    const size = page.getByRole("combobox", {
      name: polish ? /^Maksymalny rozmiar pliku/ : /^Maximum upload size/,
    });
    await expect(size).toBeEnabled();
    await expect(
      page.getByRole("combobox", {
        name: polish ? /^Prośba wygasa/ : /^Request expires/,
      }),
    ).toContainText(polish ? "1 godzina" : "1 hour");
    await size.selectOption("custom");
    await page
      .getByLabel(polish ? "Rozmiar" : "Size amount", { exact: true })
      .fill("0.1");
    await page
      .getByRole("button", {
        name: polish ? "Utwórz prośbę o plik" : "Create upload request",
        exact: true,
      })
      .click();
    await expect(page.locator("form").getByRole("alert")).toHaveText(
      polish
        ? "Rozmiar musi odpowiadać całkowitej liczbie bajtów."
        : "Size must convert to a whole number of bytes.",
    );
    await context.close();
  }
  expect(
    errors.filter((error) =>
      /hydration|did not match|server rendered/i.test(error),
    ),
  ).toEqual([]);
});

test("locale-keyed static HTML/RSC keeps public URLs and alternating cache isolation", async ({
  request,
}) => {
  for (const path of [
    "/",
    "/request/new",
    "/request/manage",
    "/decrypt/example",
    "/request/example",
  ]) {
    for (const locale of ["pl", "en", "pl"]) {
      for (const rsc of [false, true]) {
        const response = await request.get(path, {
          headers: { "Accept-Language": locale, ...(rsc ? { RSC: "1" } : {}) },
        });
        expect(response.status()).toBe(200);

        expect(
          response.headers()["content-language"],
          `${path} ${locale} rsc=${rsc} final=${response.url()}`,
        ).toBe(locale);
        expect(response.headers()["content-type"]).toContain(
          rsc ? "text/x-component" : "text/html",
        );
        const body = await response.text();
        if (rsc) expect(body).toContain(`"locale":"${locale}"`);
        else {
          expect(body).toContain(
            locale === "pl"
              ? "Z założenia tymczasowe."
              : "Temporary by design.",
          );
          expect(body).toContain(`<html lang="${locale}">`);
        }
        const vary = response
          .headers()
          .vary.toLowerCase()
          .split(/\s*,\s*/);
        for (const token of [
          "rsc",
          "next-router-state-tree",
          "next-router-prefetch",
          "next-router-segment-prefetch",
          "accept-language",
          "cookie",
        ])
          expect(vary).toContain(token);
      }
    }
  }
});

test("encoded saved locale agrees between initial HTML and final response headers", async ({
  request,
}) => {
  for (const [cookie, locale] of [
    ["up-locale=%70%6c", "pl"],
    ["up-locale=en; up-locale=%70%6c", "pl"],
    ["up-locale=pl; up-locale=%", "pl"],
    ["up-locale=%", "en"],
  ]) {
    for (const rsc of [false, true]) {
      const response = await request.get("/", {
        headers: {
          Cookie: cookie,
          "Accept-Language": "en",
          ...(rsc ? { RSC: "1" } : {}),
        },
      });
      expect(response.status()).toBe(200);
      const body = await response.text();
      expect(body).toContain(
        rsc ? `"locale":"${locale}"` : `<html lang="${locale}">`,
      );
      expect(response.headers()["content-language"]).toBe(locale);
    }
  }
});

test("explicit locale persists across browser navigation without hydration disagreement", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setExtraHTTPHeaders({ "Accept-Language": "en" });
  await page.goto("/request/manage?lang=pl");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await page.getByRole("link", { name: "Poproś o plik", exact: true }).click();
  await expect(page).toHaveURL("/request/new");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.getByText("Z założenia tymczasowe.")).toBeVisible();
  expect(
    errors.filter((error) =>
      /hydration|did not match|server rendered/i.test(error),
    ),
  ).toEqual([]);
  await page.goto("/?lang=en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/request/manage");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
