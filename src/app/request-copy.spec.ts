import { chromium, expect, test } from "@playwright/test";

test("an actual insecure HTTP origin offers complete manual owner-fragment copy", async ({
  request,
}) => {
  const created = await request.post("/api/upload-requests", {
    data: {
      maxBytes: 4096,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
  });
  expect(created.status()).toBe(201);
  const owner = await created.json();
  const ownerUrl = new URL(owner.managementUrl);
  ownerUrl.hostname = "request-copy.test";
  const browser = await chromium.launch({
    args: [
      "--host-resolver-rules=MAP request-copy.test 127.0.0.1",
      "--no-proxy-server",
    ],
  });
  try {
    const page = await browser.newPage();
    const urls: string[] = [];
    page.on("request", (event) => urls.push(event.url()));
    await page.goto(ownerUrl.href);
    expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
    expect(await page.evaluate(() => typeof navigator.clipboard)).toBe(
      "undefined",
    );
    await expect(
      page.getByRole("button", { name: "Copy owner link" }),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/#/);
    await page.getByRole("button", { name: "Copy owner link" }).click();
    await expect(page.getByLabel("Link to copy manually")).toHaveValue(
      ownerUrl.href,
    );
    await expect(page.getByText("Link copied.")).toHaveCount(0);
    expect(urls.some((url) => url.includes(owner.managementToken))).toBe(false);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Copy owner link" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Copy owner link" }).click();
    await expect(page.getByLabel("Link to copy manually")).toHaveValue(
      ownerUrl.href,
    );
  } finally {
    await browser.close();
  }
});
