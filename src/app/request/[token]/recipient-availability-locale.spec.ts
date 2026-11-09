import { expect, test } from "@playwright/test";

for (const locale of ["en", "pl"] as const) {
  for (const terminal of ["consumed", "revoked"] as const) {
    test(`${locale} recipient SSR availability follows real ${terminal} transition`, async ({
      browser,
      request,
    }) => {
      const pl = locale === "pl";
      // JavaScript disabled: prove initial server HTML, not hydration translation.
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      try {
        const createdResponse = await request.post("/api/upload-requests", {
          data: {
            maxBytes: 1536,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
        });
        expect(createdResponse.status()).toBe(201);
        const created = await createdResponse.json();
        const path = new URL(created.uploadUrl).pathname;
        const token = path.split("/").at(-1);
        const visit = async () => {
          const response = await page.goto(`${path}?lang=${locale}`);
          expect(response?.status()).toBe(200);
          const vary = response
            ?.headers()
            ["vary"].toLowerCase()
            .split(/\s*,\s*/);
          expect(vary).toEqual(
            expect.arrayContaining(["accept-language", "cookie", "rsc"]),
          );
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          await expect(page).toHaveTitle(
            pl ? /Prześlij zamówiony plik/ : /Upload a requested file/,
          );
        };
        await visit();
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          pl ? "Wyślij zamówiony plik" : "Send a requested file",
        );
        await expect(page.locator('input[type="file"]')).toHaveCount(1);
        await expect(
          page.getByLabel(pl ? "Wybierz plik" : "Choose file"),
        ).toBeVisible();
        await expect(
          page.getByText(
            pl
              ? "Maksymalnie 1,5 KiB. Ten link jest jednorazowy."
              : "Maximum 1.5 KiB. This link is single-use.",
          ),
        ).toBeVisible();
        await expect(
          page.getByRole("button", {
            name: pl ? "Prześlij plik" : "Upload file",
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.locator("time")).toHaveAttribute(
          "datetime",
          created.expiresAt,
        );
        if (terminal === "consumed") {
          const uploaded = await request.post(
            `/api/upload-requests/${token}/upload`,
            {
              multipart: {
                file: {
                  name: "recipient-locale.txt",
                  mimeType: "text/plain",
                  buffer: Buffer.from("recipient locale"),
                },
              },
            },
          );
          expect(uploaded.status()).toBe(201);
          const receipt = await uploaded.json();
          expect(receipt.key).toBe(created.uploadId);
        } else {
          const revoked = await request.delete("/api/upload-requests/manage", {
            headers: { authorization: `Bearer ${created.managementToken}` },
          });
          expect(revoked.status()).toBe(200);
        }
        await visit();
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          terminal === "consumed"
            ? pl
              ? "Ta prośba o plik została już wykorzystana"
              : "This upload request has already been used"
            : pl
              ? "Ta prośba o plik została unieważniona"
              : "This upload request was revoked",
        );
        await expect(page.locator('input[type="file"]')).toHaveCount(0);
        await expect(
          page.getByRole("link", {
            name: pl ? "← Strona główna" : "← Home",
            exact: true,
          }),
        ).toHaveAttribute("href", "/");
        expect(await page.locator("body").innerText()).not.toContain(
          created.managementToken,
        );
      } finally {
        await context.close();
      }
    });
  }
  test(`${locale} invalid recipient initial HTML gives safe guidance`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto(`/request/not-a-valid-token?lang=${locale}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        locale === "pl"
          ? "Ta prośba o plik jest nieprawidłowa"
          : "This upload request is invalid",
      );
      await expect(page.locator('input[type="file"]')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}
