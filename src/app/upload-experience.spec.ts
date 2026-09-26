import { expect, test } from "@playwright/test";

test("uploads a picked file and exposes result actions", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  await page.locator("#file-picker").setInputFiles({
    buffer: Buffer.from("picked"),
    mimeType: "text/plain",
    name: "picked.txt",
  });

  await expect(page.getByRole("heading", { name: "picked.txt" })).toBeVisible();
  const shareUrl = await page.locator(".result-url").inputValue();
  expect(shareUrl).toMatch(/^http:\/\/127\.0\.0\.1:3000\/[0-9A-Z]{5}$/);
  await expect(page.getByTestId("qr-code").locator("svg")).toBeVisible();
  await expect(page.getByText(/remaining/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open file" })).toHaveAttribute(
    "href",
    shareUrl,
  );

  await page.getByRole("button", { name: "Copy URL" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    shareUrl,
  );

  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.locator(".result-url").dblclick();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    shareUrl,
  );

  await page.getByRole("button", { name: "Upload another" }).click();
  await expect(
    page.getByRole("heading", { name: "Upload a file" }),
  ).toBeVisible();
});

test("uploads pasted text and clipboard files", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Maximum 64 B")).toBeVisible();

  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "pasted text");
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: data });
    document.querySelector(".upload-workspace")?.dispatchEvent(event);
  });
  await expect(
    page.getByRole("heading", { name: "pasted-text.txt" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Upload another" }).click();
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(
      new File(["clipboard"], "clipboard.txt", { type: "text/plain" }),
    );
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: data });
    document.querySelector(".upload-workspace")?.dispatchEvent(event);
  });
  await expect(
    page.getByRole("heading", { name: "clipboard.txt" }),
  ).toBeVisible();
});

test("rejects ambiguous drops and oversized files before upload", async ({
  page,
}) => {
  await page.goto("/");

  await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(new File(["one"], "one.txt"));
    data.items.add(new File(["two"], "two.txt"));
    const target = document.querySelector(".drop-zone");
    target?.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: data,
      }),
    );
  });
  await expect(
    page.getByRole("heading", { name: "Something went wrong" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Drop exactly one file. Folders and multiple files are not supported.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Try again" }).click();
  await page.locator("#file-picker").setInputFiles({
    buffer: Buffer.alloc(65, "x"),
    mimeType: "text/plain",
    name: "too-large.txt",
  });
  await expect(page.getByText(/Maximum size is 64 B/)).toBeVisible();
});

test("shows upload percentage in the title and supports mobile text upload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/upload", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({
        accessToken: "token",
        key: "A1B2C",
        toDelete: "2099-01-01T00:00:00.000Z",
        upload: {
          accessToken: "token",
          expiresAt: "2099-01-01T00:00:00.000Z",
          id: "A1B2C",
          originalName: "pasted-text.txt",
          shareUrl: "http://127.0.0.1:3000/A1B2C",
          size: 11,
        },
      }),
    });
  });
  await page.goto("/");

  await expect(page.getByLabel("Or upload text")).toBeVisible();
  await page.getByLabel("Or upload text").fill("mobile text");
  await page.getByRole("button", { name: "Upload text" }).click();
  await expect(page).toHaveTitle(/\d+% · up/);
  await expect(
    page.getByRole("heading", { name: "pasted-text.txt" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("up - remastered");
});
