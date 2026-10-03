import { expect, test, type Page } from "@playwright/test";

const geometry = (page: Page) =>
  page.evaluate(() => ({
    document: [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ],
    scroll: [scrollX, scrollY],
    boxes: [
      ".upload-stage",
      ".upload-card",
      ".state-card",
      ".upload-back",
      ".site-footer",
    ].map(
      (selector) =>
        document.querySelector(selector)?.getBoundingClientRect().toJSON() ??
        null,
    ),
  }));
const finishEntrance = (page: Page) =>
  page
    .locator("#advanced-options")
    .evaluate((element) =>
      element.getAnimations().forEach((animation) => animation.finish()),
    );

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`Advanced allocated structure and disclosure geometry at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 650 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const panel = page.locator("#advanced-options");
    const trigger = page.getByRole("button", { name: /Advanced options/ });
    await trigger.scrollIntoViewIfNeeded();
    const baseline = await geometry(page);
    await trigger.click();
    await finishEntrance(page);
    const file = await panel.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      scroll: element.scrollHeight,
      rows: [...element.querySelectorAll(".option-setting")].map(
        (row) => (row as HTMLElement).offsetTop,
      ),
    }));
    expect(await geometry(page)).toEqual(baseline);
    await page.screenshot({
      path: info.outputPath("file-open.png"),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await page.getByRole("tab", { name: "Text", exact: true }).click();
    expect(await geometry(page)).toEqual(baseline);
    await trigger.click();
    await finishEntrance(page);
    const text = await panel.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      scroll: element.scrollHeight,
      rows: [...element.querySelectorAll(".option-setting")].map(
        (row) => (row as HTMLElement).offsetTop,
      ),
    }));
    await page.screenshot({
      path: info.outputPath("text-open.png"),
      fullPage: true,
    });
    expect(text).toEqual(file);
    expect(await geometry(page)).toEqual(baseline);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    expect(await geometry(page)).toEqual(baseline);
  });

  test(`Advanced has a visible inert exit frame and safe rapid reopen at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 650 });
    await page.goto("/");
    const trigger = page.getByRole("button", { name: /Advanced options/ });
    await trigger.scrollIntoViewIfNeeded();
    const baseline = await geometry(page);
    await trigger.click();
    await finishEntrance(page);
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page
      .locator(".options-heading button")
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.locator("#advanced-options")).toHaveAttribute(
      "data-state",
      "closing",
    );
    const frame = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>("#advanced-options")!;
      const animation = panel.getAnimations()[0];
      animation?.pause();
      if (animation) animation.currentTime = 90;
      const scrim = document.querySelector<HTMLElement>(".options-scrim");
      scrim?.getAnimations().forEach((a) => {
        a.pause();
        a.currentTime = 90;
      });
      const style = getComputedStyle(panel);
      const rect = panel.getBoundingClientRect();
      return {
        hidden: panel.hidden,
        inert: panel.inert,
        opacity: Number(style.opacity),
        transform: style.transform,
        animation: !!animation,
        intercepts: panel.contains(
          document.elementFromPoint(
            rect.x + rect.width / 2,
            Math.min(innerHeight - 1, rect.y + 20),
          ),
        ),
        scrim: scrim
          ? {
              opacity: Number(getComputedStyle(scrim).opacity),
              pointer: getComputedStyle(scrim).pointerEvents,
            }
          : null,
      };
    });
    expect(frame.hidden).toBe(false);
    expect(frame.animation).toBe(true);
    expect(frame.inert).toBe(true);
    expect(frame.opacity).toBeGreaterThan(0);
    expect(frame.opacity).toBeLessThan(1);
    expect(frame.transform).not.toBe("none");
    expect(frame.intercepts).toBe(false);
    if (width < 761) {
      expect(frame.scrim?.opacity).toBeGreaterThan(0);
      expect(frame.scrim?.opacity).toBeLessThan(1);
      expect(frame.scrim?.pointer).toBe("none");
      await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
    }
    expect(await geometry(page)).toEqual(baseline);
    await page.screenshot({
      path: info.outputPath("exit-midpoint.png"),
      fullPage: true,
    });
    await expect(trigger).toBeFocused();
    // React must cancel the old close deadline rather than hide a reopened panel.
    await trigger.evaluate((button: HTMLButtonElement) => button.click());
    await page.clock.runFor(250);
    await expect(page.locator("#advanced-options")).toBeVisible();
    await expect(page.locator("#advanced-options")).toHaveJSProperty(
      "inert",
      false,
    );
    await page.keyboard.press("Escape");
    await page.clock.runFor(180);
    await expect(page.locator("#advanced-options")).toBeHidden();
  });
}

for (const width of [320, 390, 768, 1024, 1440]) {
  for (const mode of ["File", "Text"] as const) {
    test(`Advanced geometry through ${mode} uploading/success/reset at ${width}px`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 960 });
      let release!: () => void;
      const response = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/api/upload", async (route) => {
        await response;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            accessToken: "test-token",
            upload: {
              id: "A1B2C",
              originalName: "advanced.txt",
              size: 4,
              expiresAt: "2099-01-01T00:00:00Z",
              shareUrl: "http://127.0.0.1:3132/A1B2C",
            },
          }),
        });
      });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole("tab", { name: mode, exact: true }).click();
      if (mode === "Text") await page.getByLabel("Or upload text").fill("test");
      const trigger = page.getByRole("button", { name: /Advanced options/ });
      const panel = page.locator("#advanced-options");
      // Start from an open disclosure, including programmatic file selection while the mobile modal isolates its background.
      await trigger.click();
      await finishEntrance(page);
      if (mode === "File")
        await page.locator('input[type="file"]').setInputFiles({
          name: "advanced.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("test"),
        });
      else
        await page
          .getByRole("button", { name: "Upload text", includeHidden: true })
          .evaluate((button: HTMLButtonElement) => button.click());
      await expect(
        page.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeVisible();
      await expect(panel).toBeHidden();
      for (const phase of ["uploading", "success", "reset"] as const) {
        if (phase === "success") {
          release();
          await expect(
            page.getByRole("button", { name: "Upload another file" }),
          ).toBeVisible();
        }
        if (phase === "reset")
          await page
            .getByRole("button", { name: "Upload another file" })
            .click();
        await trigger.scrollIntoViewIfNeeded();
        // Settle the existing upload-state entrance, not the disclosure animation under test.
        await page
          .locator(".upload-card")
          .evaluate((element) =>
            element.getAnimations().forEach((animation) => animation.finish()),
          );
        const baseline = await geometry(page);
        await trigger.click();
        await finishEntrance(page);
        expect(await geometry(page)).toEqual(baseline);
        await page.screenshot({
          path: info.outputPath(`${phase}-open.png`),
          fullPage: true,
        });
        await page.keyboard.press("Escape");
        await expect(panel).toBeHidden();
        expect(await geometry(page)).toEqual(baseline);
      }
    });
  }
}

for (const path of ["Done", "scrim", "Escape"] as const) {
  test(`mobile ${path} closes sheet and scrim without leaked focus or isolation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 650 });
    await page.goto("/");
    const trigger = page.getByRole("button", { name: /Advanced options/ });
    await trigger.click();
    await finishEntrance(page);
    if (path === "Escape") await page.keyboard.press("Escape");
    else
      await page
        .locator(path === "scrim" ? ".options-scrim" : ".options-done")
        .evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.locator("#advanced-options")).toBeHidden();
    await expect(page.locator(".options-scrim")).toHaveCount(0);
    await expect(page.locator(".upload-back")).toHaveJSProperty("inert", false);
    await expect(trigger).toBeFocused();
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });
}

test("reduced motion closes immediately with no lingering overlay", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 650 });
  await page.goto("/");
  await page.getByRole("button", { name: /Advanced options/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#advanced-options")).toBeHidden();
  await expect(page.locator(".options-scrim")).toHaveCount(0);
});
