import { expect, test } from "@playwright/test";

for (const locale of ["en", "pl"] as const) {
  for (const unavailable of [false, true]) {
    test(`${locale} history-off deletion ${unavailable ? "already unavailable" : "deleted"} retains confirmation and retry`, async ({
      browser,
      baseURL,
    }) => {
      const pl = locale === "pl";
      const context = await browser.newContext({ locale, baseURL });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/");
      const receiptPromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().endsWith("/api/upload"),
      );
      await page
        .getByLabel(pl ? "Wybierz plik" : "Choose file", { exact: true })
        .setInputFiles({
          name: "delete.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("Zażółć"),
        });
      const receipt = await (await receiptPromise).json();
      const url = await page
        .getByLabel(pl ? "Link do udostępnienia" : "Share URL", { exact: true })
        .inputValue();
      expect(
        await page.evaluate(() =>
          localStorage.getItem("up-remastered:upload-history:v1"),
        ),
      ).toBeNull();
      const trigger = page.getByRole("button", {
        name: pl ? "Usuń plik" : "Delete file",
        exact: true,
      });
      await trigger.click();
      const dialog = page.getByRole("dialog", {
        name: pl ? "Usunąć delete.txt?" : "Delete delete.txt?",
      });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("button", {
          name: pl ? "Anuluj" : "Cancel",
          exact: true,
        }),
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      expect((await page.request.get(url)).status()).toBe(200);
      const endpoint = `**/api/u/${receipt.upload.id}`;
      await page.route(endpoint, (route) =>
        route.fulfill({ status: 502, body: "private-owner-detail" }),
      );
      await trigger.click();
      const confirm = dialog.getByRole("button", {
        name: pl ? "Usuń plik na stałe" : "Permanently delete file",
        exact: true,
      });
      await confirm.click();
      await expect(dialog.getByRole("alert")).toHaveText(
        pl
          ? "Nie potwierdzono usunięcia. Link do pliku został zachowany; spróbuj ponownie."
          : "Deletion was not confirmed. Your file link is retained; please retry.",
      );
      await expect(
        page.getByLabel(pl ? "Link do udostępnienia" : "Share URL", {
          exact: true,
        }),
      ).toHaveValue(url);
      await page.unroute(endpoint);
      if (unavailable) {
        const deleted = await page.request.delete(
          `/api/u/${receipt.upload.id}`,
          { data: { accessToken: receipt.accessToken } },
        );
        expect(deleted.status()).toBe(200);
      }
      const deletion = page.waitForResponse(
        (response) =>
          response.request().method() === "DELETE" &&
          response.url().endsWith(`/api/u/${receipt.upload.id}`),
      );
      await confirm.click();
      expect((await deletion).status()).toBe(unavailable ? 404 : 200);
      await expect(
        page.getByRole("heading", {
          name: unavailable
            ? pl
              ? "Plik niedostępny"
              : "File unavailable"
            : pl
              ? "Plik usunięty"
              : "File deleted",
          exact: true,
        }),
      ).toBeFocused();
      await expect(
        page.getByText(
          pl
            ? "Zapisane linki już nie działają. Usunięcia z serwera nie można cofnąć."
            : "Saved links no longer work. Server deletion cannot be undone.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByLabel(pl ? "Link do udostępnienia" : "Share URL", {
          exact: true,
        }),
      ).toHaveCount(0);
      expect((await page.request.get(url)).status()).toBe(404);
      expect(await page.locator("body").innerText()).not.toContain(
        receipt.accessToken,
      );
      expect(await page.locator("body").innerText()).not.toContain(
        "private-owner-detail",
      );
      expect(
        await page.evaluate(() =>
          localStorage.getItem("up-remastered:upload-history:v1"),
        ),
      ).toBeNull();
      await page
        .getByRole("button", {
          name: pl ? "Prześlij kolejny plik" : "Upload another file",
          exact: true,
        })
        .click();
      await expect(
        page.getByLabel(pl ? "Wybierz plik" : "Choose file", { exact: true }),
      ).toBeFocused();
      expect(errors).toEqual([]);
      await context.close();
    });
  }
}
