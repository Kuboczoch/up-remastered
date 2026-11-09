import { expect, test } from "@playwright/test";

for (const locale of ["en", "pl"] as const) {
  test(`${locale} upload input SSR, validation, keyboard navigation and auto-paste`, async ({
    browser,
    request,
    baseURL,
  }) => {
    const pl = locale === "pl";
    const heading = pl
      ? "Udostępniaj tymczasowe pliki i tekst."
      : "Share temporary files and text.";
    const response = await request.get("/", {
      headers: { "Accept-Language": locale },
    });
    expect(await response.text()).toContain(heading);
    expect(response.headers()["content-language"]).toBe(locale);
    const context = await browser.newContext({ locale, baseURL });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let uploads = 0;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().endsWith("/api/upload"))
        uploads++;
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    const file = page.getByLabel(pl ? "Wybierz plik" : "Choose file", {
      exact: true,
    });
    await file.setInputFiles({
      name: "żółć.txt",
      mimeType: "text/plain",
      buffer: Buffer.alloc(8192),
    });
    const alert = page.locator(".inline-error[role=alert]");
    await expect(alert).toContainText(
      pl ? "Maksymalny rozmiar to 4 KiB." : "Maximum size is 4 KiB.",
    );
    await expect(alert).toContainText("żółć.txt");
    await expect(
      page.getByRole("heading", {
        name: pl ? "Coś poszło nie tak" : "Something went wrong",
      }),
    ).toBeFocused();
    expect(uploads).toBe(0);
    await page
      .getByRole("button", {
        name: pl ? "Spróbuj ponownie" : "Try again",
        exact: true,
      })
      .click();
    const fileTab = page.getByRole("tab", {
      name: pl ? "Plik" : "File",
      exact: true,
    });
    await fileTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: pl ? "Tekst" : "Text", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", {
        name: pl ? "Prześlij tekst" : "Upload text",
        exact: true,
      })
      .click();
    await expect(alert).toContainText(
      pl
        ? "Wpisz lub wklej tekst przed przesłaniem."
        : "Enter or paste text before uploading.",
    );
    await page
      .getByRole("button", {
        name: pl ? "Spróbuj ponownie" : "Try again",
        exact: true,
      })
      .click();
    const text = page.getByPlaceholder(
      pl ? "Wklej lub wpisz tekst" : "Paste or type text",
    );
    await text.fill("Zażółć gęślą jaźń");
    expect(uploads).toBe(0);
    await page
      .getByRole("button", {
        name: pl ? "Prześlij tekst" : "Upload text",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: /^text-.*\.txt$/ }),
    ).toBeVisible();
    // Deliberately retain master auto-paste behavior on the workspace.
    await page
      .getByRole("button", {
        name: pl ? "Prześlij kolejny plik" : "Upload another file",
        exact: true,
      })
      .click();
    await page.locator(".upload-workspace").evaluate((element) => {
      const data = new DataTransfer();
      data.setData("text/plain", "Automatyczne wklejanie");
      element.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: data,
        }),
      );
    });
    await expect(
      page.getByRole("heading", { name: "pasted-text.txt" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });
}
