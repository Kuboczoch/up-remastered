import { expect, test } from "@playwright/test";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

test("real throttled request upload cancels, disposes partial bytes, releases claim and retries", async ({
  page,
  context,
}) => {
  test.setTimeout(45000);
  const maxBytes = Number(process.env.MAX_UPLOAD_SIZE ?? 4096);
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
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await expect.poll(inspect).toBe("in_progress");
  await expect
    .poll(async () =>
      Number(await page.getByRole("progressbar").getAttribute("value")),
    )
    .toBeGreaterThan(0);
  const measured = Number(
    await page.getByRole("progressbar").getAttribute("value"),
  );
  expect(measured).toBeLessThanOrEqual(100);
  await expect(page.getByLabel("Choose file")).toBeDisabled();
  let partialBytes = 0;
  // Small files can fit entirely in a network buffer. The large-file run also
  // verifies bytes really reached disk before abort, not just browser progress.
  if (maxBytes >= 65536) {
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
    expect(partialBytes).toBeLessThan(maxBytes);
  }
  await page.getByRole("button", { name: "Cancel upload" }).click();
  await expect(page.getByRole("status")).toContainText("Cancelled");
  await expect(page.getByLabel("Choose file")).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Upload file", exact: true }),
  ).toBeFocused();
  await expect(page.getByText(/slow.txt ·/)).toBeVisible();
  await expect.poll(inspect).toBe("retry");
  const entries = await readdir(process.env.UPLOAD_DIR!, { recursive: true });
  expect(entries.sort()).toEqual(before.sort());
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("requester");
  await expect.poll(inspect).toBe("consumed");
  console.log(
    JSON.stringify({
      measuredProgressPercent: measured,
      cancelledStatus: "retry",
      retriedStatus: "consumed",
      partialFilesAfterCancel: 0,
      actualPartialBytesBeforeCancel: partialBytes,
    }),
  );
});
