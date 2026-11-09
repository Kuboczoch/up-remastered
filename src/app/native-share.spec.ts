import { expect, test } from "@playwright/test";

for (const width of [320, 360, 390, 430]) {
  test(`native sharing preserves selected URLs and Copy fallback at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: (payload: ShareData) => {
          const state = window as unknown as {
            shares: ShareData[];
            shareMode?: string;
          };
          (state.shares ??= []).push(payload);
          if (state.shareMode === "cancel")
            return Promise.reject(new DOMException("cancelled", "AbortError"));
          if (state.shareMode === "fail")
            return Promise.reject(new Error("private-owner-secret"));
          return Promise.resolve();
        },
      });
      localStorage.setItem("up-remastered:history-enabled", "true");
    });
    await page.goto("/");
    await page.getByLabel("Choose file", { exact: true }).setInputFiles({
      name: "share-first.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("first"),
    });
    const firstUrl = await page
      .getByLabel("Share URL", { exact: true })
      .inputValue();
    const success = page.getByRole("group", { name: "Uploaded file actions" });
    const share = success.getByRole("button", { name: "Share", exact: true });
    await share.focus();
    await page.keyboard.press("Enter");
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { shares: ShareData[] }).shares,
        ),
      )
      .toEqual([
        {
          title: "Shared file",
          text: "Download this file using the link.",
          url: firstUrl,
        },
      ]);
    const box = await share.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.evaluate(() => {
      (window as unknown as { shareMode: string }).shareMode = "cancel";
    });
    await share.click();
    await expect(
      page.getByText("Sharing did not complete.", { exact: false }),
    ).toHaveCount(0);
    await page.evaluate(() => {
      (window as unknown as { shareMode: string }).shareMode = "fail";
    });
    await share.click();
    await expect(
      page.getByRole("status").filter({ hasText: "Sharing did not complete" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Copy URL", exact: true }),
    ).toBeEnabled();
    await expect(page.locator("body")).not.toContainText(
      "private-owner-secret",
    );
    await page.getByRole("button", { name: "Upload another file" }).click();
    await page.getByLabel("Choose file", { exact: true }).setInputFiles({
      name: "share-second.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("second"),
    });
    const secondUrl = await page
      .getByLabel("Share URL", { exact: true })
      .inputValue();
    expect(secondUrl).not.toBe(firstUrl);
    await page.evaluate(() => {
      (window as unknown as { shareMode: string }).shareMode = "ok";
    });
    await page
      .getByRole("button", { name: "More actions for share-first.txt" })
      .click();
    const menu = page.locator(".history-menu:popover-open");
    await menu.getByRole("button", { name: "Share", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { shares: ShareData[] }).shares.at(-1)?.url,
        ),
      )
      .toBe(firstUrl);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.reload();
    await page.evaluate(() => {
      Reflect.deleteProperty(navigator, "share");
    });
    await page.reload();
    // Separate unsupported page removes the shim before hydration.
    await page.addInitScript(() => {
      Reflect.deleteProperty(navigator, "share");
    });
    await page.reload();
    await page
      .getByRole("button", { name: "More actions for share-first.txt" })
      .click();
    await expect(
      page
        .locator(".history-menu:popover-open")
        .getByRole("button", { name: "Share", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Copy link", exact: true }).first(),
    ).toBeEnabled();
  });
}
