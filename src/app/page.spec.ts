import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders the homepage greeting and structured data", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Share one thing, quickly." }),
  ).toBeVisible();

  const jsonLd = await page
    .locator('script[type="application/ld+json"]')
    .textContent();

  expect(JSON.parse(jsonLd ?? "null")).toMatchObject({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "up - remastered",
    url: "http://127.0.0.1:3000/",
  });

  const canonicalUrl = new URL(
    (await page.locator('link[rel="canonical"]').getAttribute("href")) ?? "",
  );
  expect(canonicalUrl.origin).toBe("http://127.0.0.1:3000");
  expect(canonicalUrl.pathname).toBe("/");

  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "website",
  );

  const openGraphUrl = new URL(
    (await page.locator('meta[property="og:url"]').getAttribute("content")) ??
      "",
  );
  expect(openGraphUrl.origin).toBe("http://127.0.0.1:3000");
  expect(openGraphUrl.pathname).toBe("/");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary",
  );
});

test("has no browser-level accessibility violations", async ({ page }) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});

test("serves browser icons and the web manifest", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.locator('link[rel="icon"][href*="favicon.ico"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('link[rel="apple-touch-icon"][href*="apple-icon"]'),
  ).toHaveCount(1);

  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  const response = await page.request.get(manifestHref ?? "");

  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    name: "up - remastered",
    short_name: "up",
    start_url: "/",
    display: "standalone",
  });

  for (const iconPath of ["/icons/icon-192.png", "/icons/icon-512.png"]) {
    const iconResponse = await page.request.get(iconPath);
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()["content-type"]).toContain("image/png");
  }
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
