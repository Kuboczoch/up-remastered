import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`history defaults off without a flag and restores it without routine feedback at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const openOptions = async () => {
      await page.getByRole("button", { name: /Advanced options/ }).click();
      return page.getByRole("switch", { name: "Save history" });
    };
    let toggle = await openOptions();
    await expect(toggle).not.toBeChecked();
    await expect(toggle).toBeEnabled();
    const setting = page.locator(".switch-setting").filter({ has: toggle });
    await expect(setting).toHaveText("Save history");
    await expect(setting.locator("small")).toHaveCount(0);
    await expect(page.locator("#history-help")).toHaveCount(0);
    await toggle.check();
    await expect(page.locator("body")).not.toContainText("History enabled");
    await expect(page.locator("#advanced-options .history-status")).toHaveCount(
      0,
    );
    const other = await context.newPage();
    await other.goto("/");
    await other.getByRole("button", { name: /Advanced options/ }).click();
    await expect(
      other.getByRole("switch", { name: "Save history" }),
    ).toBeChecked();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("up-remastered:history-enabled"),
      ),
    ).toBe("true");
    await page.reload();
    toggle = await openOptions();
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("up-remastered:history-enabled"),
      ),
    ).toBeNull();
    await expect(page.locator("body")).not.toContainText("History disabled");
    await page.reload();
    toggle = await openOptions();
    await expect(toggle).not.toBeChecked();
    await expect(
      other.getByRole("switch", { name: "Save history" }),
    ).toBeChecked();
  });

  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`native Save history switch animates both ways at ${width}px with ${reducedMotion}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion });
      await page.goto("/");
      await page.getByRole("button", { name: /Advanced options/ }).click();
      const toggle = page.getByRole("switch", { name: "Save history" });
      await expect(toggle).toHaveAttribute("type", "checkbox");
      await expect(toggle).toBeEnabled();
      const styles = await toggle.evaluate((element) => {
        const track = getComputedStyle(element);
        const thumb = getComputedStyle(element, "::after");
        return {
          trackProperty: track.transitionProperty,
          thumbProperty: thumb.transitionProperty,
          trackDuration: parseFloat(track.transitionDuration),
          thumbDuration: parseFloat(thumb.transitionDuration),
        };
      });
      expect(styles.trackProperty).toContain("background-color");
      expect(styles.thumbProperty).toContain("transform");
      if (reducedMotion === "reduce") {
        expect(styles.trackDuration).toBeLessThanOrEqual(0.001);
        expect(styles.thumbDuration).toBeLessThanOrEqual(0.001);
      } else {
        expect(styles.trackDuration).toBeGreaterThan(0.05);
        expect(styles.thumbDuration).toBeGreaterThan(0.05);
        expect(styles.thumbDuration).toBeLessThanOrEqual(0.3);
      }
      for (const enabled of [true, false]) {
        const frames = await toggle.evaluate(async (element) => {
          const input = element as HTMLInputElement;
          const sample = () => ({
            x: new DOMMatrixReadOnly(
              getComputedStyle(input, "::after").transform,
            ).m41,
            background: getComputedStyle(input).backgroundColor,
          });
          const values = [sample()];
          input.click();
          const start = performance.now();
          while (performance.now() - start < 350) {
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            );
            values.push(sample());
          }
          return values;
        });
        const first = frames[0];
        const last = frames.at(-1)!;
        expect(first.x).toBe(enabled ? 0 : 16);
        expect(last.x).toBe(enabled ? 16 : 0);
        expect(last.background).not.toBe(first.background);
        const intermediate = frames
          .slice(1)
          .filter(({ x }) => x > 0.1 && x < 15.9);
        if (reducedMotion === "reduce") expect(intermediate).toHaveLength(0);
        else {
          expect(intermediate.length).toBeGreaterThan(1);
          expect(
            new Set(frames.map(({ background }) => background)).size,
          ).toBeGreaterThan(2);
        }
        if (enabled) await expect(toggle).toBeChecked();
        else await expect(toggle).not.toBeChecked();
      }
      await toggle.focus();
      await page.keyboard.press("Space");
      await expect(toggle).toBeChecked();
    });
  }
}
