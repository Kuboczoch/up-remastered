import { expect, test } from "@playwright/test";

test("creates a bounded request, accepts one upload, and exposes owner status", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/request/new");
  await expect(
    page.getByRole("heading", { name: "Request a file" }),
  ).toBeVisible();
  await expect(page.getByText("Server maximum: 64 B.")).toBeVisible();
  await page.getByLabel("Maximum upload size").selectOption("custom");
  await page.getByLabel("Size amount").fill("16");
  const [createResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/api/upload-requests"),
    ),
    page.getByRole("button", { name: "Create upload request" }).click(),
  ]);
  expect(createResponse.status()).toBe(201);
  expect(createResponse.headers()["cache-control"]).toContain("no-store");

  await expect(
    page.getByRole("heading", { name: "Upload request created" }),
  ).toBeVisible();
  const uploadUrl = await page
    .getByText("Send this upload link:")
    .getByRole("link")
    .getAttribute("href");
  const managementUrl = await page
    .locator('a[href*="/request/manage#"]')
    .getAttribute("href");
  expect(uploadUrl).toMatch(/\/request\/[a-f0-9]{64}$/);
  expect(managementUrl).toMatch(/\/request\/manage#[a-f0-9]{64}$/);
  const managementToken = managementUrl!.split("#")[1];
  await expect(page.locator("time")).toHaveAttribute("datetime", /Z$/);
  await expect(page.getByText(/Expires in \d+ (minute|hour)/)).toBeVisible();
  await page.getByRole("button", { name: "Copy upload link" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    uploadUrl,
  );
  await page.getByRole("button", { name: "Copy owner link" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    managementUrl,
  );

  await page.goto(uploadUrl!);
  await page.getByLabel("Choose file").setInputFiles({
    buffer: Buffer.from("requested"),
    mimeType: "text/plain",
    name: "requested.txt",
  });
  const [uploadResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/upload-requests/") &&
        response.url().endsWith("/upload"),
    ),
    page.getByRole("button", { name: "Upload file" }).click(),
  ]);
  expect(uploadResponse.status()).toBe(201);
  await expect(
    page.getByRole("heading", { name: "Upload complete" }),
  ).toBeVisible();
  await expect(page.getByText("No owner management token")).toBeVisible();

  const [managementResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().endsWith("/api/upload-requests/manage"),
    ),
    page.goto(managementUrl!),
  ]);
  expect(managementResponse.headers()["cache-control"]).toContain("no-store");
  expect(managementResponse.url()).not.toContain(managementToken);
  await expect(page.getByRole("status")).toHaveText("consumed");
  await expect(page).not.toHaveURL(/#/);
  expect(await page.locator("body").textContent()).not.toContain(
    managementToken,
  );
  await expect(page.getByRole("link", { name: "Open file" })).toHaveAttribute(
    "href",
    /^\/[0-9A-Z]{5}$/,
  );

  await page.reload();
  await expect(page.getByRole("status")).toHaveText("consumed");
  await page.goto("/request/new");
  await page.goBack();
  await expect(page.getByRole("status")).toHaveText("consumed");
  await page.getByRole("button", { name: "Copy owner link" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    managementUrl,
  );

  await page.goto(uploadUrl!);
  await expect(
    page.getByRole("heading", { name: "Upload request unavailable" }),
  ).toBeVisible();
});

test("lets the owner revoke an unused request without disclosing capabilities", async ({
  page,
}) => {
  await page.goto("/request/new");
  await page.getByLabel("Maximum upload size").selectOption("custom");
  await page.getByLabel("Size amount").fill("8");
  await page.getByRole("button", { name: "Create upload request" }).click();
  const uploadUrl = await page
    .getByText("Send this upload link:")
    .getByRole("link")
    .getAttribute("href");
  const managementUrl = await page
    .locator('a[href*="/request/manage#"]')
    .getAttribute("href");

  await page.goto(managementUrl!);

  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "DELETE" &&
        candidate.url().endsWith("/api/upload-requests/manage"),
    ),
    page.getByRole("button", { name: "Revoke request" }).click(),
  ]);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await expect(page.getByRole("status")).toHaveText("revoked");

  await page.goto(uploadUrl!);
  await expect(
    page.getByRole("heading", { name: "Upload request unavailable" }),
  ).toBeVisible();

  const invalid = await page.evaluate(async () => {
    const response = await fetch("/api/upload-requests/manage", {
      headers: { authorization: `Bearer ${"0".repeat(64)}` },
    });
    return {
      body: await response.json(),
      cacheControl: response.headers.get("cache-control"),
      status: response.status,
    };
  });
  expect(invalid).toEqual({
    body: {
      error: {
        code: "upload_request_unavailable",
        message: "This upload request is unavailable.",
      },
    },
    cacheControl: "no-store",
    status: 404,
  });
});
