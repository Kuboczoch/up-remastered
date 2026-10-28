import { chromium, expect, test } from "@playwright/test";

for (const locale of ["en", "pl"] as const) {
  for (const environment of [
    "insecure HTTP",
    "missing Web Crypto",
    "localhost",
  ] as const) {
    test(`${locale}: upfront Key protect availability on ${environment}`, async ({
      browser,
      baseURL,
    }) => {
      const insecure = environment === "insecure HTTP";
      const isolated = insecure
        ? await chromium.launch({
            args: [
              "--host-resolver-rules=MAP key-protect.test 127.0.0.1",
              "--no-proxy-server",
            ],
          })
        : undefined;
      const context = await (isolated ?? browser).newContext({ locale });
      try {
        if (environment === "missing Web Crypto") {
          await context.addInitScript(() => {
            Object.defineProperty(window.crypto, "subtle", {
              value: undefined,
            });
          });
        }
        const page = await context.newPage();
        let uploads = 0;
        page.on("request", (request) => {
          if (request.method() === "POST") uploads++;
        });
        const origin = new URL(baseURL!);
        if (insecure) origin.hostname = "key-protect.test";
        await page.goto(origin.href);
        expect(await page.evaluate(() => window.isSecureContext)).toBe(
          !insecure,
        );
        const pl = locale === "pl";
        await page
          .getByRole("button", {
            name: pl ? "Opcje zaawansowane" : "Advanced options",
          })
          .click();
        const control = page.getByRole("switch", {
          name: pl ? "Chroń kluczem" : "Key protect",
        });
        await expect(control).not.toBeChecked();
        const warning = page.getByText(
          pl
            ? "Ochrona kluczem wymaga HTTPS (lub localhost) i Web Crypto. Zwykłe przesyłanie pozostaje dostępne."
            : "Key protection requires HTTPS (or localhost) and Web Crypto. Plain uploads remain available.",
        );
        if (environment === "localhost") {
          await expect(control).toBeEnabled();
          await control.check();
          await expect(control).toBeChecked();
          await expect(warning).toHaveCount(0);
        } else {
          await expect(control).toBeDisabled();
          await expect(warning).toBeVisible();
          await expect(control).toHaveAccessibleDescription(
            await warning.innerText(),
          );
        }
        expect(uploads).toBe(0);
        if (environment !== "localhost") {
          await page
            .getByRole("button", {
              name: pl
                ? "Zamknij opcje zaawansowane"
                : "Close advanced options",
            })
            .click();
          const bytes = Buffer.from(
            `Plain upload remains available: ${locale}`,
          );
          await page.locator("#file-picker").setInputFiles({
            name: "plain-availability.txt",
            mimeType: "text/plain",
            buffer: bytes,
          });
          await expect(page.locator("#share-url")).toBeVisible();
          const share = new URL(await page.locator("#share-url").inputValue());
          expect(share.hash).toBe("");
          expect(share.pathname).not.toContain("/decrypt/");
          const response = await context.request.get(
            new URL(share.pathname, baseURL!).href,
          );
          expect(response.status()).toBe(200);
          expect(await response.body()).toEqual(bytes);
          expect(uploads).toBe(1);

          let ciphertextRequests = 0;
          page.on("request", (request) => {
            if (new URL(request.url()).pathname === "/A7K2Q")
              ciphertextRequests++;
          });
          // A syntactically valid key must not trigger even a counted fetch
          // when the recipient cannot decrypt in this browser environment.
          await page.goto(
            new URL(`/decrypt/A7K2Q#key=${"A".repeat(43)}`, origin).href,
          );
          const decrypt = page.getByRole("button", {
            name: pl ? "Odszyfruj plik" : "Decrypt file",
            exact: true,
          });
          await expect(decrypt).toBeEnabled();
          expect(ciphertextRequests).toBe(0);
          await decrypt.click();
          await expect(
            page.locator(".decrypt-experience").getByRole("alert"),
          ).toContainText("HTTPS");
          await expect(decrypt).toBeEnabled();
          expect(ciphertextRequests).toBe(0);
        }
      } finally {
        await context.close();
        await isolated?.close();
      }
    });
  }
}
