import { expect, test } from "@playwright/test";

for (const locale of ["en", "pl"] as const) {
  for (const unavailable of [false, true]) {
    test(`${locale} browser history persists ${unavailable ? "unavailable" : "deleted"} across reload`, async ({
      browser,
      baseURL,
    }) => {
      const pl = locale === "pl";
      const context = await browser.newContext({ locale, baseURL });
      await context.addInitScript(() =>
        localStorage.setItem("up-remastered:history-enabled", "true"),
      );
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
          name: "history.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("history"),
        });
      const receipt = await (await receiptPromise).json();
      await page.reload();
      const history = page.getByRole("region", {
        name: pl ? "Twoje pliki" : "Your uploads",
      });
      await expect(
        history.getByText("history.txt", { exact: true }),
      ).toBeVisible();
      await history
        .getByRole("button", {
          name: pl
            ? "Więcej działań dla history.txt"
            : "More actions for history.txt",
        })
        .click();
      const trigger = history.getByRole("button", {
        name: pl
          ? "Usuń plik history.txt z serwera"
          : "Delete server file history.txt",
        exact: true,
      });
      await trigger.click();
      const dialog = page.getByRole("dialog", {
        name: pl ? "Usunąć history.txt?" : "Delete history.txt?",
      });
      await expect(
        dialog.getByRole("button", {
          name: pl ? "Anuluj" : "Cancel",
          exact: true,
        }),
      ).toBeFocused();
      await page.keyboard.press("Escape");
      const more = history.getByRole("button", {
        name: pl
          ? "Więcej działań dla history.txt"
          : "More actions for history.txt",
      });
      await expect(more).toBeFocused();
      const endpoint = `**/api/u/${receipt.upload.id}`;
      await page.route(endpoint, (route) =>
        route.fulfill({ status: 502, body: "private-owner-detail" }),
      );
      await more.click();
      await trigger.click();
      const confirm = dialog.getByRole("button", {
        name: pl ? "Usuń plik z serwera" : "Delete server file",
        exact: true,
      });
      await confirm.click();
      await expect(dialog.getByRole("alert")).toHaveText(
        pl
          ? "Nie udało się usunąć history.txt. Spróbuj ponownie."
          : "history.txt could not be deleted. Try again.",
      );
      await expect(page.locator("body")).not.toContainText(
        "private-owner-detail",
      );
      expect((await page.request.get(receipt.upload.shareUrl)).status()).toBe(
        200,
      );
      await page.unroute(endpoint);
      if (unavailable)
        expect(
          (
            await page.request.delete(`/api/u/${receipt.upload.id}`, {
              data: { accessToken: receipt.accessToken },
            })
          ).status(),
        ).toBe(200);
      await confirm.click();
      await expect(dialog).not.toBeVisible();
      const terminal = unavailable
        ? pl
          ? "Plik jest już niedostępny na serwerze. Zapisane linki już nie działają."
          : "Already unavailable on server. Saved links no longer work."
        : pl
          ? "Usunięto z serwera. Zapisane linki już nie działają."
          : "Deleted on server. Saved links no longer work.";
      await expect(history.getByText(terminal)).toBeVisible();
      await page.reload();
      await expect(history.getByText(terminal)).toBeVisible();
      await expect(
        history.getByRole("button", {
          name: pl ? "Kopiuj link" : "Copy link",
          exact: true,
        }),
      ).toBeDisabled();
      expect((await page.request.get(receipt.upload.shareUrl)).status()).toBe(
        404,
      );
      // A different representation must preserve durable machine state while
      // translating the terminal explanation, never resurrecting actions.
      const otherLocale = pl ? "en" : "pl";
      await page.goto(`/?lang=${otherLocale}`);
      const otherHistory = page.getByRole("region", {
        name: pl ? "Your uploads" : "Twoje pliki",
      });
      await expect(
        otherHistory.getByText(
          unavailable
            ? pl
              ? "Already unavailable on server. Saved links no longer work."
              : "Plik jest już niedostępny na serwerze. Zapisane linki już nie działają."
            : pl
              ? "Deleted on server. Saved links no longer work."
              : "Usunięto z serwera. Zapisane linki już nie działają.",
        ),
      ).toBeVisible();
      await expect(
        otherHistory.getByRole("button", {
          name: pl ? "Copy link" : "Kopiuj link",
          exact: true,
        }),
      ).toBeDisabled();
      expect(await page.locator("body").innerHTML()).not.toContain(
        receipt.accessToken,
      );
      await page.goto(`/?lang=${locale}`);
      await expect(history.getByText(terminal)).toBeVisible();
      await history
        .getByRole("button", {
          name: pl ? "Wyczyść historię" : "Clear history",
        })
        .click();
      await expect(page.getByRole("status")).toHaveText(
        pl
          ? "Wyczyszczono historię w tej przeglądarce. Pliki na serwerze nie zostały zmienione."
          : "History cleared in this browser. Server files are unchanged.",
      );
      expect(errors).toEqual([]);
      await context.close();
    });
  }
}
