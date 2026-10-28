import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

for (const locale of ["en", "pl"] as const) {
  test(`${locale} decrypt SSR, consent, wrong-key retry and byte-preserving save`, async ({
    page,
    request,
  }) => {
    const pl = locale === "pl";
    const title = pl ? "Odszyfruj plik" : "Decrypt your file";
    const initial = await request.get(`/decrypt/example?lang=${locale}`);
    expect(initial.status()).toBe(200);
    expect(initial.headers()["content-language"]).toBe(locale);
    const vary = initial.headers().vary.toLowerCase().split(/,\s*/);
    expect(vary).toEqual(
      expect.arrayContaining(["rsc", "accept-language", "cookie"]),
    );
    const html = await initial.text();
    expect(html).toContain(`<html lang="${locale}"`);
    expect(html).toContain(`<title>${title}`);
    expect(html).toContain(title);
    expect(html).toContain('<meta name="referrer" content="no-referrer"');

    // Use the existing real protected uploader; this phase does not localize it.
    await page.goto("/?lang=en");
    await page.getByRole("button", { name: /Advanced options/ }).click();
    await page.getByRole("switch", { name: "Key protect" }).check();
    await page.locator("#download-limit").fill("1");
    await page.getByRole("button", { name: "Close advanced options" }).click();
    const bytes = Buffer.alloc(2560, "x");
    const name = "raport-Łódź.txt";
    await page
      .locator("#file-picker")
      .setInputFiles({ name, mimeType: "text/plain", buffer: bytes });
    await expect(page.getByRole("heading", { name }).first()).toBeVisible();
    const url = new URL(await page.locator("#share-url").inputValue());
    const key = url.hash.slice(5);
    const rawPath = url.pathname.replace("/decrypt", "");
    let rawFetches = 0;
    const traffic: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (r) => {
      traffic.push(
        r.url() + JSON.stringify(r.headers()) + (r.postData() ?? ""),
      );
      if (new URL(r.url()).pathname === rawPath) rawFetches++;
    });
    // Missing key proves no automatic ciphertext fetch on landing.
    await page.goto(`${url.origin}${url.pathname}?lang=${locale}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    const input = page.getByLabel(
      pl ? "Klucz odszyfrowywania" : "Decryption key",
    );
    const decrypt = page.getByRole("button", {
      name: pl ? "Odszyfruj plik" : "Decrypt file",
      exact: true,
    });
    await expect(decrypt).toBeDisabled();
    expect(rawFetches).toBe(0);
    await input.fill("A".repeat(43));
    await decrypt.click();
    await expect(
      page.locator(".decrypt-experience").getByRole("alert"),
    ).toContainText(pl ? "klucz jest nieprawidłowy" : "key is wrong");
    expect(rawFetches).toBe(1);
    await input.fill(key);
    await decrypt.click();
    const save = page.getByRole("link", {
      name: pl ? "Zapisz odszyfrowany plik" : "Save decrypted file",
    });
    await expect(save).toBeVisible();
    await expect(
      page.getByText(
        pl
          ? `Odszyfrowano: ${name} (2,5 KiB). Zapisz oryginalny plik poniżej.`
          : `Decrypted: ${name} (2.5 KiB). Save the original file below.`,
      ),
    ).toBeVisible();
    const downloadEvent = page.waitForEvent("download");
    await save.click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe(name);
    expect(await readFile((await download.path())!)).toEqual(bytes);
    expect(rawFetches).toBe(1);
    expect((await request.get(rawPath)).status()).toBe(404);
    const recovery = page.getByRole("link", {
      name: pl ? "Prześlij kolejny plik" : "Upload another file",
      exact: true,
    });
    await expect(recovery).toHaveAttribute("referrerpolicy", "no-referrer");
    const homeReferrers: (string | undefined)[] = [];
    page.on("request", (r) => {
      if (new URL(r.url()).pathname === "/")
        homeReferrers.push(r.headers().referer);
    });
    await recovery.click();
    await expect(page).toHaveURL("/");
    await expect(page).toHaveTitle("Up - Remastered");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page.goBack();
    await expect(page).toHaveTitle(new RegExp(title));
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL("/");
    await expect(page).toHaveTitle("Up - Remastered");
    expect(homeReferrers.length).toBeGreaterThan(0);
    expect(homeReferrers.every((referrer) => referrer === undefined)).toBe(
      true,
    );
    expect(rawFetches).toBe(1);
    expect(traffic.join("\n")).not.toContain(key);
    expect(errors).toEqual([]);
  });
}
