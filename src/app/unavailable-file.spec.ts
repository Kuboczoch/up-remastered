import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("unavailable lifecycle is responsive, accessible and recoverable without changing raw contracts", async ({
  page,
  request,
}) => {
  for (const state of ["missing", "expired", "deleted", "exhausted"]) {
    let id = "ZZZZZ";
    if (state !== "missing") {
      const response = await request.post("/api/upload", {
        multipart: {
          file: {
            name: "private-name.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("disposable lifecycle fixture"),
          },
          ...(state === "expired" ? { expiresInSeconds: "1" } : {}),
          ...(state === "exhausted" ? { maxDownloads: "1" } : {}),
        },
      });
      expect(response.status()).toBe(201);
      const { upload } = await response.json();
      id = upload.id;
      if (state === "expired") await page.waitForTimeout(1100);
      if (state === "deleted")
        expect(
          (
            await request.delete(`/api/u/${id}`, {
              data: { accessToken: upload.accessToken },
            })
          ).status(),
        ).toBe(200);
      if (state === "exhausted")
        expect((await request.get(`/${id}`)).status()).toBe(200);
    }
    for (const path of [`/${id}`, `/u/${id}`]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      expect(response?.headers()["content-type"]).toBe(
        "text/html; charset=utf-8",
      );
      expect(response?.headers()["cache-control"]).toBe("no-store");
      expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
      await expect(
        page.getByRole("heading", { name: "File unavailable" }),
      ).toBeVisible();
      expect(await page.content()).not.toContain("private-name");
      expect(await page.content()).not.toContain(id);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      for (const width of [320, 375, 1280]) {
        await page.setViewportSize({ width, height: 720 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "Up - Remastered home" }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "Upload another file" }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/$/);
      const raw = await request.get(path, { headers: { accept: "text/html" } });
      expect(raw.status()).toBe(404);
      expect(await raw.text()).toBe("File unavailable.\n");
      const forced = await request.get(`${path}?download=1`, {
        headers: {
          accept: "text/html",
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": "document",
        },
      });
      expect(await forced.text()).toBe("File unavailable.\n");
      const head = await request.head(path, {
        headers: {
          accept: "text/html",
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": "document",
        },
      });
      expect(head.status()).toBe(404);
      expect(await head.body()).toHaveLength(0);
      expect(head.headers()["content-type"]).toBe("text/plain; charset=utf-8");
    }
    const api = await request.get(`/api/u/${id}/details`, {
      headers: {
        accept: "text/html",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
      },
    });
    expect(api.status()).toBe(404);
    expect(api.headers()["content-type"]).toContain("application/json");
  }
});
