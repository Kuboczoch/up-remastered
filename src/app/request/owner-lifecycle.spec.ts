import { expect, test, type Page } from "@playwright/test";

async function expectWaiting(page: Page) {
  await expect(
    page.getByText("Waiting for upload.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open file" })).toHaveCount(0);
  await expect(page.getByText(/Uploaded file:/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Revoke request" }),
  ).toBeEnabled();
}

for (const terminal of ["consumed", "revoked", "expired"] as const) {
  test(`owner creation and direct manager stay consistent through ${terminal}`, async ({
    page,
    request,
    context,
  }) => {
    await page.goto("/request/new");
    if (terminal === "expired") {
      await page.route("**/api/upload-requests", async (route) => {
        await route.continue({
          postData: JSON.stringify({
            ...route.request().postDataJSON(),
            expiresAt: new Date(Date.now() + 6000).toISOString(),
          }),
        });
      });
    }
    const creation = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/upload-requests") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Create upload request" }).click();
    const created = await (await creation).json();
    const { managementToken, managementUrl, uploadUrl, uploadId } = created;
    expect(uploadId).toMatch(/^[A-Za-z0-9]{5}$/);
    await expectWaiting(page);

    const manager = await context.newPage();
    await manager.goto(managementUrl);
    await expectWaiting(manager);
    await manager.reload();
    await expectWaiting(manager);
    // Proves URL reservation is not a file, while keeping the reserved ID stable.
    const reserved = await request.get(`/${uploadId}`);
    expect(reserved.status()).toBe(404);

    if (terminal === "consumed") {
      const token = new URL(uploadUrl).pathname.split("/").at(-1);
      const uploaded = await request.post(
        `/api/upload-requests/${token}/upload`,
        {
          multipart: {
            file: {
              name: "owner-lifecycle.txt",
              mimeType: "text/plain",
              buffer: Buffer.from("Owner lifecycle preview acceptance"),
            },
          },
        },
      );
      expect(uploaded.status()).toBe(201);
      expect((await uploaded.json()).key).toBe(uploadId);
    } else if (terminal === "revoked") {
      await manager.getByRole("button", { name: "Revoke request" }).click();
    }

    for (const owner of [page, manager]) {
      await expect(owner.getByRole("status")).toContainText(terminal, {
        timeout: 10000,
      });
      await expect(
        owner.getByRole("button", { name: "Revoke request" }),
      ).toHaveCount(0);
      if (terminal === "consumed") {
        await expect(
          owner.getByRole("link", { name: "Open file" }),
        ).toHaveAttribute("href", `/${uploadId}`);
      } else {
        await expect(
          owner.getByRole("link", { name: "Open file" }),
        ).toHaveCount(0);
        await expect(
          owner.getByText(/Create a new request to receive a file\./),
        ).toBeVisible();
      }
    }
    await manager.reload();
    await expect(manager.getByRole("status")).toHaveText(terminal);
    await expect(
      manager.getByRole("button", { name: "Revoke request" }),
    ).toHaveCount(0);
    if (terminal === "consumed") {
      const openedFile = manager.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/${uploadId}` &&
          response.request().method() === "GET",
      );
      await manager.getByRole("link", { name: "Open file" }).click();
      const fileResponse = await openedFile;
      expect(fileResponse.status()).toBe(200);
      expect(fileResponse.headers()["content-type"]).toContain("text/plain");
      expect(await fileResponse.text()).toBe(
        "Owner lifecycle preview acceptance",
      );
      // Text files deliberately retain their raw contract; no HTML heading
      // or wrapper is expected solely because the browser followed Open file.
      // Only the owner capability can claim this received file for deletion.
      const claim = await request.post("/api/upload-requests/manage/claim", {
        headers: { authorization: `Bearer ${managementToken}` },
      });
      expect(claim.status()).toBe(200);
      expect((await claim.json()).uploadId).toBe(uploadId);
    }
    await manager.close();
  });
}
