import { expect, test } from "@playwright/test";

for (const locale of ["en", "pl"] as const) {
  for (const terminal of ["consumed", "revoked", "expired"] as const) {
    test(`${locale} created request reaches ${terminal} with localized owner feedback`, async ({
      page,
      request,
    }) => {
      const pl = locale === "pl";
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`/request/new?lang=${locale}`);
      if (terminal === "expired") {
        await page.route("**/api/upload-requests", (route) =>
          route.continue({
            postData: JSON.stringify({
              ...route.request().postDataJSON(),
              expiresAt: new Date(Date.now() + 6000).toISOString(),
            }),
          }),
        );
      }
      const creation = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/upload-requests") &&
          response.request().method() === "POST",
      );
      await page
        .getByRole("button", {
          name: pl ? "Utwórz prośbę o plik" : "Create upload request",
          exact: true,
        })
        .click();
      const created = await (await creation).json();
      await expect(
        page.getByRole("heading", {
          name: pl ? "Utworzono prośbę o plik" : "Upload request created",
        }),
      ).toBeVisible();
      await expect(
        page.getByText(pl ? "Oczekiwanie na plik." : "Waiting for upload.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: created.managementUrl, exact: true }),
      ).toHaveAttribute("href", created.managementUrl);
      await expect(
        page.getByRole("link", {
          name: pl ? "Otwórz plik" : "Open file",
          exact: true,
        }),
      ).toHaveCount(0);
      // Force the real browser's clipboard fallback without altering capability URLs.
      await page.evaluate(() =>
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { writeText: () => Promise.reject(new Error("denied")) },
        }),
      );
      await page
        .getByRole("button", {
          name: pl ? "Kopiuj link właściciela" : "Copy owner link",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("textbox", {
          name: pl ? "Link do skopiowania" : "Link to copy",
          exact: true,
        }),
      ).toHaveValue(created.managementUrl);
      if (terminal === "consumed") {
        const token = new URL(created.uploadUrl).pathname.split("/").at(-1);
        const uploaded = await request.post(
          `/api/upload-requests/${token}/upload`,
          {
            multipart: {
              file: {
                name: "localized-owner.txt",
                mimeType: "text/plain",
                buffer: Buffer.from("Localized lifecycle acceptance"),
              },
            },
          },
        );
        expect(uploaded.status()).toBe(201);
      } else if (terminal === "revoked") {
        await page
          .getByRole("button", {
            name: pl ? "Unieważnij prośbę" : "Revoke request",
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("button", {
            name: pl ? "Anuluj" : "Cancel",
            exact: true,
          }),
        ).toBeFocused();
        await page
          .getByRole("button", { name: pl ? "Anuluj" : "Cancel", exact: true })
          .click();
        await expect(
          page.getByText(pl ? "Oczekiwanie na plik." : "Waiting for upload.", {
            exact: true,
          }),
        ).toBeVisible();
        await page
          .getByRole("button", {
            name: pl ? "Unieważnij prośbę" : "Revoke request",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", {
            name: pl
              ? "Potwierdź unieważnienie prośby"
              : "Confirm revoke request",
            exact: true,
          })
          .click();
      }
      const status = pl
        ? {
            consumed: "wykorzystana",
            revoked: "unieważniona",
            expired: "wygasła",
          }[terminal]
        : terminal;
      await expect(
        page
          .locator("[role=status]")
          .filter({ hasText: new RegExp(`^Status: ${status}$`) }),
      ).toBeVisible({ timeout: 10000 });
      await expect(
        page.getByRole("button", {
          name: pl ? "Unieważnij prośbę" : "Revoke request",
          exact: true,
        }),
      ).toHaveCount(0);
      const file = page.getByRole("link", {
        name: pl ? "Otwórz plik" : "Open file",
        exact: true,
      });
      if (terminal === "consumed")
        await expect(file).toHaveAttribute("href", `/${created.uploadId}`);
      else await expect(file).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
}
