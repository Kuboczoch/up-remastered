import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const width of [320, 1366, 1536]) {
  test(`keeps advanced-option text readable during entry at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    // Hold the real entry animation at partial progress: retries must not hide
    // transient contrast failures by checking only the fully opaque end state.
    await page.addStyleTag({
      content: ".options-panel { animation-duration: 60s !important; }",
    });
    await page.getByRole("button", { name: /Advanced options/ }).click();
    const panel = page.locator("#advanced-options");
    await expect(panel).toBeVisible();
    const animationCount = await panel.evaluate((element) => {
      const animations = element.getAnimations();
      for (const animation of animations) {
        animation.pause();
        animation.effect?.updateTiming({ easing: "linear" });
        animation.currentTime = 45_000;
      }
      return animations.length;
    });
    expect(animationCount).toBeGreaterThan(0);
    // axe can settle animations internally. Check the held frame first so
    // fading readable text cannot escape detection when that scan settles it.
    expect(
      await panel.evaluate((element) => getComputedStyle(element).opacity),
    ).toBe("1");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
