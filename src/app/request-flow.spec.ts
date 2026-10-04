import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

async function create(page: import("@playwright/test").Page) {
  const response = await page.request.post("/api/upload-requests", {
    data: {
      maxBytes: 4096,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

test("owner states, safe revoke focus/cancellation/failure, and scrubbed manual copy", async ({
  page,
}) => {
  const request = await create(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    }),
  );
  await page.goto(request.managementUrl);
  await expect(page.getByText("Waiting for upload.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open file" })).toHaveCount(0);
  await expect(page.getByText("Reserved download link:")).toBeVisible();
  await expect(page).not.toHaveURL(/#/);
  await page.getByRole("button", { name: "Copy owner link" }).click();
  await expect(
    page.getByLabel("Complete link for manual copying"),
  ).toBeVisible();
  expect(
    (await page.getByLabel("Complete link for manual copying").inputValue()) ===
      request.managementUrl,
  ).toBe(true);
  await page
    .getByRole("button", { name: "Revoke request", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include("main").analyze()).violations,
  ).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Keep request" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Revoke request", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Revoke request", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep request" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Revoke request", exact: true }),
  ).toBeFocused();
  await page.route("**/api/upload-requests/manage", async (route) => {
    if (route.request().method() === "DELETE")
      await route.fulfill({
        status: 500,
        json: { error: { message: "Revoke failed; try again." } },
      });
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "Revoke request", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm revoke" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    /revoke/i,
  );
  await expect(page.getByText("Waiting for upload.")).toBeVisible();
  await page.unroute("**/api/upload-requests/manage");
  await page
    .getByRole("button", { name: "Revoke request", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm revoke" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "revoked" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Revoke request", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("status").filter({ hasText: "revoked" }),
  ).toBeVisible();
  await page.goto(request.uploadUrl);
  await expect(page.getByText(/revoked.*new request/i)).toBeVisible();
});

test("creation waits for actual consumption and updates over SSE", async ({
  page,
  context,
}) => {
  await page.goto("/request/new");
  await page.getByRole("button", { name: "Create upload request" }).click();
  await expect(page.getByText("Waiting for upload.")).toBeVisible();
  const uploadUrl = await page
    .getByText("Send this upload link:")
    .getByRole("link")
    .getAttribute("href");
  const recipient = await context.newPage();
  await recipient.goto(uploadUrl!);
  await expect(recipient.getByText(/Maximum 4 KiB/)).toBeVisible();
  await expect(recipient.locator("time")).toHaveAttribute("datetime", /Z$/);
  await recipient.getByLabel("Choose file").setInputFiles({
    name: "delivery.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("delivered"),
  });
  await recipient
    .getByRole("button", { name: "Upload file", exact: true })
    .click();
  await expect(recipient.getByRole("status")).toContainText("requester");
  await expect(recipient.getByText("delivery.txt · 9 B")).toBeVisible();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const shareUrl = await recipient
    .getByRole("link", { name: "Open file" })
    .getAttribute("href");
  await recipient
    .getByRole("button", { name: "Copy link", exact: true })
    .click();
  expect(await recipient.evaluate(() => navigator.clipboard.readText())).toBe(
    shareUrl,
  );
  const [opened] = await Promise.all([
    context.waitForEvent("page"),
    recipient.getByRole("link", { name: "Open file" }).click(),
  ]);
  await opened.waitForLoadState();
  await expect(opened.locator("body")).toContainText("delivered");
  const [download] = await Promise.all([
    recipient.waitForEvent("download"),
    recipient.getByRole("link", { name: "Download file" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("delivery.txt");
  expect(await readFile((await download.path())!, "utf8")).toBe("delivered");
  await expect(page.getByRole("link", { name: "Open file" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Revoke request", exact: true }),
  ).toHaveCount(0);
  await recipient.reload();
  await expect(
    recipient.getByText(/already delivered.*new request/i),
  ).toBeVisible();
});

for (const width of [320, 390]) {
  test(`request navigation touch targets at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/request/new");
    const bounds = await page
      .getByRole("link", { name: "Back to uploads" })
      .boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    await expect(
      page.getByRole("button", { name: "Create upload request" }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const request = await create(page);
    for (const url of [request.uploadUrl, request.managementUrl]) {
      await page.goto(url);
      const home = await page
        .getByRole("link", { name: "Home", exact: false })
        .filter({ hasText: "←" })
        .boundingBox();
      expect(home!.height).toBeGreaterThanOrEqual(44);
      const action =
        url === request.uploadUrl
          ? page.getByRole("button", { name: "Upload file", exact: true })
          : page.getByRole("button", { name: "Copy owner link" });
      await expect(action).toBeVisible();
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
}

test("expired and invalid recipient pages give safe next steps; expired owners cannot revoke", async ({
  page,
}) => {
  const response = await page.request.post("/api/upload-requests", {
    data: {
      maxBytes: 4096,
      expiresAt: new Date(Date.now() + 1500).toISOString(),
    },
  });
  expect(response.status()).toBe(201);
  const request = await response.json();
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get("/api/upload-requests/manage", {
              headers: { authorization: `Bearer ${request.managementToken}` },
            })
          ).json()
        ).request.status,
    )
    .toBe("expired");
  await page.goto(request.managementUrl);
  await expect(page.getByRole("status")).toContainText("expired");
  await expect(
    page.getByRole("button", { name: "Revoke request", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open file" })).toHaveCount(0);
  await page.goto(request.uploadUrl);
  await expect(page.getByText(/expired.*new request link/)).toBeVisible();
  await page.goto(`/request/${"0".repeat(64)}`);
  await expect(page.getByText(/invalid.*complete link/)).toBeVisible();
  await expect(page.getByLabel("Choose file")).toHaveCount(0);
});

test("recipient expiration uses the served locale and stable UTC across browser timezones", async ({
  browser,
  request,
}) => {
  const response = await request.post("/api/upload-requests", {
    data: {
      maxBytes: 4096,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
  });
  const created = await response.json();
  const context = await browser.newContext({
    timezoneId: "America/Los_Angeles",
    locale: "en-US",
  });
  try {
    const page = await context.newPage();
    const hydrationErrors: string[] = [];
    page.on("console", (event) => {
      if (/hydration|hydrated/i.test(event.text()))
        hydrationErrors.push(event.text());
    });
    await page.goto(created.uploadUrl);
    const expected = await page.evaluate(
      (value) =>
        new Intl.DateTimeFormat("en", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
        }).format(new Date(value)),
      created.expiresAt,
    );
    await expect(page.locator("main time")).toHaveAttribute(
      "datetime",
      created.expiresAt,
    );
    await expect(page.locator("main time")).toHaveText(expected);
    expect(hydrationErrors).toEqual([]);
    expect(
      (await new AxeBuilder({ page }).include("main").analyze()).violations,
    ).toEqual([]);
  } finally {
    await context.close();
  }
});
