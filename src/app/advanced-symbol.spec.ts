import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`Advanced symbol preserves trigger and request-link geometry at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/");
    const trigger = page.getByRole("button", { name: /Advanced options/ });
    const request = page.locator(".upload-rail a");
    const measure = async () => {
      const scroll = await page.evaluate(() => ({
        x: window.scrollX,
        y: window.scrollY,
      }));
      const documentBox = async (locator: typeof trigger) => {
        const box = await locator.boundingBox();
        return box
          ? { ...box, x: box.x + scroll.x, y: box.y + scroll.y }
          : null;
      };
      return {
        trigger: await documentBox(trigger),
        request: await documentBox(request),
        symbol: await documentBox(trigger.locator("span")),
      };
    };
    const closed = await measure();
    await trigger.click();
    const open = await measure();
    for (const element of ["trigger", "request", "symbol"] as const) {
      expect(open[element]).not.toBeNull();
      expect(closed[element]).not.toBeNull();
      for (const dimension of ["x", "y", "width", "height"] as const) {
        expect(open[element]![dimension]).toBeCloseTo(
          closed[element]![dimension],
          1,
        );
      }
    }
    await page.getByRole("button", { name: "Close advanced options" }).click();
    const reclosed = await measure();
    expect(reclosed).toEqual(closed);
  });
}
