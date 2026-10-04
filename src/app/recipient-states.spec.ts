import { expect, test, type Page } from "@playwright/test";

async function createRequest(page: Page, lifetime = 3600_000) {
  const response = await page.request.post("/api/upload-requests", {
    data: {
      maxBytes: 1024,
      expiresAt: new Date(Date.now() + lifetime).toISOString(),
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as {
    uploadUrl: string;
    managementToken: string;
  };
}

test("readable limits and UTC expiry match oversize validation and used-link guidance", async ({
  page,
}) => {
  const created = await createRequest(page);
  await page.goto(created.uploadUrl);
  await expect(
    page.getByText("Maximum 1 KiB. This link is single-use."),
  ).toBeVisible();
  await expect(page.getByText(/Expires in/)).toBeVisible();
  await expect(page.locator("time")).toContainText("UTC");
  await expect(page.locator("time")).toHaveAttribute("datetime", /Z$/);
  const oversizedInput = page.getByLabel("Choose file");
  await oversizedInput.setInputFiles({
    name: "disposable.txt",
    mimeType: "text/plain",
    buffer: Buffer.alloc(1025),
  });
  await page.getByRole("button", { name: "Upload file" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "The file must be no larger than 1 KiB.",
  );
  const fileInput = page.getByLabel("Choose file");
  await fileInput.setInputFiles({
    name: "disposable.txt",
    mimeType: "text/plain",
    buffer: Buffer.alloc(16),
  });
  await page.getByRole("button", { name: "Upload file" }).click();
  await expect(
    page.getByRole("heading", { name: "Upload complete" }),
  ).toBeVisible();
  await page.goto(created.uploadUrl);
  await expect(page.getByRole("heading")).toHaveText(
    "This upload request has already been used",
  );
  await expect(
    page.getByText(/Ask the sender for a new request/),
  ).toBeVisible();
  await expect(page.getByLabel("Choose file")).toHaveCount(0);
});

test("revocation of an open form blocks resubmission and exposes only safe page guidance", async ({
  page,
}) => {
  const created = await createRequest(page);
  await page.goto(created.uploadUrl);
  const response = await page.request.delete("/api/upload-requests/manage", {
    headers: { Authorization: `Bearer ${created.managementToken}` },
  });
  expect(response.status()).toBe(200);
  const fileInput = page.getByLabel("Choose file");
  await fileInput.setInputFiles({
    name: "disposable.txt",
    mimeType: "text/plain",
    buffer: Buffer.alloc(16),
  });
  await page.getByRole("button", { name: "Upload file" }).click();
  await expect(
    page.getByRole("button", { name: "Upload file" }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Do not retry");
  await page.getByRole("link", { name: "Check request status" }).click();
  await expect(page.getByRole("heading")).toHaveText(
    "This upload request was revoked",
  );
  await expect(page.getByLabel("Choose file")).toHaveCount(0);
  expect(await page.locator("body").textContent()).not.toContain(
    created.managementToken,
  );
  await page.goto("/request/invalid");
  await expect(page.getByText(/Check the link with the person/)).toBeVisible();
});

test("expired request asks for a new link, not another upload", async ({
  page,
}) => {
  const created = await createRequest(page, 3000);
  await expect
    .poll(
      async () => {
        await page.goto(created.uploadUrl);
        return await page.getByRole("heading").textContent();
      },
      { timeout: 10000 },
    )
    .toBe("This upload request has expired");
  await expect(
    page.getByText(/Ask the sender for a new request/),
  ).toBeVisible();
  await expect(page.getByLabel("Choose file")).toHaveCount(0);
});
