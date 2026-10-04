import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders the homepage value proposition and structured data", async ({
  baseURL,
  page,
}) => {
  await page.goto("/");
  const expectedOrigin = new URL(baseURL ?? "http://127.0.0.1:3000").origin;

  await expect(
    page.getByRole("heading", { name: "Share temporary files and text." }),
  ).toBeVisible();
  await expect(
    page.getByText("Everything expires automatically."),
  ).toBeVisible();
  await expect(page.getByText("Recent uploads")).toHaveCount(0);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page).toHaveTitle("Up - Remastered");

  const uploadCard = page.locator(".upload-card");
  const fileModeHeight = (await uploadCard.boundingBox())?.height;
  await page.getByRole("tab", { name: "Text" }).click();
  await expect(page.getByLabel("Or upload text")).toHaveCSS(
    "max-height",
    "160px",
  );
  expect((await uploadCard.boundingBox())?.height).toBe(fileModeHeight);

  const jsonLd = await page
    .locator('script[type="application/ld+json"]')
    .textContent();

  expect(JSON.parse(jsonLd ?? "null")).toMatchObject({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Up - Remastered",
    url: `${expectedOrigin}/`,
  });

  const canonicalUrl = new URL(
    (await page.locator('link[rel="canonical"]').getAttribute("href")) ?? "",
  );
  expect(canonicalUrl.origin).toBe(expectedOrigin);
  expect(canonicalUrl.pathname).toBe("/");

  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "website",
  );

  const openGraphUrl = new URL(
    (await page.locator('meta[property="og:url"]').getAttribute("content")) ??
      "",
  );
  expect(openGraphUrl.origin).toBe(expectedOrigin);
  expect(openGraphUrl.pathname).toBe("/");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary",
  );
});

test("keeps the homepage hierarchy aligned and readable across viewports", async ({
  page,
}) => {
  const heading = page.getByRole("heading", {
    name: "Share temporary files and text.",
  });
  const card = page.locator(".upload-card");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const wideHeading = await heading.boundingBox();
  const wideCard = await card.boundingBox();
  expect(wideHeading).not.toBeNull();
  expect(wideCard).not.toBeNull();
  expect(wideHeading?.x).toBe(wideCard?.x);
  expect(wideHeading?.width).toBeLessThanOrEqual(wideCard?.width ?? 0);

  await page.setViewportSize({ width: 320, height: 900 });

  const narrowHeading = await heading.boundingBox();
  const narrowCard = await card.boundingBox();
  expect(narrowHeading).not.toBeNull();
  expect(narrowCard).not.toBeNull();
  expect(narrowHeading?.x).toBe(narrowCard?.x);
  expect(narrowHeading?.width).toBeLessThanOrEqual(narrowCard?.width ?? 0);
  expect(narrowHeading?.height).toBeGreaterThan(wideHeading?.height ?? 0);
});

test("has no browser-level accessibility violations", async ({ page }) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});

test("keeps the shared footer usable across responsive layouts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const footer = page.getByRole("contentinfo");
  const footerInner = footer.locator(".site-footer-inner");

  await expect(footer).toBeVisible();
  await expect(footer).toHaveCSS(
    "width",
    `${await page.evaluate(() => document.body.clientWidth)}px`,
  );
  await expect(footerInner).toHaveCSS("width", "800px");
  expect((await footer.boundingBox())?.y).toBeGreaterThanOrEqual(810);
  await expect(footer).toHaveCSS("opacity", "1");
  await expect(
    footer.getByRole("link", { name: "ShareX config" }),
  ).toHaveAttribute("href", "/sharex");
  await expect(
    footer.getByRole("link", { name: "Shell helper" }),
  ).toHaveAttribute("href", "/sh");
  const repositoryLink = footer.getByRole("link", {
    name: "GitHub repository (opens in a new tab)",
  });

  await expect(repositoryLink).toHaveAttribute(
    "href",
    "https://github.com/Kuboczoch/up-remastered",
  );
  await expect(repositoryLink).toHaveAttribute("rel", "noreferrer");
  await expect(repositoryLink).toHaveAttribute("target", "_blank");

  await page.setViewportSize({ width: 320, height: 700 });
  await expect(footer).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await footer.locator(".site-footer-version").evaluate((version) => {
    version.textContent = "v2026.09.27-long-prerelease-version";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.setViewportSize({ width: 640, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("serves browser icons and the web manifest", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".site-header")).toHaveCount(0);

  const browserIcons = page.locator(
    'link[rel="icon"], link[rel="apple-touch-icon"]',
  );
  await expect(browserIcons).toHaveCount(3);

  for (let index = 0; index < (await browserIcons.count()); index += 1) {
    const icon = browserIcons.nth(index);
    const href = await icon.getAttribute("href");
    const iconResponse = await page.request.get(href ?? "");

    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()["content-type"]).toMatch(/^image\//);
    expect((await iconResponse.body()).byteLength).toBeGreaterThan(0);
  }

  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  const response = await page.request.get(manifestHref ?? "");

  expect(response.ok()).toBe(true);
  const webManifest = await response.json();
  expect(webManifest).toMatchObject({
    name: "Up - Remastered",
    short_name: "up",
    start_url: "/",
    display: "standalone",
  });

  expect(webManifest.icons).toHaveLength(2);
  for (const icon of webManifest.icons) {
    const iconResponse = await page.request.get(icon.src);
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()["content-type"]).toContain("image/png");
    expect((await iconResponse.body()).byteLength).toBeGreaterThan(0);
  }
});

test("gives request routes descriptive product titles", async ({ page }) => {
  await page.goto("/request/new");

  await expect(page).toHaveTitle("Request a file | Up - Remastered");
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

for (const locale of ["en", "pl"] as const) {
  for (const path of ["/missing/nested", "/request/x/y", "/decrypt/x/y"]) {
    test(`unknown nested HTML ${path} has ${locale} SSR metadata without JavaScript`, async ({
      browser,
      baseURL,
    }) => {
      const context = await browser.newContext({
        baseURL,
        javaScriptEnabled: false,
        locale: locale === "pl" ? "pl-PL" : "en-US",
        extraHTTPHeaders: { "Accept-Language": locale },
      });
      const page = await context.newPage();
      try {
        const response = await page.goto(path);
        expect(response?.status()).toBe(404);
        expect(new URL(page.url()).pathname).toBe(path);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page).toHaveTitle(
          `${locale === "pl" ? "Nie znaleziono strony" : "Page not found"} | Up - Remastered`,
        );
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
          "content",
          /noindex/,
        );
        await expect(
          page.getByRole("heading", {
            name: locale === "pl" ? "Nie znaleziono strony" : "Page not found",
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("link", {
            name: locale === "pl" ? "Wróć na stronę główną" : "Return home",
          }),
        ).toHaveAttribute("href", "/");
      } finally {
        await context.close();
      }
    });
  }
}

test("Polish unknown HTML keeps locale choice, metadata and accessibility", async ({
  page,
}) => {
  await page.goto("/missing/nested?lang=pl");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page).toHaveTitle("Nie znaleziono strony | Up - Remastered");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const response = await page.goto("/another/missing/page");
  expect(response?.status()).toBe(404);
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
});

test("missing API and asset namespaces bypass locale HTML rewrites", async ({
  request,
}) => {
  for (const path of [
    "/api/missing/nested",
    "/_next/missing/nested",
    "/assets/missing/nested",
    "/u/missing/nested",
    "/sh/missing/nested",
    "/sharex/missing/nested",
    "/missing/nested.png",
  ]) {
    const response = await request.get(path, {
      headers: { "Accept-Language": "pl" },
    });
    expect(response.status()).toBe(404);
    expect(response.headers()["content-language"]).toBeUndefined();
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  }
});

test("keeps missing download responses non-disclosing", async ({ request }) => {
  for (const path of ["/not-a-public-upload-id", "/u/not-a-public-upload-id"]) {
    const response = await request.get(path);

    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers()["content-disposition"]).toBeUndefined();
    expect(await response.text()).toBe("File unavailable.\n");
    expect(response.headers()["content-language"]).toBeUndefined();
    const head = await request.head(path, {
      headers: { "Accept-Language": "pl" },
    });
    expect(head.status()).toBe(404);
    expect(head.headers()["content-type"]).toBe("text/plain; charset=utf-8");
    expect(head.headers()["content-disposition"]).toBeUndefined();
    expect(head.headers()["content-language"]).toBeUndefined();
    expect((await head.body()).byteLength).toBe(0);
  }
});
