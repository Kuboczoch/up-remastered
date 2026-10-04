import { expect, test } from "@playwright/test";

test("selected browser expiration is enforced by the server", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Advanced options/ }).click();
  await page.getByLabel("Expires after").selectOption("3");
  await page.getByRole("button", { name: "Close advanced options" }).click();
  const started = Date.now();
  const responsePromise = page.waitForResponse("**/api/upload");
  await page.locator("#file-picker").setInputFiles({
    name: "expiry.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("expires"),
  });
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const body = await response.json();
  const lifetime = Date.parse(body.upload.expiresAt) - started;
  expect(lifetime).toBeGreaterThan(10_799_000);
  expect(lifetime).toBeLessThan(10_820_000);
});

test("selected finite limit admits exactly one competing full or ranged download", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Advanced options/ }).click();
  const slider = page.getByLabel("Download limit");
  await slider.fill("1");
  await expect(slider).toHaveAttribute("aria-valuetext", "1 download");
  await page.getByRole("button", { name: "Close advanced options" }).click();
  const responsePromise = page.waitForResponse("**/api/upload");
  await page.locator("#file-picker").setInputFiles({
    name: "limited.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("counted"),
  });
  const body = await (await responsePromise).json();
  const url = body.upload.shareUrl;
  expect((await request.head(url)).status()).toBe(200);
  expect(
    (await request.get(url, { headers: { Range: "bytes=99-100" } })).status(),
  ).toBe(416);
  const responses = await Promise.all([
    request.get(url),
    request.get(url, { headers: { Range: "bytes=0-1" } }),
  ]);
  expect(
    responses.filter((response) => [200, 206].includes(response.status())),
  ).toHaveLength(1);
  expect(
    responses.filter((response) => response.status() === 404),
  ).toHaveLength(1);
  expect((await request.get(url)).status()).toBe(404);
});
