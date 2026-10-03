import { expect, test } from "@playwright/test";

test("selected browser expiration is enforced by the server", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Advanced options/ }).click();
  await page.getByLabel("Expires after").selectOption("1");
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
  expect(lifetime).toBeGreaterThan(3_599_000);
  expect(lifetime).toBeLessThan(3_620_000);
});
