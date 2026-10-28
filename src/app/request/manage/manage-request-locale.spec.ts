import { expect, test } from "@playwright/test";

for (const locale of ["en", "pl"] as const) {
  for (const destination of ["home", "new"] as const) {
    test(`${locale} unavailable owner navigation to ${destination} preserves localized metadata`, async ({
      browser,
      baseURL,
    }) => {
      const context = await browser.newContext({
        locale: locale === "pl" ? "en" : "pl",
        baseURL,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const pl = locale === "pl";
      const managerTitle = pl
        ? "Zarządzaj prośbą o plik | Up - Remastered"
        : "Manage upload request | Up - Remastered";
      const title =
        destination === "home"
          ? "Up - Remastered"
          : pl
            ? "Poproś o plik | Up - Remastered"
            : "Request a file | Up - Remastered";
      await page.goto(`/request/manage?lang=${locale}`);
      await expect(page).toHaveTitle(managerTitle);
      await expect(
        page.getByRole("heading", {
          name: pl ? "Link właściciela niedostępny" : "Owner link unavailable",
        }),
      ).toBeVisible();
      await page
        .getByRole("link", {
          name:
            destination === "home"
              ? pl
                ? "← Strona główna"
                : "← Home"
              : pl
                ? "Utwórz nową prośbę"
                : "Create a new request",
          exact: true,
        })
        .click();
      await expect(page).toHaveURL(
        destination === "home" ? "/" : "/request/new",
      );
      await expect(page).toHaveTitle(title);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await page.goBack();
      await expect(page).toHaveTitle(managerTitle);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await page.goForward();
      await expect(page).toHaveTitle(title);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      expect(errors).toEqual([]);
      await context.close();
    });
  }

  for (const terminal of ["consumed", "revoked"] as const) {
    test(`${locale} direct owner manager reaches ${terminal} with private fragment handling`, async ({
      page,
      request,
    }) => {
      const pl = locale === "pl";
      const status = page.locator(
        'section[aria-labelledby="management-status"] > [role="status"]',
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const response = await request.post("/api/upload-requests", {
        data: {
          maxBytes: 1536,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      });
      expect(response.status()).toBe(201);
      const created = await response.json();
      const ownerUrl = new URL(created.managementUrl);
      await page.goto(`/request/manage?lang=${locale}${ownerUrl.hash}`);
      await expect(page).toHaveTitle(
        pl
          ? "Zarządzaj prośbą o plik | Up - Remastered"
          : "Manage upload request | Up - Remastered",
      );
      await expect(
        page.getByRole("heading", {
          name: pl ? "Zarządzaj prośbą o plik." : "Manage upload request.",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(
          pl
            ? "Sprawdź stan prośby lub unieważnij ją przed przesłaniem pliku."
            : "Check its status or revoke it before a file is uploaded.",
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: pl ? "Status prośby" : "Request status",
          exact: true,
        }),
      ).toBeVisible();
      expect(new URL(page.url()).hash).toBe("");
      await expect(status).toHaveText(pl ? "aktywna" : "active");
      await expect(
        page.getByText(pl ? "Limit przesyłania" : "Upload limit", {
          exact: true,
        }),
      ).toBeVisible();
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
      await expect(
        page.getByRole("link", {
          name: pl ? "Otwórz plik" : "Open file",
          exact: true,
        }),
      ).toHaveCount(0);
      if (terminal === "consumed") {
        const token = new URL(created.uploadUrl).pathname.split("/").at(-1);
        const uploaded = await request.post(
          `/api/upload-requests/${token}/upload`,
          {
            multipart: {
              file: {
                name: "owner-locale.txt",
                mimeType: "text/plain",
                buffer: Buffer.from("owner locale"),
              },
            },
          },
        );
        expect(uploaded.status()).toBe(201);
      } else {
        let deletes = 0;
        page.on("request", (req) => {
          if (req.method() === "DELETE") deletes++;
        });
        await page
          .getByRole("button", {
            name: pl ? "Unieważnij prośbę" : "Revoke request",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: pl ? "Anuluj" : "Cancel", exact: true })
          .click();
        expect(deletes).toBe(0);
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
        await expect(page.getByRole("dialog")).toHaveCount(0);
        expect(deletes).toBe(1);
      }
      await expect(status).toHaveText(
        terminal === "consumed"
          ? pl
            ? "wykorzystana"
            : "consumed"
          : pl
            ? "unieważniona"
            : "revoked",
      );
      const link = page.getByRole("link", {
        name: pl ? "Otwórz plik" : "Open file",
        exact: true,
      });
      if (terminal === "consumed")
        await expect(link).toHaveAttribute("href", `/${created.uploadId}`);
      else await expect(link).toHaveCount(0);
      await expect(
        page.getByRole("link", {
          name: pl ? "Utwórz nową prośbę" : "Create a new request",
          exact: true,
        }),
      ).toBeVisible();
      expect(errors).toEqual([]);
      await page
        .getByRole("link", {
          name: pl ? "Utwórz nową prośbę" : "Create a new request",
          exact: true,
        })
        .click();
      await expect(page).toHaveURL("/request/new");
      await expect(page).toHaveTitle(
        pl
          ? "Poproś o plik | Up - Remastered"
          : "Request a file | Up - Remastered",
      );
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await page.goBack();
      await expect(status).toHaveText(
        terminal === "consumed"
          ? pl
            ? "wykorzystana"
            : "consumed"
          : pl
            ? "unieważniona"
            : "revoked",
      );
      await expect(page).toHaveTitle(
        pl
          ? "Zarządzaj prośbą o plik | Up - Remastered"
          : "Manage upload request | Up - Remastered",
      );
      expect(new URL(page.url()).hash).toBe("");
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      expect(errors).toEqual([]);
    });
  }
}
