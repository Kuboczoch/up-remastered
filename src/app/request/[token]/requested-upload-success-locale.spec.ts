import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

for (const locale of ["en", "pl"] as const) {
  test(`${locale} real recipient receipt preserves public links, file bytes and copy privacy`, async ({
    page,
  }) => {
    const pl = locale === "pl";
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      });
      document.execCommand = () => false;
    });
    const response = await page.request.post("/api/upload-requests", {
      data: {
        maxBytes: 4096,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });
    expect(response.status()).toBe(201);
    const created = await response.json();
    const filename = "raport-Łódź.txt";
    const bytes = Buffer.alloc(2560, "x");
    await page.goto(`${created.uploadUrl}?lang=${locale}`);
    await page
      .getByLabel(pl ? "Wybierz plik" : "Choose file")
      .setInputFiles({ name: filename, mimeType: "text/plain", buffer: bytes });
    const completion = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/upload"),
    );
    await page
      .getByRole("button", { name: pl ? "Prześlij plik" : "Upload file" })
      .click();
    const uploadResponse = await completion;
    expect(uploadResponse.ok()).toBe(true);
    const { upload } = await uploadResponse.json();
    const heading = page.getByRole("heading", {
      name: pl ? "Przesyłanie ukończone" : "Upload complete",
    });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    // Preserve the authoritative server filename, including existing sanitization.
    await expect(
      page.getByText(upload.originalName, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(pl ? "2,5 KiB" : "2.5 KiB", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(pl ? "Plik wygasa" : "File expires"),
    ).toBeVisible();
    const section = heading.locator("..");
    const time = section.locator("time");
    const datetime = await time.getAttribute("datetime");
    const expectedTime = await page.evaluate(
      ({ datetime, locale }) =>
        new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(datetime!)),
      { datetime, locale },
    );
    await expect(time).toHaveText(expectedTime);
    const url = await section
      .getByRole("link", { name: pl ? "Otwórz plik" : "Open file" })
      .getAttribute("href");
    expect(url).toMatch(
      new RegExp(`^${new URL(created.uploadUrl).origin}/[A-Za-z0-9]{5}$`),
    );
    expect(url).not.toContain(created.managementToken);
    expect(url).not.toContain(new URL(created.uploadUrl).pathname);
    await expect(
      section.getByRole("link", {
        name: pl ? "Pobierz plik" : "Download file",
      }),
    ).toHaveAttribute("href", `${url}?download=1`);
    await section
      .getByRole("button", { name: pl ? "Kopiuj link" : "Copy link" })
      .click();
    const input = section.getByLabel(
      pl
        ? "Link do pliku do ręcznego skopiowania"
        : "File link for manual copying",
    );
    await expect(input).toHaveValue(url!);
    await expect(input).toHaveAttribute("readonly", "");
    await expect(
      section.getByRole("button", {
        name: pl ? "Skopiowano" : "Copied",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(await section.innerHTML()).not.toContain(created.managementToken);
    const download = await page.request.get(`${url}?download=1`);
    expect(download.status()).toBe(200);
    expect(await download.body()).toEqual(bytes);
    const browserDownload = page.waitForEvent("download");
    const downloadResponse = page.waitForResponse(`${url}?download=1`);
    await section
      .getByRole("link", { name: pl ? "Pobierz plik" : "Download file" })
      .click();
    const downloaded = await browserDownload;
    expect(
      await (await downloadResponse).request().headerValue("referer"),
    ).toBeNull();
    expect(downloaded.suggestedFilename()).toBe(upload.originalName);
    expect(await readFile((await downloaded.path())!)).toEqual(bytes);

    // Follow the actual public link, not merely an API client request. Recipient
    // capability URLs must not leak in Referer, and raw bytes stay untranslated.
    const opened = page.waitForResponse(
      (response) =>
        response.url() === url && response.request().isNavigationRequest(),
    );
    await section
      .getByRole("link", { name: pl ? "Otwórz plik" : "Open file" })
      .click();
    const rawResponse = await opened;
    expect(rawResponse.status()).toBe(200);
    expect(await rawResponse.body()).toEqual(bytes);
    expect(await rawResponse.request().headerValue("referer")).toBeNull();
    await expect(page).toHaveURL(url!);
    await page.goBack();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page).toHaveTitle(
      pl
        ? "Prześlij zamówiony plik | Up - Remastered"
        : "Upload a requested file | Up - Remastered",
    );
    await expect(
      page.getByRole("heading", {
        name: pl
          ? "Ta prośba o plik została już wykorzystana"
          : "This upload request has already been used",
      }),
    ).toBeVisible();
  });
}
