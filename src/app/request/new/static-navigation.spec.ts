import { expect, test } from "@playwright/test";

for (const name of ["Request a file", "Request a file ↗"]) {
  test(`opens a prerendered request form from ${name}`, async ({ page }) => {
    await page.goto(name === "Request a file" ? "/request/manage" : "/");
    const responsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/request/new",
    );
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL("/request/new");
    await expect(
      page.getByRole("heading", { name: "Request a file." }),
    ).toBeVisible();
    await expect(page.getByLabel("Maximum upload size")).toBeVisible();
    await expect(page.locator(".loading-page")).toHaveCount(0);
    const response = await responsePromise;
    expect(response.headers()["x-nextjs-cache"]).toBe("HIT");
  });
}

test("renders the form before a delayed limits response", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/configuration", async (route) => {
    await pending;
    await route.fulfill({
      json: { maxFileLifetime: 7200000, maxTemporaryFileSize: 4096 },
    });
  });
  await page.goto("/request/new");
  await expect(
    page.getByRole("heading", { name: "Request a file." }),
  ).toBeVisible();
  await expect(page.locator("form [role=status]")).toHaveText(
    "Loading server limits…",
  );
  await expect(page.getByLabel("Maximum upload size")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create upload request" }),
  ).toBeDisabled();
  await expect(page.locator(".loading-page")).toHaveCount(0);
  release();
  await expect(
    page.getByRole("button", { name: "Create upload request" }),
  ).toBeEnabled();
  await expect(page.getByLabel("Request expires")).toHaveValue("3600000");
});

for (const maxFileLifetime of [36000, 36000.5]) {
  test(`accepts valid sub-minute lifetime ${maxFileLifetime}`, async ({
    page,
  }) => {
    await page.route("**/api/configuration", (route) =>
      route.fulfill({
        json: { maxFileLifetime, maxTemporaryFileSize: 2048 },
      }),
    );
    await page.goto("/request/new");
    await expect(
      page.getByRole("button", { name: "Create upload request" }),
    ).toBeEnabled();
    await expect(page.getByLabel("Request expires")).toHaveValue(
      String(maxFileLifetime),
    );
  });
}

for (const configuration of [
  { maxFileLifetime: 0, maxTemporaryFileSize: 2048 },
  { maxFileLifetime: 3600000, maxTemporaryFileSize: "2048" },
  null,
]) {
  test(`rejects unsafe runtime limits: ${JSON.stringify(configuration)}`, async ({
    page,
  }) => {
    await page.route("**/api/configuration", (route) =>
      route.fulfill({ json: configuration }),
    );
    await page.goto("/request/new");
    await expect(page.locator("form [role=alert]")).toHaveText(
      "Could not load server limits. Please retry.",
    );
    await expect(
      page.getByRole("button", { name: "Create upload request" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Retry loading limits" }),
    ).toBeVisible();
  });
}

test("shows the static form while runtime limits fail, then retries safely", async ({
  page,
}) => {
  let succeed = false;
  await page.route("**/api/configuration", (route) =>
    route.fulfill({
      status: succeed ? 200 : 503,
      contentType: "application/json",
      body: JSON.stringify({
        maxFileLifetime: 30 * 60_000,
        maxTemporaryFileSize: 2048,
      }),
    }),
  );
  await page.goto("/request/new");
  await expect(page.getByLabel("Maximum upload size")).toBeVisible();
  await expect(page.locator("form [role=alert]")).toHaveText(
    "Could not load server limits. Please retry.",
  );
  await expect(
    page.getByRole("button", { name: "Create upload request" }),
  ).toBeDisabled();
  succeed = true;
  await page.getByRole("button", { name: "Retry loading limits" }).click();
  await expect(
    page.locator("form > p").filter({ hasText: "Server maximum: 2 KiB." }),
  ).toBeVisible();
  await expect(page.getByLabel("Request expires")).toHaveValue("1800000");
  await expect(
    page.getByRole("button", { name: "Create upload request" }),
  ).toBeEnabled();
});
