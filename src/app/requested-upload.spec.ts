import { expect, test } from "@playwright/test";

test("creates a bounded request, accepts one upload, and exposes owner status", async ({
  page,
  request,
}) => {
  await page.goto("/request/new");
  await expect(
    page.getByRole("heading", { name: "Request a file" }),
  ).toBeVisible();
  await page.getByLabel("Maximum upload size in bytes").fill("16");
  await page.getByRole("button", { name: "Create upload request" }).click();

  await expect(
    page.getByRole("heading", { name: "Upload request created" }),
  ).toBeVisible();
  const uploadUrl = await page
    .getByText("Send this upload link:")
    .getByRole("link")
    .getAttribute("href");
  const managementToken = (await page.locator("code").textContent()) ?? "";
  expect(uploadUrl).toMatch(/\/request\/[a-f0-9]{64}$/);
  expect(managementToken).toMatch(/^[a-f0-9]{64}$/);

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
  expect(await page.locator("body").innerText()).not.toContain(managementToken);

  const ownerResponse = await request.get("/api/upload-requests/manage", {
    headers: { authorization: `Bearer ${managementToken}` },
  });
  expect(ownerResponse.status()).toBe(200);
  expect(await ownerResponse.json()).toMatchObject({
    request: {
      status: "consumed",
      uploadId: expect.stringMatching(/^[0-9A-Z]{5}$/),
    },
  });

  await page.goto(uploadUrl!);
  await expect(
    page.getByRole("heading", { name: "Upload request unavailable" }),
  ).toBeVisible();
});

test("lets the owner revoke an unused request without disclosing capabilities", async ({
  page,
}) => {
  await page.goto("/request/new");
  await page.getByLabel("Maximum upload size in bytes").fill("8");
  await page.getByRole("button", { name: "Create upload request" }).click();
  const uploadUrl = await page
    .getByText("Send this upload link:")
    .getByRole("link")
    .getAttribute("href");

  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "DELETE" &&
        candidate.url().endsWith("/api/upload-requests/manage"),
    ),
    page.getByRole("button", { name: "Revoke request" }).click(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page.getByRole("status")).toHaveText("Status: revoked");

  await page.goto(uploadUrl!);
  await expect(
    page.getByRole("heading", { name: "Upload request unavailable" }),
  ).toBeVisible();
});
