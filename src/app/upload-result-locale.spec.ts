import { expect, test } from "@playwright/test";

for (const locale of ["en", "pl"] as const) {
  test(`${locale} current result copy, QR and native share preserve public links`, async ({
    browser,
    baseURL,
  }) => {
    const pl = locale === "pl";
    const context = await browser.newContext({ locale, baseURL });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("private clipboard detail");
          },
        },
      });
      document.execCommand = () => false;
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          document.documentElement.dataset.shared = JSON.stringify(data);
          throw new DOMException("private share detail", "AbortError");
        },
      });
    });
    await page.goto("/");
    await page
      .getByLabel(pl ? "Wybierz plik" : "Choose file", { exact: true })
      .setInputFiles({
        name: "result.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Zażółć gęślą jaźń"),
      });
    const heading = page.getByRole("heading", { name: "result.txt" });
    await expect(heading).toBeFocused();
    await expect(
      page.getByText(pl ? "Przesyłanie ukończone" : "Upload complete", {
        exact: true,
      }),
    ).toBeVisible();
    const url = await page
      .getByLabel(pl ? "Link do udostępnienia" : "Share URL", { exact: true })
      .inputValue();
    expect(url).toMatch(/\/[0-9A-Z]{5}$/);
    const raw = await page.request.get(url);
    expect(await raw.text()).toBe("Zażółć gęślą jaźń");
    await expect(
      page.getByRole("link", {
        name: pl ? "Pobierz plik" : "Download file",
        exact: true,
      }),
    ).toHaveAttribute("href", `${url}?download=1`);
    await page
      .getByRole("button", {
        name: pl ? "Kopiuj URL" : "Copy URL",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("textbox", {
        name: pl ? "Link do skopiowania" : "Link to copy",
      }),
    ).toHaveValue(url);
    const qr = page.getByRole("button", {
      name: pl ? "Pokaż kod QR" : "Show QR code",
      exact: true,
    });
    await qr.click();
    await expect(
      page.getByRole("dialog", {
        name: pl ? "Zeskanuj, aby pobrać" : "Scan to download",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: pl ? "Kod QR przesłanego pliku" : "QR code for uploaded file",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: pl ? "Pobierz kod QR" : "Download QR code",
        exact: true,
      }),
    ).toHaveAttribute("download", /-qr\.svg$/);
    await page.keyboard.press("Escape");
    await expect(qr).toBeFocused();
    await page
      .getByRole("button", { name: pl ? "Udostępnij" : "Share", exact: true })
      .click();
    await expect
      .poll(() => page.locator("html").getAttribute("data-shared"))
      .not.toBeNull();
    const shared = JSON.parse(
      (await page.locator("html").getAttribute("data-shared"))!,
    );
    expect(shared).toEqual({
      title: pl ? "Udostępniony plik" : "Shared file",
      text: pl
        ? "Pobierz ten plik za pomocą linku."
        : "Download this file using the link.",
      url,
    });
    await expect(page.locator("body")).not.toContainText(
      "private share detail",
    );
    await expect(page.locator("body")).not.toContainText(
      "private clipboard detail",
    );
    await expect(
      page.getByText(
        pl
          ? "Udostępnianie nie powiodło się. Zamiast tego skopiuj link."
          : "Sharing did not complete. Use Copy link instead.",
      ),
    ).toHaveCount(0);
    await page
      .getByRole("button", {
        name: pl ? "Prześlij kolejny plik" : "Upload another file",
        exact: true,
      })
      .click();
    await expect(
      page.getByLabel(pl ? "Wybierz plik" : "Choose file", { exact: true }),
    ).toBeAttached();
    expect(errors).toEqual([]);
    await context.close();
  });
}
