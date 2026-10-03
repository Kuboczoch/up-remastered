import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const width of [390, 1366, 1536]) {
  test(`layer geometry and options are stable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/");
    const front = page.locator(".upload-card");
    const baseline = await front.boundingBox();
    await page.getByRole("button", { name: /Advanced options/ }).click();
    expect(await front.boundingBox()).toEqual(baseline);
    await expect(
      page.getByRole("switch", { name: "Save history" }),
    ).not.toBeChecked();
    if (width === 390) {
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.locator(".upload-card")).toHaveJSProperty(
        "inert",
        true,
      );
      await page.getByRole("button", { name: "Done" }).focus();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Close advanced options" }),
      ).toBeFocused();
    }
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: /Advanced options/ }),
    ).toBeFocused();
    await page.getByRole("tab", { name: "File", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "Text", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("tab", { name: "Text", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    expect(await front.boundingBox()).toEqual(baseline);
    await page.getByLabel("Or upload text").fill("long text\n".repeat(200));
    expect(await front.boundingBox()).toEqual(baseline);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("disabled history never persists uploads or removes server data", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Advanced options/ }).click();
  await expect(
    page.getByRole("switch", { name: "Save history" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Close advanced options" }).click();
  await page.locator("#file-picker").setInputFiles({
    buffer: Buffer.from("history"),
    name: "history.txt",
    mimeType: "text/plain",
  });
  await expect(
    page.getByRole("heading", { name: "history.txt" }),
  ).toBeVisible();
  await expect(page.locator(".history-card")).toBeHidden();
  const link = await page.locator("#share-url").inputValue();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("up-remastered:upload-history:v1"),
    ),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("up-remastered:history-consent"),
    ),
  ).toBeNull();
  expect((await request.get(link)).status()).toBe(200);
});

const legacyRecords = Array.from({ length: 6 }, (_, index) => ({
  accessToken: "legacy-token",
  id: `AAA${index}A`,
  originalName: `legacy-${index}.txt`,
  size: 2,
  expiresAt: "2099-01-01T00:00:00Z",
  savedAt: `2026-01-0${index + 1}T00:00:00Z`,
  shareUrl: `http://127.0.0.1:3132/AAA${index}A#key=SECRET`,
}));

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`all Advanced settings are disabled and uniformly dimmed at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/");
    await page.getByRole("tab", { name: "Text", exact: true }).click();
    await page.getByRole("button", { name: /Advanced options/ }).click();
    const panel = page.locator("#advanced-options");
    const settings = panel.locator(".option-setting");
    const controls = panel.locator("input, select");
    await expect(controls).toHaveCount(5);
    for (let index = 1; index < 5; index++) {
      await expect(controls.nth(index)).toBeDisabled();
      await expect(controls.nth(index)).toHaveCSS("opacity", "1");
      await expect(settings.nth(index)).toHaveCSS("opacity", "0.5");
      await controls.nth(index).evaluate((element: HTMLInputElement) => {
        element.click();
        element.focus();
      });
      await expect(controls.nth(index)).not.toBeFocused();
    }
    await expect(
      page.getByRole("switch", { name: "Save history" }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("switch", { name: "Key protect" }),
    ).not.toBeChecked();
    await expect(page.getByLabel("Text encoding")).toHaveValue("utf-8");
    await expect(panel).not.toContainText(/coming later|not available yet/i);
    const close = page.getByRole("button", { name: "Close advanced options" });
    const done = panel.locator(".options-done");
    await expect(close).toBeEnabled();
    await expect(done).toBeEnabled();
    await expect(close).toHaveCSS("opacity", "1");
    await expect(done).toHaveCSS("opacity", "1");
    if (width < 761) {
      await close.focus();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("switch", { name: "Save history" }),
      ).toBeFocused();
      await done.click();
    } else {
      await close.click();
    }
    await expect(panel).toBeHidden();
  });
}

for (const width of [390, 1366]) {
  test(`unconsented legacy history remains untouched at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript((records) => {
      localStorage.setItem("up-remastered:history-consent", "false");
      localStorage.setItem(
        "up-remastered:upload-history:v1",
        JSON.stringify(records),
      );
      sessionStorage.setItem(
        "up-remastered:upload-history:v1",
        JSON.stringify(records),
      );
    }, legacyRecords);
    await page.goto("/");
    await page.getByRole("button", { name: /Advanced options/ }).click();
    await expect(
      page.getByRole("switch", { name: "Save history" }),
    ).not.toBeChecked();
    await expect(page.locator(".history-card")).toBeHidden();
    await page.evaluate(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "up-remastered:history-consent",
          newValue: "false",
        }),
      ),
    );
    await expect(
      page.getByRole("switch", { name: "Save history" }),
    ).not.toBeChecked();
    await page.getByRole("button", { name: "Close advanced options" }).click();
    await page.locator("#file-picker").setInputFiles({
      buffer: Buffer.from("unchanged"),
      name: "unchanged.txt",
      mimeType: "text/plain",
    });
    await expect(
      page.getByRole("heading", { name: "unchanged.txt" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("up-remastered:upload-history:v1"),
      ),
    ).toBe(JSON.stringify(legacyRecords));
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("up-remastered:upload-history:v1"),
      ),
    ).toBe(JSON.stringify(legacyRecords));
    expect(
      await page.evaluate(() =>
        localStorage.getItem("up-remastered:history-consent"),
      ),
    ).toBe("false");
    await expect(page.locator(".history-card")).toBeHidden();
  });
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`front and rear preserve document geometry, scroll, drafts and inactive panels at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 650 });
    await page.goto("/");
    await page.getByRole("tab", { name: "Text", exact: true }).click();
    await page.getByLabel("Or upload text").fill("preserved text draft");
    await expect(page.locator("#file-upload-panel")).toHaveJSProperty(
      "inert",
      true,
    );
    await expect(
      page.getByRole("tabpanel", { name: "File", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "File", exact: true }).click();
    await expect(page.locator("#text-upload-panel")).toHaveJSProperty(
      "inert",
      true,
    );
    await expect(
      page.getByRole("tabpanel", { name: "Text", exact: true }),
    ).toHaveCount(0);
    const geometry = () =>
      page.evaluate(() => ({
        height: document.documentElement.scrollHeight,
        width: document.documentElement.scrollWidth,
        y: scrollY,
        front: document
          .querySelector(".upload-card")!
          .getBoundingClientRect()
          .toJSON(),
        footer: document
          .querySelector(".site-footer")!
          .getBoundingClientRect()
          .toJSON(),
      }));
    await page
      .getByRole("button", { name: /Advanced options/ })
      .scrollIntoViewIfNeeded();
    const before = await geometry();
    await page.getByRole("button", { name: /Advanced options/ }).click();
    await expect(page.locator("#advanced-options")).toBeVisible();
    await page.waitForTimeout(350); // Exercise completed CSS transition, not only initial state.
    const after = await geometry();
    expect(after.width).toBeLessThanOrEqual(width);
    expect(after.height).toBe(before.height);
    expect(after.y).toBe(before.y);
    expect(after.front).toEqual(before.front);
    expect(after.footer).toEqual(before.footer);
    await expect(page.getByLabel(/Expires after/)).toBeDisabled();
    await expect(
      page.getByRole("switch", { name: "Key protect" }),
    ).toBeDisabled();
    await expect(page.getByRole("slider")).toBeDisabled();
    await expect(
      page.getByRole("switch", { name: "Save history" }),
    ).toBeEnabled();
    await page
      .getByRole("button", {
        name: width < 761 ? "Done" : "Close advanced options",
        exact: true,
      })
      .click();
    await expect(page.locator("#advanced-options")).toBeHidden();
    await page.getByRole("tab", { name: "Text", exact: true }).click();
    await expect(page.getByLabel("Or upload text")).toHaveValue(
      "preserved text draft",
    );
    await page.getByRole("button", { name: /Advanced options/ }).click();
    await expect(page.getByLabel(/Expires after/)).toHaveValue("24");
    await expect(
      page.getByRole("switch", { name: "Key protect" }),
    ).not.toBeChecked();
    await expect(page.getByRole("slider")).toHaveValue("11");
    const expanded = await geometry();
    expect(expanded.height).toBe(before.height);
    expect(expanded.width).toBeLessThanOrEqual(width);
    if (width < 761) {
      await page
        .getByRole("button", { name: /Close advanced options/ })
        .focus();
      await page.keyboard.press("Shift+Tab");
      await expect(
        page.getByRole("button", { name: "Done", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest('[role="dialog"]'),
        ),
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(page.locator("#advanced-options")).toBeHidden();
      await expect(
        page.getByRole("button", { name: /Advanced options/ }),
      ).toBeFocused();
      await page.getByRole("button", { name: /Advanced options/ }).click();
      await page
        .getByRole("button", { name: "Dismiss advanced options" })
        .click({ position: { x: 5, y: 5 } });
      await expect(page.locator("#advanced-options")).toBeHidden();
      await page.getByRole("button", { name: /Advanced options/ }).click();
      await page
        .getByRole("button", { name: /Close advanced options/ })
        .click();
      await expect(page.locator("#advanced-options")).toBeHidden();
    }
  });
}
