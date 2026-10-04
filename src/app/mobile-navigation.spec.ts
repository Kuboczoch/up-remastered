import { expect, test, type Locator } from "@playwright/test";

async function expectTouchTarget(target: Locator) {
  await expect(target).toBeVisible();
  await target.scrollIntoViewIfNeeded();
  const geometry = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    // Insets exercise the padded edges rather than just the text at the center.
    const points = [
      [rect.left + 2, rect.top + 2],
      [rect.right - 2, rect.bottom - 2],
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
    ];
    return {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      viewport: document.documentElement.clientWidth,
      receivesPointer: points.every(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return hit === element || (hit !== null && element.contains(hit));
      }),
    };
  });
  expect(geometry.width).toBeGreaterThanOrEqual(44);
  expect(geometry.height).toBeGreaterThanOrEqual(44);
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.receivesPointer).toBe(true);
}

async function expectSeparateTargets(targets: Locator) {
  const boxes = await targets.evaluateAll((elements) =>
    elements.map((element) => {
      const { left, right, top, bottom } = element.getBoundingClientRect();
      return { left, right, top, bottom };
    }),
  );
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      expect(
        a.right <= b.left ||
          b.right <= a.left ||
          a.bottom <= b.top ||
          b.bottom <= a.top,
      ).toBe(true);
    }
  }
}

for (const width of [320, 390]) {
  for (const path of ["/", "/request/new"]) {
    test(`${path} secondary navigation has real, separate mobile hit boxes at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path);
      const footer = page.getByRole("contentinfo");
      const footerLinks = footer.getByRole("link");
      await expect(footerLinks).toHaveCount(4);
      for (const link of await footerLinks.all()) {
        await expectTouchTarget(link);
        await link.focus();
        await expect(link).toBeFocused();
        await expect(link).toHaveCSS("outline-style", "solid");
        await expect(link).toHaveCSS("font-size", "11px");
      }
      await expectSeparateTargets(footerLinks);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);

      if (path === "/") {
        const request = page.getByRole("link", { name: "Request a file ↗" });
        await expectTouchTarget(request);
        await expect(request).toHaveCSS("font-size", "11px");
        await expectSeparateTargets(
          page.locator(".upload-rail a, .upload-rail button"),
        );
        // Keep the approved selector as a compact, unchanged heading control.
        await expect(
          page.getByRole("tab", { name: "File", exact: true }),
        ).toHaveCSS("min-height", "40px");
        await request.click();
        await expect(page).toHaveURL(/\/request\/new$/);
      } else {
        const back = page.getByRole("link", { name: "Back to uploads" });
        const home = page.getByRole("link", { name: "Up - Remastered home" });
        await expectTouchTarget(back);
        await expectTouchTarget(home);
        await expectTouchTarget(page.locator(".site-header > .outline-button"));
        await expectSeparateTargets(page.locator(".site-header a"));
        const submit = page.getByRole("button", {
          name: "Create upload request",
        });
        await expect(submit).toBeEnabled();
        await expectTouchTarget(submit);
        await back.click();
        await expect(page).toHaveURL(/\/$/);
        await page.goto(path);
        await home.click();
        await expect(page).toHaveURL(/\/$/);
      }
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
    });
  }
}
