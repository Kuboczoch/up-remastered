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
    page.getByText("Everything expires automatically. No account required."),
  ).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page).toHaveTitle("Up - Remastered");

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

test("serves browser icons and the web manifest", async ({ page }) => {
  await page.goto("/");

  const brandMark = page
    .getByRole("link", { name: "Up - Remastered home" })
    .locator("img");
  await expect(brandMark).toBeVisible();
  await expect(brandMark).toHaveAttribute("src", "/brand-mark.svg");
  await expect(brandMark).toHaveCSS("width", "34px");
  await expect(brandMark).toHaveCSS("height", "34px");

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

test("keeps missing download responses non-disclosing", async ({ request }) => {
  for (const path of ["/not-a-public-upload-id", "/u/not-a-public-upload-id"]) {
    const response = await request.get(path);

    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers()["content-disposition"]).toBeUndefined();
    expect(await response.text()).toBe("File unavailable.\n");
  }
});
