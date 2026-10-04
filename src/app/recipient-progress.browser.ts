import { expect, test } from "@playwright/test";

async function createRequest(page: import("@playwright/test").Page) {
  const response = await page.request.post("/api/upload-requests", {
    data: {
      maxBytes: 4 * 1024 * 1024,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  await page.goto(body.uploadUrl);
  return body as { uploadUrl: string; managementToken: string };
}

async function selectFile(
  page: import("@playwright/test").Page,
  size = 3 * 1024 * 1024,
) {
  await page.getByLabel("Choose file").setInputFiles({
    buffer: Buffer.alloc(size, 65),
    mimeType: "text/plain",
    name: "disposable-progress.txt",
  });
  await expect(
    page.getByText(`disposable-progress.txt — ${size} bytes`),
  ).toBeVisible();
}

test("slow upload measures progress, blocks double submit, cancels and releases the real claim for retry", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const created = await createRequest(page);
  await selectFile(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 100,
    downloadThroughput: 1024 * 1024,
    uploadThroughput: 128 * 1024,
  });
  let attempts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/upload"))
      attempts++;
  });
  await page.getByRole("button", { name: "Upload file" }).click();
  await expect(page.getByLabel("Choose file")).toBeDisabled();
  await page.locator("form").evaluate((form) => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await expect
    .poll(
      async () =>
        Number(await page.getByRole("progressbar").getAttribute("value")),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
  expect(
    Number(await page.getByRole("progressbar").getAttribute("value")),
  ).toBeLessThan(100);
  expect(attempts).toBe(1);
  await page.getByRole("button", { name: "Cancel upload" }).click();
  await expect(page.getByRole("status")).toContainText("cancelled locally");
  await expect(page.getByLabel("Choose file")).toBeEnabled();
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await expect
    .poll(async () => {
      const response = await page.request.get("/api/upload-requests/manage", {
        headers: { authorization: `Bearer ${created.managementToken}` },
      });
      return (await response.json()).request.status;
    })
    .toBe("retry");
  await page.getByRole("button", { name: "Upload file" }).click();
  await expect(
    page.getByRole("heading", { name: "Upload complete" }),
  ).toBeVisible();
  expect(attempts).toBe(2);
  await page.goto(created.uploadUrl);
  await expect(
    page.getByRole("heading", { name: "Upload request unavailable" }),
  ).toBeVisible();
});

test("network failure preserves selection and retries successfully", async ({
  page,
}) => {
  await createRequest(page);
  await selectFile(page, 1024);
  await page.route(
    "**/api/upload-requests/*/upload",
    (route) => route.abort("failed"),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Upload file" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Network error",
  );
  await expect(
    page.getByText("disposable-progress.txt — 1024 bytes"),
  ).toBeVisible();
  await expect(page.getByLabel("Choose file")).toBeEnabled();
  await page.getByRole("button", { name: "Upload file" }).click();
  await expect(
    page.getByRole("heading", { name: "Upload complete" }),
  ).toBeVisible();
});

test("finalizing is distinct from completion and oversize validation allows replacement", async ({
  page,
}) => {
  await createRequest(page);
  await selectFile(page, 4 * 1024 * 1024 + 1);
  await page.getByRole("button", { name: "Upload file" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "no larger than",
  );
  await expect(page.getByLabel("Choose file")).toBeEnabled();
  await selectFile(page, 1024);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Fetch.enable", {
    patterns: [
      {
        urlPattern: "*/api/upload-requests/*/upload",
        requestStage: "Response",
      },
    ],
  });
  const paused = new Promise<string>((resolve) => {
    cdp.once("Fetch.requestPaused", (event) => resolve(event.requestId));
  });
  await page.getByRole("button", { name: "Upload file" }).click();
  const pausedRequestId = await paused;
  await expect(page.getByRole("status")).toHaveText("Finalizing… 100%");
  await expect(
    page.getByRole("heading", { name: "Upload complete" }),
  ).toHaveCount(0);
  await cdp.send("Fetch.continueRequest", { requestId: pausedRequestId });
  await expect(
    page.getByRole("heading", { name: "Upload complete" }),
  ).toBeVisible();
});
