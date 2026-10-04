import {
  chromium,
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";

const ownerToken = "a".repeat(64);
const uploadToken = "b".repeat(64);
const instructions =
  "Could not copy automatically. Select and copy the complete link below.";
const modes = [
  "insecure HTTP",
  "secure clipboard",
  "secure rejection",
] as const;
type Mode = (typeof modes)[number];
const actions = [
  "result button",
  "result double click",
  "history",
  "request upload",
  "request owner",
  "owner management",
] as const;

async function openApplication(browser: Browser, baseURL: string, mode: Mode) {
  const backend = new URL(baseURL);
  const origin =
    mode === "insecure HTTP"
      ? `http://copy-links.test:${backend.port}`
      : "https://copy-links.test";
  const context = await browser.newContext();
  if (mode !== "insecure HTTP") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin,
    });
    // Serve the real production application on a browser-visible HTTPS origin.
    // Only transport is bridged; secure-context and Clipboard APIs stay native.
    await context.route(`${origin}/**`, async (route) => {
      const incoming = new URL(route.request().url());
      const response = await context.request.fetch(
        new URL(`${incoming.pathname}${incoming.search}`, backend).href,
        {
          method: route.request().method(),
          headers: { ...route.request().headers(), host: backend.host },
          data: route.request().postDataBuffer() ?? undefined,
          maxRedirects: 0,
        },
      );
      await route.fulfill({ response });
      await response.dispose();
    });
  }

  const page = await context.newPage();
  const errors: string[] = [];
  const requestedUrls: string[] = [];
  const managementAuthorizations: (string | undefined)[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requestedUrls.push(request.url()));
  const shareUrl = `${origin}/A1B2C`;
  const uploadUrl = `${origin}/request/${uploadToken}`;
  const ownerUrl = `${origin}/request/manage#${ownerToken}`;
  const now = Date.now();
  const requestDetails = {
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 60 * 60 * 1000).toISOString(),
    maxBytes: 4096,
    status: "active",
    statusChangedAt: new Date(now).toISOString(),
  };

  // These tests exercise copy UI, not writes against an alternate public origin.
  // Explicit API fixtures preserve the server's canonical-origin policy.
  await page.route("**/api/upload", async (route) => {
    await route.fulfill({
      status: 201,
      json: {
        accessToken: "copy-regression-access-token",
        upload: {
          expiresAt: requestDetails.expiresAt,
          id: "A1B2C",
          originalName: "copy-regression.txt",
          shareUrl,
          size: 4,
        },
      },
    });
  });
  await page.route("**/api/upload-requests", async (route) => {
    expect(route.request().method()).toBe("POST");
    await route.fulfill({
      status: 201,
      json: {
        ...requestDetails,
        managementToken: ownerToken,
        managementUrl: ownerUrl,
        uploadUrl,
      },
    });
  });
  await page.route("**/api/upload-requests/manage", async (route) => {
    managementAuthorizations.push(route.request().headers().authorization);
    await route.fulfill({ json: { request: requestDetails } });
  });
  await page.route("**/api/upload-requests/manage/events", async (route) => {
    managementAuthorizations.push(route.request().headers().authorization);
    await route.fulfill({
      contentType: "text/event-stream",
      body: `event: status\ndata: ${JSON.stringify({ request: requestDetails })}\n\n`,
    });
  });

  await page.goto(origin);
  expect(await page.evaluate(() => window.isSecureContext)).toBe(
    mode !== "insecure HTTP",
  );
  expect(await page.evaluate(() => typeof navigator.clipboard)).toBe(
    mode === "insecure HTTP" ? "undefined" : "object",
  );
  if (mode === "secure rejection") {
    await context.addInitScript(() => {
      Object.defineProperty(navigator.clipboard, "writeText", {
        configurable: true,
        value: () =>
          Promise.reject(
            new DOMException("Clipboard denied", "NotAllowedError"),
          ),
      });
    });
    // Rejection injection applies only after proving native secure API support.
    await page.reload();
  }
  return {
    context,
    page,
    origin,
    shareUrl,
    uploadUrl,
    ownerUrl,
    errors,
    requestedUrls,
    managementAuthorizations,
  };
}

async function expectManualCopy(page: Page, completeLink: string) {
  await expect(page.getByText(instructions, { exact: true })).toBeVisible();
  const textbox = page.getByRole("textbox", {
    name: "Link to copy",
    exact: true,
  });
  await expect(textbox).toBeVisible();
  await expect(textbox).toHaveValue(completeLink);
  await expect(textbox).toHaveJSProperty("readOnly", true);
  await textbox.click();
  await textbox.press("ControlOrMeta+A");
  expect(
    await textbox.evaluate((element) => {
      const input = element as HTMLInputElement;
      return input.value.slice(
        input.selectionStart ?? 0,
        input.selectionEnd ?? 0,
      );
    }),
  ).toBe(completeLink);
  await expect(page.getByText("Link copied.", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: /^(Copied(?:\s*✓)?|Upload link copied|Owner link copied)$/,
    }),
  ).toHaveCount(0);
}

for (const mode of modes) {
  for (const action of actions) {
    test(`${mode}: ${action} copies the complete link or offers selectable manual recovery`, async ({
      browser: defaultBrowser,
      baseURL,
    }) => {
      // Loopback HTTP is trustworthy in Chromium: DNS mapping is required to
      // reproduce a genuinely absent Clipboard API without mocking it away.
      const isolatedBrowser =
        mode === "insecure HTTP"
          ? await chromium.launch({
              args: [
                "--host-resolver-rules=MAP copy-links.test 127.0.0.1",
                "--no-proxy-server",
              ],
            })
          : undefined;
      try {
        const app = await openApplication(
          isolatedBrowser ?? defaultBrowser,
          baseURL!,
          mode,
        );
        try {
          const { page } = app;
          let completeLink: string;
          let successLabel: string;
          if (action.startsWith("result")) {
            await page.locator("#file-picker").setInputFiles({
              name: "copy-regression.txt",
              mimeType: "text/plain",
              buffer: Buffer.from("copy"),
            });
            await expect(
              page.getByRole("heading", { name: "copy-regression.txt" }),
            ).toBeVisible();
            completeLink = app.shareUrl;
            successLabel = "Copied";
            if (action === "result double click") {
              await page.locator(".result-url").dblclick();
            } else {
              await page
                .getByRole("button", { name: "Copy URL", exact: true })
                .click();
            }
          } else if (action === "history") {
            await page.evaluate(
              ({ shareUrl, expiresAt }) => {
                localStorage.setItem("up-remastered:history-enabled", "true");
                localStorage.setItem(
                  "up-remastered:upload-history:v1",
                  JSON.stringify([
                    {
                      accessToken: "copy-regression-access-token",
                      expiresAt,
                      id: "A1B2C",
                      originalName: "copy-history.txt",
                      savedAt: new Date().toISOString(),
                      shareUrl,
                      size: 4,
                    },
                  ]),
                );
              },
              {
                shareUrl: app.shareUrl,
                expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              },
            );
            await page.reload();
            await page
              .getByRole("button", { name: "Copy link", exact: true })
              .click();
            completeLink = app.shareUrl;
            successLabel = "Link copied.";
          } else if (action === "owner management") {
            await page.goto(app.ownerUrl);
            await expect(page).toHaveURL(`${app.origin}/request/manage`);
            expect(await page.evaluate(() => window.location.hash)).toBe("");
            await page
              .getByRole("button", { name: "Copy owner link", exact: true })
              .click();
            completeLink = app.ownerUrl;
            successLabel = "Owner link copied";
            expect(app.managementAuthorizations.length).toBeGreaterThan(0);
            expect(app.managementAuthorizations).toContain(
              `Bearer ${ownerToken}`,
            );
          } else {
            await page.goto(`${app.origin}/request/new`);
            const create = page.getByRole("button", {
              name: "Create upload request",
            });
            await expect(create).toBeEnabled();
            await create.click();
            await expect(
              page.getByRole("heading", { name: "Upload request created" }),
            ).toBeVisible();
            const owner = action === "request owner";
            completeLink = owner ? app.ownerUrl : app.uploadUrl;
            successLabel = owner ? "Owner link copied" : "Upload link copied";
            await page
              .getByRole("button", {
                name: owner ? "Copy owner link" : "Copy upload link",
                exact: true,
              })
              .click();
          }

          if (mode === "secure clipboard") {
            await expect
              .poll(() => page.evaluate(() => navigator.clipboard.readText()))
              .toBe(completeLink);
            if (action === "history") {
              await expect(
                page.getByText(successLabel, { exact: true }),
              ).toBeVisible();
            } else {
              await expect(
                page.getByRole("button", { name: successLabel }),
              ).toBeVisible();
            }
            await expect(
              page.getByRole("textbox", { name: "Link to copy" }),
            ).toHaveCount(0);
            await expect(
              page.getByText(instructions, { exact: true }),
            ).toHaveCount(0);
          } else {
            await expectManualCopy(page, completeLink);
          }
          // The owner capability belongs in a fragment or Authorization header,
          // never a requested URL, even after the scrubbed page copies it again.
          expect(
            app.requestedUrls.filter((url) => url.includes(ownerToken)),
          ).toEqual([]);
          expect(app.errors).toEqual([]);
        } finally {
          await app.context.close();
        }
      } finally {
        await isolatedBrowser?.close();
      }
    });
  }
}
