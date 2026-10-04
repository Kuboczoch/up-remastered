import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

type LayoutProbe = Window & {
  __layoutGeometry?: Array<{
    headingY: number;
    uploadY: number;
  }>;
  __layoutShifts?: Array<{ sources: string[]; value: number }>;
};

const layoutCases = [
  {
    name: "desktop delayed configuration",
    width: 1280,
    height: 900,
    configuration: "delayed",
    offline: false,
  },
  {
    name: "desktop failed configuration",
    width: 1280,
    height: 900,
    configuration: "failed",
    offline: false,
  },
  {
    name: "desktop offline initialization",
    width: 1280,
    height: 900,
    configuration: "normal",
    offline: true,
  },
  {
    name: "mobile delayed configuration",
    width: 390,
    height: 844,
    configuration: "delayed",
    offline: false,
  },
  {
    name: "mobile failed configuration",
    width: 390,
    height: 844,
    configuration: "failed",
    offline: false,
  },
  {
    name: "mobile offline initialization",
    width: 390,
    height: 844,
    configuration: "normal",
    offline: true,
  },
] as const;

for (const layoutCase of layoutCases) {
  test(`keeps initial layout stable with ${layoutCase.name}`, async ({
    baseURL,
    page,
  }) => {
    await page.setViewportSize({
      width: layoutCase.width,
      height: layoutCase.height,
    });
    await page.addInitScript(
      ({ offline, origin }) => {
        const probe = window as LayoutProbe;
        probe.__layoutShifts = [];
        probe.__layoutGeometry = [];
        Object.defineProperty(navigator, "onLine", {
          configurable: true,
          get: () => !offline,
        });
        const history = JSON.stringify([
          {
            accessToken: "layout-test-token",
            expiresAt: "2099-01-01T00:00:00.000Z",
            id: "A1B2C",
            originalName: "stable-layout.txt",
            savedAt: "2098-01-01T00:00:00.000Z",
            shareUrl: `${origin}/A1B2C`,
            size: 12,
          },
        ]);
        localStorage.setItem("up-remastered:upload-history:v1", history);
        sessionStorage.setItem("up-remastered:upload-history:v1", history);
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & {
              hadRecentInput: boolean;
              sources?: Array<{ node?: Node }>;
              value: number;
            };
            if (!shift.hadRecentInput) {
              probe.__layoutShifts?.push({
                sources:
                  shift.sources?.map((source) =>
                    source.node instanceof Element
                      ? `${source.node.tagName}.${source.node.className}`
                      : "unknown",
                  ) ?? [],
                value: shift.value,
              });
            }
          }
        }).observe({ buffered: true, type: "layout-shift" });
        addEventListener("DOMContentLoaded", () => {
          const sample = () => {
            const heading = document.querySelector(".workspace-heading");
            const upload = document.querySelector(".upload-card");
            if (heading && upload) {
              probe.__layoutGeometry?.push({
                headingY: heading.getBoundingClientRect().y,
                uploadY: upload.getBoundingClientRect().y,
              });
            }
            if (performance.now() < 1_500) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
      },
      {
        offline: layoutCase.offline,
        origin: new URL(baseURL ?? "http://127.0.0.1:3000").origin,
      },
    );

    if (layoutCase.configuration !== "normal") {
      await page.route("**/api/configuration", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 350));
        if (layoutCase.configuration === "failed") {
          await route.abort("failed");
          return;
        }
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ maxTemporaryFileSize: 64 }),
        });
      });
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt === 0) await page.goto("/");
      else await page.reload();

      await expect(
        page.getByRole("heading", { name: "stable-layout.txt" }),
      ).toBeHidden();
      if (layoutCase.offline) {
        await expect(page.locator(".connection-warning")).toHaveText(
          /offline/i,
        );
      }
      if (layoutCase.configuration === "failed") {
        await expect(page.locator(".warning-note")).toBeVisible();
      }
      await page.waitForTimeout(500);

      const result = await page.evaluate(() => {
        const probe = window as LayoutProbe;
        const geometry = probe.__layoutGeometry ?? [];
        const spread = (values: number[]) =>
          Math.max(...values) - Math.min(...values);
        return {
          cls: (probe.__layoutShifts ?? []).reduce(
            (sum, shift) => sum + shift.value,
            0,
          ),
          shifts: probe.__layoutShifts ?? [],
          headingSpread: spread(geometry.map(({ headingY }) => headingY)),
          samples: geometry.length,
          uploadSpread: spread(geometry.map(({ uploadY }) => uploadY)),
        };
      });
      expect(result.samples).toBeGreaterThan(1);
      expect(result.headingSpread).toBeLessThanOrEqual(0.5);
      expect(result.uploadSpread).toBeLessThanOrEqual(0.5);
      expect(result.cls, JSON.stringify(result.shifts)).toBe(0);
    }
  });
}

test("uploads a picked file and exposes result actions", async ({
  baseURL,
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const deferredScripts: string[] = [];
  page.on("request", (request) => {
    if (
      request.resourceType() === "script" &&
      request.url().includes("/_next/static/chunks/")
    ) {
      deferredScripts.push(request.url());
    }
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  deferredScripts.length = 0;

  await page.locator("#file-picker").setInputFiles({
    buffer: Buffer.from("picked"),
    mimeType: "text/plain",
    name: "picked.txt",
  });

  await expect(page.getByRole("heading", { name: "picked.txt" })).toBeVisible();
  const shareUrl = await page.locator(".result-url").inputValue();
  const expectedOrigin = new URL(baseURL ?? "http://127.0.0.1:3000").origin;
  expect(shareUrl).toMatch(
    new RegExp(
      `^${expectedOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[0-9A-Z]{5}$`,
    ),
  );
  expect(deferredScripts).toEqual([]);
  await page.getByRole("button", { name: "Show QR code" }).click();
  await expect(page.getByTestId("qr-code").locator("svg")).toBeVisible();
  expect(deferredScripts.length).toBeGreaterThan(0);
  await expect(
    page.getByRole("link", { name: "Download QR code" }),
  ).toHaveAttribute("download", /-qr\.svg$/);
  await page.getByRole("button", { name: "Close QR code" }).click();
  await expect(
    page
      .locator(".result-card p")
      .filter({ hasText: /Expires in (?:24 hours|1 day)/ }),
  ).toBeVisible();
  await expect(page.locator(".result-card time")).toHaveAttribute(
    "datetime",
    /.+/,
  );
  await expect(page.getByRole("link", { name: "Open file" })).toHaveAttribute(
    "href",
    shareUrl,
  );
  const downloadFile = page
    .locator(".result-card")
    .getByRole("link", { name: "Download file" });
  await expect(downloadFile).toHaveAttribute("href", `${shareUrl}?download=1`);

  await page.getByRole("button", { name: "Copy URL" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    shareUrl,
  );

  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.locator(".result-url").dblclick();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    shareUrl,
  );

  const copyButton = page.getByRole("button", { name: "Copied" });
  await copyButton.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Open file" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(downloadFile).toBeFocused();
  const downloadPromise = page.waitForEvent("download");
  await downloadFile.press("Enter");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("picked.txt");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Show QR code" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  const startAnotherButton = page.getByRole("button", {
    name: "Upload another file",
  });
  await expect(startAnotherButton).toBeFocused();

  await startAnotherButton.click();
  await expect(
    page.getByRole("heading", { name: "Upload a file" }),
  ).toBeVisible();
  await expect(page.locator("#file-picker")).toBeFocused();
});

test("uploads pasted text and clipboard files", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Text" }).click();
  await expect(page.getByLabel("Or upload text")).toBeVisible();
  await expect(page.getByText("64 B max")).toBeVisible();
  await page.getByRole("button", { name: /Advanced options/ }).click();
  await expect(page.getByLabel("Text encoding")).toHaveValue("utf-8");
  await page.getByRole("button", { name: "Close advanced options" }).click();

  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "pasted text");
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: data });
    document.querySelector(".upload-workspace")?.dispatchEvent(event);
  });
  await expect(
    page.getByRole("heading", { name: "pasted-text.txt" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Upload another file" }).click();
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(
      new File(["clipboard"], "clipboard.txt", { type: "text/plain" }),
    );
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: data });
    document.querySelector(".upload-workspace")?.dispatchEvent(event);
  });
  await expect(
    page.getByRole("heading", { name: "clipboard.txt" }),
  ).toBeVisible();
});

test("keeps the disabled encoding at UTF-8 for pasted text bytes and MIME charset", async ({
  page,
}) => {
  let uploadBody: Buffer | null = null;
  await page.route("**/api/upload", async (route) => {
    uploadBody = route.request().postDataBuffer();
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({
        accessToken: "token",
        upload: {
          expiresAt: "2099-01-01T00:00:00.000Z",
          id: "A1B2C",
          originalName: "pasted-text.txt",
          shareUrl: "http://127.0.0.1:3000/A1B2C",
          size: 4,
        },
      }),
    });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Text" }).click();
  await expect(page.getByLabel("Or upload text")).toBeVisible();
  await page.getByRole("button", { name: /Advanced options/ }).click();
  await expect(page.getByLabel("Text encoding")).toBeDisabled();
  await expect(page.getByLabel("Text encoding")).toHaveValue("utf-8");
  await page.getByRole("button", { name: "Close advanced options" }).click();

  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "Aé");
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: data });
    document.querySelector(".upload-workspace")?.dispatchEvent(event);
  });

  await expect(
    page.getByRole("heading", { name: "pasted-text.txt" }),
  ).toBeVisible();
  expect(uploadBody).not.toBeNull();
  expect(uploadBody!.toString("latin1")).toContain(
    "Content-Type: text/plain;charset=utf-8",
  );
  expect(uploadBody!.includes(Buffer.from("Aé", "utf8"))).toBe(true);
});

test("keeps advanced settings collapsed, accessible, and narrow-layout safe", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /Advanced options/ });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#advanced-options")).toBeHidden();
  await expect(page.getByRole("link", { name: "ShareX config" })).toBeVisible();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Advanced options" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Expires after")).toHaveValue("24");
  expect(
    await dialog.evaluate(
      (element) => element.getBoundingClientRect().right <= window.innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("rejects ambiguous drops and oversized files before upload", async ({
  page,
}) => {
  await page.goto("/");

  await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(new File(["one"], "one.txt"));
    data.items.add(new File(["two"], "two.txt"));
    const target = document.querySelector(".drop-zone");
    target?.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: data,
      }),
    );
  });
  await expect(
    page.getByRole("heading", { name: "Something went wrong" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Drop exactly one file. Folders and multiple files are not supported.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Try again" }).click();
  await page.locator("#file-picker").setInputFiles({
    buffer: Buffer.alloc(65, "x"),
    mimeType: "text/plain",
    name: "too-large.txt",
  });
  await expect(page.getByText(/Maximum size is 64 B/)).toBeVisible();
});

test("shows a stable drag target and resets it on leave, exit, and drop", async ({
  page,
}) => {
  await page.goto("/");

  const dispatchFileDrag = async (
    type: "dragenter" | "dragleave" | "drop",
    selector: string,
  ) => {
    await page.evaluate(
      ({ eventType, targetSelector }) => {
        const data = new DataTransfer();
        data.items.add(new File(["valid"], "valid.txt"));
        document.querySelector(targetSelector)?.dispatchEvent(
          new DragEvent(eventType, {
            bubbles: true,
            cancelable: true,
            dataTransfer: data,
          }),
        );
      },
      { eventType: type, targetSelector: selector },
    );
  };

  await dispatchFileDrag("dragenter", ".drop-zone");
  await expect(page.getByText("Drop file to upload")).toBeVisible();

  await dispatchFileDrag("dragenter", ".file-panel");
  await dispatchFileDrag("dragleave", ".file-panel");
  await expect(page.getByText("Drop file to upload")).toBeVisible();

  await dispatchFileDrag("dragleave", ".drop-zone");
  await expect(page.getByText("Drop file to upload")).toBeHidden();

  await dispatchFileDrag("dragenter", ".drop-zone");
  await dispatchFileDrag("dragleave", "html");
  await expect(page.getByText("Drop file to upload")).toBeHidden();

  await dispatchFileDrag("dragenter", ".drop-zone");
  await dispatchFileDrag("drop", ".drop-zone");
  await expect(page.getByText("Drop file to upload")).toBeHidden();
  await expect(page.getByRole("heading", { name: "valid.txt" })).toBeVisible();
});

test("uses short feedback motion and honors reduced-motion preferences", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(new File(["valid"], "valid.txt"));
    document.querySelector(".drop-zone")?.dispatchEvent(
      new DragEvent("dragenter", {
        bubbles: true,
        cancelable: true,
        dataTransfer: data,
      }),
    );
  });
  await expect(page.locator(".drop-overlay")).toHaveCSS(
    "animation-name",
    "drop-feedback-in",
  );

  await page.getByRole("button", { name: /Advanced options/ }).click();
  await expect(page.locator(".advanced-options-content")).toHaveCSS(
    "animation-name",
    "disclosure-feedback-in",
  );

  await page.locator("#file-picker").setInputFiles({
    buffer: Buffer.from("motion"),
    mimeType: "text/plain",
    name: "motion.txt",
  });
  await expect(page.locator(".result-card")).toHaveCSS(
    "animation-name",
    "card-feedback-in",
  );
  await page.getByRole("button", { name: "Copy URL" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toHaveCSS(
    "animation-name",
    "copy-confirm",
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Upload another file" }).click();
  await page.getByRole("button", { name: /Advanced options/ }).click();
  const reducedDuration = await page
    .locator(".advanced-options-content")
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).animationDuration),
    );
  expect(reducedDuration).toBeLessThanOrEqual(0.001);
});

test("shows upload percentage in the title and supports mobile text upload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/upload", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({
        accessToken: "token",
        key: "A1B2C",
        toDelete: "2099-01-01T00:00:00.000Z",
        upload: {
          accessToken: "token",
          expiresAt: "2099-01-01T00:00:00.000Z",
          id: "A1B2C",
          originalName: "pasted-text.txt",
          shareUrl: "http://127.0.0.1:3000/A1B2C",
          size: 11,
        },
      }),
    });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Text" }).click();

  await expect(page.getByLabel("Or upload text")).toBeVisible();
  await page.getByLabel("Or upload text").fill("mobile text");
  await page.getByRole("button", { name: "Upload text" }).click();
  await expect(page).toHaveTitle(/\d+% · Up - Remastered/);
  await expect(
    page.getByRole("heading", { name: "pasted-text.txt" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Up - Remastered");

  const openFile = page.getByRole("link", { name: "Open file" });
  const startAnother = page.getByRole("button", {
    name: "Upload another file",
  });
  const [openFileBox, startAnotherBox] = await Promise.all([
    openFile.boundingBox(),
    startAnother.boundingBox(),
  ]);
  expect(openFileBox).not.toBeNull();
  expect(startAnotherBox).not.toBeNull();
  expect((startAnotherBox?.y ?? 0) > (openFileBox?.y ?? 0)).toBe(true);
  expect(
    (startAnotherBox?.x ?? 0) + (startAnotherBox?.width ?? 0),
  ).toBeLessThanOrEqual(390);

  await startAnother.click();
  await page.getByLabel("Or upload text").fill("cancelled upload");
  await page.getByRole("button", { name: "Upload text" }).click();
  await expect(page).toHaveTitle(/\d+% · Up - Remastered/);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveTitle("Up - Remastered");

  await page.getByLabel("Or upload text").fill("unmounted upload");
  await page.getByRole("button", { name: "Upload text" }).click();
  await expect(page).toHaveTitle(/\d+% · Up - Remastered/);
  await page.goto("/request/new");
  await expect(page).toHaveTitle("Request a file | Up - Remastered");
});

test("disabled history stays empty across page restarts", async ({
  context,
  page,
}) => {
  await page.goto("/");
  await page.locator("#file-picker").setInputFiles({
    buffer: Buffer.from("history"),
    mimeType: "text/plain",
    name: "history.txt",
  });
  await expect(
    page.getByRole("heading", { name: "history.txt" }),
  ).toBeVisible();
  const shareUrl = await page.locator(".result-url").inputValue();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("up-remastered:upload-history:v1"),
    ),
  ).toBeNull();
  const reopenedPage = await context.newPage();
  await page.close();
  await reopenedPage.goto("/");
  await expect(reopenedPage.locator(".history-card")).toBeHidden();
  expect((await reopenedPage.request.get(shareUrl)).ok()).toBe(true);
});

test("history toggles are page-local and turning off leaves records untouched", async ({
  context,
  page,
}) => {
  await page.goto("/");
  const otherPage = await context.newPage();
  await otherPage.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("up-remastered:history-consent", "true");
    localStorage.setItem(
      "up-remastered:upload-history:v1",
      JSON.stringify([
        {
          accessToken: "not-rendered",
          expiresAt: "2099-01-01T00:00:00Z",
          id: "AAAAA",
          originalName: "synced.txt",
          savedAt: "2026-01-01T00:00:00Z",
          shareUrl: `${location.origin}/AAAAA`,
          size: 6,
        },
      ]),
    );
  });
  await otherPage.getByRole("button", { name: /Advanced options/ }).click();
  await expect(
    otherPage.getByRole("switch", { name: "Save history" }),
  ).not.toBeChecked();
  await expect(
    otherPage.getByRole("switch", { name: "Save history" }),
  ).toBeEnabled();
  await otherPage.getByRole("switch", { name: "Save history" }).check();
  await otherPage
    .getByRole("button", { name: "Close advanced options" })
    .click();
  await expect(
    otherPage.getByRole("heading", { name: "synced.txt" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Advanced options/ }).click();
  await expect(
    page.getByRole("switch", { name: "Save history" }),
  ).not.toBeChecked();
  await page.getByRole("switch", { name: "Save history" }).check();
  await page.getByRole("switch", { name: "Save history" }).uncheck();
  await expect(otherPage.locator(".history-card")).toBeVisible();
  await expect(page.locator(".history-card")).toBeHidden();
  expect(
    await otherPage.evaluate(() =>
      localStorage.getItem("up-remastered:upload-history:v1"),
    ),
  ).toContain("synced.txt");
  expect(await otherPage.locator("body").innerText()).not.toContain(
    "not-rendered",
  );
});

test("announces offline status and clears it after reconnection", async ({
  context,
  page,
}) => {
  await page.goto("/");
  await context.setOffline(true);
  await expect(page.locator(".connection-warning")).toHaveText(/offline/i);
  await context.setOffline(false);
  await expect(page.getByText(/You are offline/)).toBeHidden();
});
