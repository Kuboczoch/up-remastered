import { expect, test, type Page } from "@playwright/test";

const preferenceKey = "up-remastered:history-enabled";
const historyKey = "up-remastered:upload-history:v1";
const records = [
  {
    accessToken: "history-token",
    id: "AAA1A",
    originalName: "saved.txt",
    size: 2,
    expiresAt: "2099-01-01T00:00:00Z",
    savedAt: "2026-01-01T00:00:00Z",
    shareUrl: "http://127.0.0.1:3000/AAA1A#key=SECRET",
    encryptionKey: "SECRET",
  },
];

async function seedAndTrace(page: Page, local = JSON.stringify(records)) {
  await page.addInitScript(
    ({ key, local, records }) => {
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      set.call(localStorage, key, local);
      set.call(sessionStorage, key, JSON.stringify(records));
      set.call(localStorage, "up-remastered:history-consent", "true");
      const calls: string[] = [];
      Object.assign(window, {
        historyCalls: calls,
        historySnapshot: () => ({
          local: get.call(localStorage, key),
          session: get.call(sessionStorage, key),
          consent: get.call(localStorage, "up-remastered:history-consent"),
        }),
      });
      for (const method of ["getItem", "setItem", "removeItem"] as const) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (...args: [string, string?]) {
          if (args[0].startsWith("up-remastered:"))
            calls.push(
              `${this === localStorage ? "local" : "session"}:${method}:${args[0]}`,
            );
          return Reflect.apply(original, this, args);
        };
      }
    },
    { key: historyKey, local, records },
  );
}
const calls = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { historyCalls: string[] }).historyCalls,
  );
const snapshot = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as {
        historySnapshot: () => {
          local: string | null;
          session: string | null;
          consent: string | null;
        };
      }
    ).historySnapshot(),
  );
async function options(page: Page, enabled: boolean) {
  await page.getByRole("button", { name: /Advanced options/ }).click();
  await page.getByRole("switch", { name: "Save history" }).setChecked(enabled);
  await page.getByRole("button", { name: "Close advanced options" }).click();
}
async function upload(page: Page) {
  await page.locator("#file-picker").setInputFiles({
    buffer: Buffer.from("ok"),
    name: "new.txt",
    mimeType: "text/plain",
  });
}

for (const width of [390, 1280]) {
  test(`fresh mounts ignore consent; disabled storage is untouched at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await seedAndTrace(page);
    await page.goto("/");
    await options(page, false);
    await page.evaluate(() => {
      for (const key of [
        "up-remastered:history-consent",
        "up-remastered:history-clear",
        "up-remastered:upload-history:v1",
      ])
        window.dispatchEvent(
          new StorageEvent("storage", { key, newValue: "true" }),
        );
    });
    await upload(page);
    await expect(page.getByRole("heading", { name: "new.txt" })).toBeVisible();
    await expect(page.locator(".history-card")).toBeHidden();
    expect(await calls(page)).toEqual([`local:getItem:${preferenceKey}`]);
    expect(await snapshot(page)).toEqual({
      local: JSON.stringify(records),
      session: JSON.stringify(records),
      consent: "true",
    });
    await page.reload();
    await options(page, false);
    expect(await calls(page)).toEqual([`local:getItem:${preferenceKey}`]);
  });
}

for (const stored of [
  JSON.stringify(records),
  "invalid JSON",
  '[{"id":"invalid"}]',
]) {
  test(`enable reads local history without rewriting ${stored}`, async ({
    page,
  }) => {
    await seedAndTrace(page, stored);
    await page.goto("/");
    await options(page, true);
    expect(await calls(page)).toEqual([
      `local:getItem:${preferenceKey}`,
      `local:setItem:${preferenceKey}`,
      `local:getItem:${historyKey}`,
    ]);
    expect((await snapshot(page)).local).toBe(stored);
    expect((await snapshot(page)).session).toBe(JSON.stringify(records));
    if (stored === JSON.stringify(records))
      await expect(page.locator(".history-card")).toContainText("saved.txt");
    else await expect(page.locator(".history-card")).toBeHidden();
    await page.reload();
    await page.getByRole("button", { name: /Advanced options/ }).click();
    await expect(
      page.getByRole("switch", { name: "Save history" }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Close advanced options" }).click();
    expect(await calls(page)).toEqual([
      `local:getItem:${preferenceKey}`,
      `local:getItem:${historyKey}`,
    ]);
    expect((await snapshot(page)).local).toBe(stored);
    await options(page, false);
    expect(await calls(page)).toEqual([
      `local:getItem:${preferenceKey}`,
      `local:getItem:${historyKey}`,
      `local:removeItem:${preferenceKey}`,
    ]);
    expect((await snapshot(page)).local).toBe(stored);
  });
}

test("tabs never synchronize live settings or records; mounts restore preference", async ({
  page,
  context,
}) => {
  await seedAndTrace(page);
  await page.goto("/");
  await options(page, true);
  const other = await context.newPage();
  await other.goto("/");
  await other.getByRole("button", { name: /Advanced options/ }).click();
  await expect(
    other.getByRole("switch", { name: "Save history" }),
  ).toBeChecked();
  await other.getByRole("button", { name: "Close advanced options" }).click();
  await options(other, false);
  await other.evaluate((key) => localStorage.setItem(key, "[]"), historyKey);
  await expect(page.locator(".history-card")).toContainText("saved.txt");
  await page.reload();
  await options(page, false);
  expect(await calls(page)).toEqual([`local:getItem:${preferenceKey}`]);
});

test("enabled success retains complete metadata, protected URL and key", async ({
  page,
}) => {
  await seedAndTrace(page, "[]");
  const result = {
    accessToken: "new-token",
    id: "BBB2B",
    originalName: "new.txt",
    size: 2,
    expiresAt: "2099-01-01T00:00:00Z",
    shareUrl: "http://127.0.0.1:3000/BBB2B#key=SECRET",
  };
  await page.route("**/api/upload", (route) =>
    route.fulfill({
      json: { accessToken: result.accessToken, upload: result },
    }),
  );
  await page.goto("/");
  await options(page, true);
  await upload(page);
  await expect(page.locator(".history-card")).toContainText("new.txt");
  const saved = JSON.parse((await snapshot(page)).local!);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject(result);
  expect(Number.isFinite(Date.parse(saved[0].savedAt))).toBe(true);
});

for (const outcome of ["failure", "disabled completion"] as const) {
  test(`${outcome} never saves history`, async ({ page }) => {
    await seedAndTrace(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const pending = new Promise<void>((resolve) => {
      started = resolve;
    });
    await page.route("**/api/upload", async (route) => {
      started();
      await gate;
      await route.fulfill(
        outcome === "failure"
          ? { status: 500, json: { error: "Upload failed." } }
          : {
              json: {
                accessToken: records[0].accessToken,
                upload: { ...records[0], originalName: "new.txt" },
              },
            },
      );
    });
    await page.goto("/");
    await options(page, true);
    await upload(page);
    await pending;
    if (outcome === "disabled completion") await options(page, false);
    release();
    if (outcome === "failure")
      await expect(page.getByRole("alert")).toBeVisible();
    else
      await expect(
        page.getByRole("heading", { name: "new.txt" }),
      ).toBeVisible();
    expect(await calls(page)).toEqual([
      `local:getItem:${preferenceKey}`,
      `local:setItem:${preferenceKey}`,
      `local:getItem:${historyKey}`,
      ...(outcome === "disabled completion"
        ? [`local:removeItem:${preferenceKey}`]
        : []),
    ]);
    expect((await snapshot(page)).local).toBe(JSON.stringify(records));
  });
}

test("manual list actions require enabled history; off hides the list without mutations", async ({
  page,
}) => {
  await seedAndTrace(page);
  await page.route("**/api/files/AAA1A", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.goto("/");
  await options(page, true);
  await options(page, false);
  const card = page.locator(".history-card");
  await expect(card).toBeHidden();
  expect(await calls(page)).toEqual([
    `local:getItem:${preferenceKey}`,
    `local:setItem:${preferenceKey}`,
    `local:getItem:${historyKey}`,
    `local:removeItem:${preferenceKey}`,
  ]);
  expect((await snapshot(page)).local).toBe(JSON.stringify(records));
  await options(page, true);
  await expect(card).toContainText("saved.txt");
  await expect(
    card.getByRole("button", { name: "Copy link", exact: true }),
  ).toBeEnabled();
  await expect(
    card.getByRole("button", { name: "Clear history", exact: true }),
  ).toBeEnabled();
  await card
    .getByRole("button", { name: "More actions for saved.txt" })
    .click();
  await expect(
    card.getByRole("link", { name: "Download", exact: true }),
  ).toHaveAttribute("href", /download=1/);
  await expect(
    card.getByRole("button", { name: "Delete saved.txt", exact: true }),
  ).toBeEnabled();
  await card
    .getByRole("button", { name: "Remove saved.txt from history", exact: true })
    .click();
  await expect(card).toBeHidden();
  expect(JSON.parse((await snapshot(page)).local!)).toEqual([]);
});
