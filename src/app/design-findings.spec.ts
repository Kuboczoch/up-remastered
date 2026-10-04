import { expect, test } from "@playwright/test";

for (const width of [320, 1440]) {
  test(`file picker projects keyboard focus onto its visible label at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/");
    await page.getByRole("tab", { name: "File", exact: true }).focus();
    for (let step = 0; step < 8; step++) {
      await page.keyboard.press("Tab");
      if (
        await page
          .locator("#file-picker")
          .evaluate((element) => element === document.activeElement)
      )
        break;
    }
    await expect(page.locator("#file-picker")).toBeFocused();
    await expect(page.locator('label[for="file-picker"]')).toHaveCSS(
      "outline-style",
      "solid",
    );
    await expect(page.locator('label[for="file-picker"]')).toHaveCSS(
      "outline-width",
      "2px",
    );
    await page.screenshot({
      path: testInfo.outputPath(`ui-${width}-file-focus.png`),
      fullPage: true,
    });
  });

  test(`QR dialog contains focus, dismisses and restores its trigger at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/");
    await page.locator("#file-picker").setInputFiles({
      buffer: Buffer.from("QR focus test"),
      name: "qr.txt",
      mimeType: "text/plain",
    });
    const trigger = page.getByRole("button", { name: "Show QR code" });
    await trigger.click();
    const close = page.getByRole("button", { name: "Close QR code" });
    await expect(close).toBeFocused();
    const downloadQr = page.getByRole("link", { name: "Download QR code" });
    await expect(downloadQr).toBeVisible();
    await page.keyboard.press("Shift+Tab");
    await expect(downloadQr).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(downloadQr).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.screenshot({
      path: testInfo.outputPath(`ui-${width}-qr.png`),
      fullPage: true,
    });
    // A true modal prevents even programmatic focus moving to its background.
    await page
      .getByRole("button", { name: "Upload another file", includeHidden: true })
      .evaluate((element: HTMLElement) => element.focus());
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await close.click();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.locator(".qr-dialog").click({ position: { x: 2, y: 2 } });
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test(`deferred controls are disabled and uploads retain the existing contract at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/");
    await page.getByRole("button", { name: /Advanced options/ }).click();
    await expect(page.getByLabel(/Expires after/)).toBeEnabled();
    await expect(page.getByRole("slider")).toBeDisabled();
    await expect(
      page.getByRole("switch", { name: "Key protect" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("switch", { name: "Key protect" }),
    ).not.toBeChecked();
    await expect(page.locator("#advanced-options")).not.toContainText(
      /coming later|not available yet/i,
    );
    await page.locator("#advanced-options").evaluate(async (element) => {
      await Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      );
    });
    await page.screenshot({
      path: testInfo.outputPath(`ui-${width}-options.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", {
        name: width < 761 ? "Done" : "Close advanced options",
        exact: true,
      })
      .click();
    await page.evaluate(() => {
      const originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function (body) {
        if (body instanceof FormData) {
          (window as Window & { __uploadForm?: FormData }).__uploadForm = body;
        }
        return originalSend.call(this, body);
      };
    });
    const pending = page.waitForRequest(
      (request) =>
        request.url().endsWith("/api/upload") && request.method() === "POST",
    );
    await page.locator("#file-picker").setInputFiles({
      buffer: Buffer.from("Plaintext UI fixture"),
      name: "ui-plain.txt",
      mimeType: "text/plain",
    });
    await pending;
    const submitted = await page.evaluate(async () => {
      const form = (window as Window & { __uploadForm?: FormData })
        .__uploadForm!;
      const file = form.get("file") as File;
      return {
        fields: [...form.keys()],
        name: file.name,
        bytes: await file.text(),
      };
    });
    expect(submitted).toEqual({
      fields: ["file", "expiresInHours"],
      name: "ui-plain.txt",
      bytes: "Plaintext UI fixture",
    });
    await expect(page.locator("#share-url")).toBeVisible();
    const share = new URL(await page.locator("#share-url").inputValue());
    expect(share.pathname).toMatch(/^\/[A-Za-z0-9]{5}$/);
    expect(share.hash).toBe("");
    expect(share.search).toBe("");
    await page.screenshot({
      path: testInfo.outputPath(`ui-${width}-success.png`),
      fullPage: true,
    });
  });
}
