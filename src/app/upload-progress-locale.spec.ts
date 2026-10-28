import { expect, test } from "@playwright/test";

for (const locale of ["en", "pl"] as const) {
  test(`${locale} upload transport errors, cancel/retry and protected progress`, async ({
    browser,
    baseURL,
  }) => {
    const pl = locale === "pl";
    const context = await browser.newContext({ locale, baseURL });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let mode = "held";
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/upload", async (route) => {
      if (mode === "held") {
        await held;
        await route.abort().catch(() => {});
      } else if (mode === "network") await route.abort("failed");
      else if (mode === "invalid")
        await route.fulfill({ status: 201, json: {} });
      else if (mode === "secret")
        await route.fulfill({
          status: 500,
          json: { error: { message: "secret #key=do-not-render" } },
        });
      else await route.continue();
    });
    await page.goto("/");
    const title = await page.title();
    const choose = () =>
      page
        .getByLabel(pl ? "Wybierz plik" : "Choose file", { exact: true })
        .setInputFiles({
          name: "żółć.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("Zażółć gęślą jaźń"),
        });
    await choose();
    await expect(
      page.getByText(pl ? "Przesyłanie" : "Uploading", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("progressbar", {
        name: pl ? "Postęp przesyłania" : "Upload progress",
      }),
    ).toHaveAttribute("aria-valuemin", "0");
    await page
      .getByRole("button", { name: pl ? "Anuluj" : "Cancel", exact: true })
      .click();
    release();
    await expect(
      page.getByLabel(pl ? "Wybierz plik" : "Choose file", { exact: true }),
    ).toBeFocused();
    await expect(page).toHaveTitle(title);
    for (const [failure, expected] of [
      [
        "network",
        pl
          ? "Błąd sieci. Sprawdź połączenie i spróbuj ponownie."
          : "Network error. Check your connection and try again.",
      ],
      [
        "invalid",
        pl
          ? "Przesyłanie zakończono, ale odpowiedź serwera była nieprawidłowa."
          : "Upload completed, but the server response was invalid.",
      ],
      [
        "secret",
        pl
          ? "Przesyłanie nie powiodło się. Spróbuj ponownie."
          : "Upload failed. Try again.",
      ],
    ]) {
      mode = failure;
      await choose();
      await expect(page.locator(".inline-error[role=alert]")).toContainText(
        expected,
      );
      await expect(page.locator("body")).not.toContainText("do-not-render");
      await expect(
        page.getByRole("heading", {
          name: pl ? "Coś poszło nie tak" : "Something went wrong",
        }),
      ).toBeFocused();
      await page
        .getByRole("button", {
          name: pl ? "Spróbuj ponownie" : "Try again",
          exact: true,
        })
        .click();
    }
    mode = "real";
    // Hold browser crypto to observe genuine pre-network indeterminate progress.
    await page.evaluate(() => {
      const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
      Object.assign(window, { releaseEncryption: null });
      crypto.subtle.encrypt = (...args: Parameters<typeof encrypt>) =>
        new Promise<ArrayBuffer>((resolve, reject) => {
          Object.assign(window, {
            releaseEncryption: () => encrypt(...args).then(resolve, reject),
          });
        });
    });
    await page
      .getByRole("button", {
        name: new RegExp(pl ? "Opcje zaawansowane" : "Advanced options"),
      })
      .click();
    await page
      .getByRole("switch", {
        name: pl ? "Chroń kluczem" : "Key protect",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: pl ? "Zamknij opcje zaawansowane" : "Close advanced options",
        exact: true,
      })
      .click();
    await choose();
    const progress = page.getByRole("progressbar", {
      name: pl ? "Postęp przesyłania" : "Upload progress",
    });
    await expect(progress).toHaveAttribute(
      "aria-valuetext",
      pl
        ? "Szyfrowanie; przesyłanie przez sieć jeszcze się nie rozpoczęło"
        : "Encrypting; network upload has not started",
    );
    await expect(progress).not.toHaveAttribute("aria-valuenow");
    await expect(page).toHaveTitle(
      new RegExp(pl ? "Szyfrowanie" : "Encrypting"),
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            typeof (window as unknown as { releaseEncryption: unknown })
              .releaseEncryption,
        ),
      )
      .toBe("function");
    await page.evaluate(() =>
      (
        window as unknown as { releaseEncryption: () => void }
      ).releaseEncryption(),
    );
    await expect(
      page.getByRole("heading", { name: "żółć.txt", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });
}
