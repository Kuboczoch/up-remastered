import { expect, test } from "@playwright/test";

// Owner capabilities and fragment keys must not enter traces or screenshots.
test.use({ trace: "off", screenshot: "off", video: "off" });

for (const protectedUpload of [false, true]) {
  test(`history-off current deletion: cancel, failure, retry (${protectedUpload ? "protected" : "plain"})`, async ({
    page,
    request,
  }) => {
    let owner: { id: string; accessToken: string } | undefined;
    let deleted = false;
    let deletes = 0;
    page.on("request", (outgoing) => {
      if (outgoing.method() === "DELETE") deletes++;
    });
    try {
      await page.goto("/");
      await page.getByRole("button", { name: "Advanced options" }).click();
      await expect(
        page.getByRole("switch", { name: "Save history" }),
      ).not.toBeChecked();
      if (protectedUpload)
        await page.getByRole("switch", { name: "Key protect" }).check();
      await page
        .getByRole("button", { name: "Close advanced options" })
        .click();
      const uploaded = page.waitForResponse("**/api/upload");
      await page.locator("#file-picker").setInputFiles({
        name: "disposable-current.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("current deletion regression"),
      });
      const response = await uploaded;
      expect(response.status()).toBe(201);
      const body = await response.json();
      owner = { id: body.upload.id, accessToken: body.accessToken };
      expect(
        typeof owner.accessToken === "string" && owner.accessToken.length > 0,
      ).toBe(true);
      await expect(
        page.getByRole("button", { name: "Copy URL" }),
      ).toBeVisible();
      const hasKey = await page
        .getByRole("textbox", { name: "Share URL" })
        .evaluate(
          (element: HTMLInputElement) => new URL(element.value).hash.length > 0,
        );
      expect(hasKey).toBe(protectedUpload);
      const trigger = page.getByRole("button", {
        name: "Delete file",
        exact: true,
      });
      await trigger.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText(
        "Existing sharing links will stop working",
      );
      const cancel = dialog.getByRole("button", { name: "Cancel" });
      const confirm = dialog.getByRole("button", {
        name: "Permanently delete file",
      });
      await expect(cancel).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(confirm).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(cancel).toBeFocused();
      await cancel.click();
      await expect(trigger).toBeFocused();
      await trigger.click();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      expect(deletes).toBe(0);
      const deleteRoute = "**/api/u/*";
      await page.route(deleteRoute, (route) =>
        route.request().method() === "DELETE"
          ? route.fulfill({ status: 403, json: { success: false } })
          : route.continue(),
      );
      await trigger.click();
      await confirm.click();
      await expect(dialog.getByRole("alert")).toBeVisible();
      await cancel.click();
      await expect(
        page.getByRole("button", { name: "Copy URL" }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Open file" })).toBeVisible();
      const preservedKey = await page
        .getByRole("textbox", { name: "Share URL" })
        .evaluate(
          (element: HTMLInputElement) => new URL(element.value).hash.length > 0,
        );
      expect(preservedKey).toBe(protectedUpload);
      await page.unroute(deleteRoute);
      await trigger.click();
      const deletion = page.waitForResponse(
        (response) => response.request().method() === "DELETE",
      );
      await confirm.click();
      const confirmed = await deletion;
      expect(confirmed.status()).toBe(200);
      expect(await confirmed.text()).toBe("");
      deleted = true;
      await expect(page.getByText("Deleted", { exact: true })).toBeVisible();
      await expect(
        page.getByText("Upload complete", { exact: true }),
      ).toHaveCount(0);
      for (const label of ["Copy URL", "Show QR code", "Delete file"]) {
        await expect(
          page.getByRole("button", { name: label, exact: true }),
        ).toHaveCount(0);
      }
      for (const label of ["Open file", "Download file"]) {
        await expect(page.getByRole("link", { name: label })).toHaveCount(0);
      }
      await expect(page.locator(".result-card")).toBeFocused();
      expect(deletes).toBe(2);
      const disabledStorageIntact = await page.evaluate(
        () =>
          localStorage.getItem("up-remastered:history-enabled") === null &&
          localStorage.getItem("up-remastered:upload-history:v1") === null &&
          sessionStorage.getItem("up-remastered:upload-history:v1") === null,
      );
      expect(disabledStorageIntact).toBe(true);
      // Assert boolean only: no capability-bearing URL in a failed assertion.
      const unavailable = await request.get(`/api/u/${owner.id}/details`);
      expect(unavailable.status() === 404).toBe(true);
      await page.getByRole("button", { name: "Upload another file" }).click();
      await expect(page.getByText("Deleted", { exact: true })).toHaveCount(0);
    } finally {
      if (owner && !deleted) {
        const cleanup = await request.delete(`/api/u/${owner.id}`, {
          data: { accessToken: owner.accessToken },
        });
        expect(cleanup.status() === 200 && (await cleanup.text()) === "").toBe(
          true,
        );
      }
    }
  });
}
