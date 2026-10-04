import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

async function cancelAndRetry(
  page: Page,
  context: BrowserContext,
  maxBytes: number,
  requirePartialStream: boolean,
) {
  test.setTimeout(60000);
  expect(Number(process.env.MAX_UPLOAD_SIZE ?? 4096)).toBeGreaterThanOrEqual(
    maxBytes,
  );
  const response = await page.request.post("/api/upload-requests", {
    data: { maxBytes, expiresAt: new Date(Date.now() + 3600000).toISOString() },
  });
  expect(response.status()).toBe(201);
  const request = await response.json();
  const inspect = async () =>
    (
      await (
        await page.request.get("/api/upload-requests/manage", {
          headers: { authorization: `Bearer ${request.managementToken}` },
        })
      ).json()
    ).request.status;
  await page.goto(request.uploadUrl);
  await page.getByLabel("Choose file").setInputFiles({
    name: "slow.txt",
    mimeType: "text/plain",
    buffer: Buffer.alloc(maxBytes, 65),
  });
  await mkdir(process.env.UPLOAD_DIR!, { recursive: true });
  const before = await readdir(process.env.UPLOAD_DIR!, { recursive: true });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 50,
    downloadThroughput: -1,
    uploadThroughput: maxBytes / 16,
  });
  // Observe the original browser XHR; never replace transport or fake progress.
  const uploadStarted = page.waitForRequest(
    (candidate) =>
      candidate.method() === "POST" &&
      candidate.url().endsWith("/upload") &&
      candidate.resourceType() === "xhr",
  );
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await uploadStarted;
  await expect.poll(inspect).toBe("in_progress");
  await expect
    .poll(async () =>
      Number(await page.getByRole("progressbar").getAttribute("value")),
    )
    .toBeGreaterThan(0);
  await expect(page.getByLabel("Choose file")).toBeDisabled();
  let partialBytes = 0;
  // Mandatory for the dedicated large case, regardless of environment defaults.
  if (requirePartialStream) {
    const pending = async () =>
      (await readdir(process.env.UPLOAD_DIR!)).filter(
        (name) => name.startsWith(".upload-") && name.endsWith(".tmp"),
      );
    await expect
      .poll(async () => (await pending()).length, { timeout: 15000 })
      .toBe(1);
    const path = join(process.env.UPLOAD_DIR!, (await pending())[0]);
    await expect
      .poll(async () => (await stat(path)).size, { timeout: 15000 })
      .toBeGreaterThan(0);
    partialBytes = (await stat(path)).size;
    expect(partialBytes).toBeGreaterThan(0);
    expect(partialBytes).toBeLessThan(maxBytes);
  }
  // Sample after observing disk bytes, immediately at the cancellation boundary.
  const measured = Number(
    await page.getByRole("progressbar").getAttribute("value"),
  );
  expect(measured).toBeGreaterThan(0);
  if (requirePartialStream) expect(measured).toBeLessThan(100);
  else expect(measured).toBeLessThanOrEqual(100);
  await page.getByRole("button", { name: "Cancel upload" }).click();
  await expect(page.getByRole("status")).toContainText("Cancelled");
  await expect(page.getByLabel("Choose file")).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Upload file", exact: true }),
  ).toBeFocused();
  await expect(page.getByText(/slow.txt ·/)).toBeVisible();
  await expect.poll(inspect).toBe("retry");
  await expect
    .poll(async () =>
      (await readdir(process.env.UPLOAD_DIR!, { recursive: true })).sort(),
    )
    .toEqual(before.sort());
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("requester");
  await expect.poll(inspect).toBe("consumed");
  const afterRetry = (
    await readdir(process.env.UPLOAD_DIR!, { recursive: true })
  ).sort();
  const reused = await page.request.post(
    `/api/upload-requests/${new URL(request.uploadUrl).pathname.split("/").pop()}/upload`,
    {
      multipart: {
        file: {
          name: "second.txt",
          mimeType: "text/plain",
          buffer: Buffer.alloc(maxBytes, 66),
        },
      },
    },
  );
  expect(reused.status()).toBe(404);
  await expect.poll(inspect).toBe("consumed");
  expect(
    (await readdir(process.env.UPLOAD_DIR!, { recursive: true })).sort(),
  ).toEqual(afterRetry);
  console.log(
    JSON.stringify({
      evidence: requirePartialStream
        ? "large-actual-stream"
        : "default-small-buffered",
      fileSize: maxBytes,
      measuredProgressPercentAtCancellation: measured,
      secondUploadStatus: reused.status(),
      cancelledStatus: "retry",
      retriedStatus: "consumed",
      partialFilesAfterCancel: 0,
      actualPartialBytesBeforeCancel: partialBytes,
    }),
  );
}

test("default small buffered request upload cancels, cleans up and retries once", async ({
  page,
  context,
}) => {
  await cancelAndRetry(page, context, 4096, false);
});

test("dedicated large actual-stream cancellation has partial disk bytes and incomplete native XHR progress", async ({
  page,
  context,
}) => {
  await cancelAndRetry(page, context, 1048576, true);
});
