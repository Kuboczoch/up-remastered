import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

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

test("real protected upload roundtrip, fragment privacy, consent and one-download limit", async ({
  page,
  context,
  request,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const http: string[] = [];
  const bodies: string[] = [];
  page.on("request", (req) => {
    http.push(req.url());
    if (req.postData()) bodies.push(req.postData()!);
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Advanced options/ }).click();
  await page.getByRole("switch", { name: "Save history" }).check();
  await page.getByRole("switch", { name: "Key protect" }).check();
  await page.getByLabel("Expires after").selectOption("1");
  await page.locator("#download-limit").fill("1");
  await page.getByRole("button", { name: "Close advanced options" }).click();
  await page.locator("#file-picker").setInputFiles({
    buffer: Buffer.from("private original"),
    name: "private-original.txt",
    mimeType: "text/plain",
  });
  await expect(
    page.getByRole("heading", { name: "private-original.txt" }).first(),
  ).toBeVisible();
  const link = await page.locator("#share-url").inputValue();
  const url = new URL(link);
  expect(url.pathname).toMatch(/^\/decrypt\/[A-Za-z0-9]+$/);
  expect(url.hash).toMatch(/^#key=[A-Za-z0-9_-]{43}$/);
  const key = url.hash.slice(5);
  expect(http.join(" ")).not.toContain(key);
  expect(bodies.join(" ")).not.toContain(key);
  expect(bodies.join(" ")).not.toContain("private original");
  expect(bodies.join(" ")).not.toContain("private-original.txt");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    key,
  );
  await expect(page.getByText("Key not saved")).toBeVisible();
  const rawPath = url.pathname.replace("/decrypt", "");
  const head = await request.head(rawPath);
  expect(head.status()).toBe(200);
  await page.goto(link);
  await page.getByLabel("Decryption key").fill("A".repeat(43));
  await page.getByRole("button", { name: "Decrypt file" }).click();
  await expect(page.locator(".decrypt-experience [role=alert]")).toContainText(
    /key|damaged|authentication/i,
  );
  await expect(
    page.getByRole("link", { name: "Save decrypted file" }),
  ).toBeHidden();
  await page.getByLabel("Decryption key").fill(key);
  await expect(
    page.getByRole("button", { name: "Decrypt file" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Decrypt file" }).click();
  await expect(
    page.getByRole("link", { name: "Save decrypted file" }),
  ).toBeVisible();
  const waiting = page.waitForEvent("download");
  await page.getByRole("link", { name: "Save decrypted file" }).click();
  const downloaded = await waiting;
  expect(downloaded.suggestedFilename()).toBe("private-original.txt");
  expect(await readFile((await downloaded.path())!, "utf8")).toBe(
    "private original",
  );
  const exhausted = await request.get(rawPath);
  expect(exhausted.status()).toBe(404);
  expect(http.join(" ")).not.toContain(key);
  await page.goto(url.origin + url.pathname);
  await expect(page.getByText(/Missing or invalid key/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Decrypt file" }),
  ).toBeDisabled();
});

test("default history opt-out and clearing never removes server data", async ({
  page,
  request,
}) => {
  await page.goto("/");
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
  await page.getByRole("button", { name: "Upload another file" }).click();
  await page.getByRole("button", { name: /Advanced options/ }).click();
  await page.getByRole("switch", { name: "Save history" }).check();
  await page.getByRole("button", { name: "Close advanced options" }).click();
  await page.locator("#file-picker").setInputFiles({
    buffer: Buffer.from("saved"),
    name: "saved.txt",
    mimeType: "text/plain",
  });
  await expect(
    page.getByRole("button", { name: "Clear history" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear history" }).click();
  await expect(page.locator(".history-card")).toBeHidden();
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

test("legacy session consent and dynamically mounted mobile history isolation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 960 });
  await page.addInitScript((records) => {
    sessionStorage.setItem(
      "up-remastered:upload-history:v1",
      JSON.stringify(records),
    );
  }, legacyRecords);
  await page.goto("/");
  await expect(page.locator(".upload-card")).toBeVisible();
  await page.getByRole("button", { name: /Advanced options/ }).click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("up-remastered:upload-history:v1"),
    ),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("up-remastered:upload-history:v1"),
    ),
  ).not.toContain("SECRET");
  await page.getByRole("switch", { name: "Save history" }).check();
  await expect(page.locator(".history-card")).toBeVisible();
  expect(
    await page
      .locator(".history-card")
      .evaluate((element) => !!element.closest("[inert]")),
  ).toBe(true);
  await page
    .locator(".clear-history")
    .evaluate((element: HTMLButtonElement) => element.focus());
  await expect(page.locator(".clear-history")).not.toBeFocused();
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`lower-row history actions remain reachable without clipping at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(
      (records) => {
        localStorage.setItem("up-remastered:history-consent", "true");
        localStorage.setItem(
          "up-remastered:upload-history:v1",
          JSON.stringify(records),
        );
      },
      legacyRecords.map((record) => ({
        ...record,
        shareUrl: record.shareUrl.split("#")[0],
      })),
    );
    await page.goto("/");
    const action = page.getByLabel("More actions for legacy-0.txt");
    await action.click();
    const remove = page.getByRole("button", {
      name: "Remove legacy-0.txt from history",
      exact: true,
    });
    const deleteAction = page.getByRole("button", {
      name: "Delete legacy-0.txt",
      exact: true,
    });
    expect(
      await deleteAction.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return element.contains(
          document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          ),
        );
      }),
    ).toBe(true);
    expect(
      await remove.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.left >= 0 &&
          rect.top >= 0 &&
          rect.right <= innerWidth &&
          rect.bottom <= innerHeight &&
          element.contains(
            document.elementFromPoint(
              rect.left + rect.width / 2,
              rect.top + rect.height / 2,
            ),
          )
        );
      }),
    ).toBe(true);
    await remove.click();
    await expect(page.getByLabel("More actions for legacy-0.txt")).toHaveCount(
      0,
    );
  });
}

test("history mounted after mobile dialog opens is inert", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 960 });
  await page.addInitScript(
    (records) =>
      localStorage.setItem(
        "up-remastered:upload-history:v1",
        JSON.stringify(records),
      ),
    legacyRecords,
  );
  await page.goto("/");
  await page.getByRole("button", { name: /Advanced options/ }).click();
  await page.getByRole("switch", { name: "Save history" }).check();
  await expect(page.locator(".history-card")).toBeVisible();
  expect(
    await page
      .locator(".history-card")
      .evaluate((element) => !!element.closest("[inert]")),
  ).toBe(true);
});

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
    await page.getByLabel(/Expires after/).selectOption("6");
    await page.getByRole("switch", { name: "Key protect" }).check();
    await page.getByRole("slider").focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
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
    await expect(page.getByLabel(/Expires after/)).toHaveValue("6");
    await expect(
      page.getByRole("switch", { name: "Key protect" }),
    ).toBeChecked();
    await expect(page.getByRole("slider")).toHaveValue("2");
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
