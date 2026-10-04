import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const navigation = {
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Dest": "document",
};

for (const scenario of [
  "missing",
  "expired",
  "deleted",
  "exhausted",
] as const) {
  test(`${scenario}: real lifecycle, both aliases, HTML/raw/API/HEAD`, async ({
    page,
    request,
  }) => {
    let id = "ZZZZZ";
    if (scenario !== "missing") {
      const created = await request.post("/api/upload", {
        multipart: {
          ...(scenario === "expired" ? { expiresInSeconds: "1" } : {}),
          ...(scenario === "exhausted" ? { maxDownloads: "1" } : {}),
          file: {
            name: "private-unavailable-name.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("private unavailable bytes"),
          },
        },
      });
      expect(created.status()).toBe(201);
      const body = await created.json();
      id = body.upload.id;
      if (scenario === "expired") await page.waitForTimeout(1100);
      if (scenario === "deleted")
        expect(
          (
            await request.delete(`/api/u/${id}`, {
              data: { accessToken: body.accessToken },
            })
          ).status(),
        ).toBe(200);
      if (scenario === "exhausted") {
        expect((await request.head(`/${id}`)).status()).toBe(200);
        const admitted = await request.get(`/${id}`);
        expect(admitted.status()).toBe(200);
        expect(await admitted.text()).toBe("private unavailable bytes");
      }
    }
    let firstHtml: string | undefined;
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
      await expect(
        page.getByRole("link", { name: "Upload another file" }),
      ).toBeVisible();
      const html = await response!.text();
      expect(html).not.toContain("private-unavailable-name");
      expect(html).not.toContain("private unavailable bytes");
      expect(html).not.toContain(id);
      if (firstHtml) expect(html).toBe(firstHtml);
      firstHtml = html;
      expect(
        await page.evaluate(
          () => getComputedStyle(document.body).backgroundColor,
        ),
      ).toBe("rgb(8, 12, 18)");
      for (const accept of [
        "*/*",
        "application/json",
        "text/html",
        "text/html;q=0,*/*;q=1",
        "text/html;q=0.1,text/plain;q=1",
        "text/*;q=1,*/*;q=0.5",
      ]) {
        const raw = await request.get(path, { headers: { Accept: accept } });
        expect(raw.status()).toBe(404);
        expect(raw.headers()["content-type"]).toBe("text/plain; charset=utf-8");
        expect(await raw.text()).toBe("File unavailable.\n");
      }
      const excluded = await request.get(path, {
        headers: { ...navigation, Accept: "text/html;q=0,*/*;q=1" },
      });
      expect(await excluded.text()).toBe("File unavailable.\n");
      const range = await request.get(path, {
        headers: { ...navigation, Accept: "text/html", Range: "bytes=0-3" },
      });
      expect(await range.text()).toBe("File unavailable.\n");
      const forced = await request.get(`${path}?download=1`, {
        headers: { ...navigation, Accept: "text/html" },
      });
      expect(await forced.text()).toBe("File unavailable.\n");
      const head = await request.head(path, {
        headers: { ...navigation, Accept: "text/html" },
      });
      expect(head.status()).toBe(404);
      expect(head.headers()["content-type"]).toBe("text/plain; charset=utf-8");
      expect(await head.body()).toHaveLength(0);
    }
    const api = await request.get(`/api/u/${id}/details`, {
      headers: { ...navigation, Accept: "text/html" },
    });
    expect(api.status()).toBe(404);
    expect(api.headers()["content-type"]).toContain("application/json");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("link", { name: "Upload another file" }).click();
    await expect(
      page.getByRole("button", { name: "Choose file" }),
    ).toBeVisible();
  });
}

test("initial Polish document, explicit locale precedence, mobile and keyboard recovery", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "pl-PL",
    viewport: { width: 320, height: 640 },
  });
  const page = await context.newPage();
  const response = await page.goto("/ZZZZZ");
  expect(response?.headers()["content-language"]).toBe("pl");
  expect(await response!.text()).toContain('<html lang="pl">');
  await expect(
    page.getByRole("heading", { name: "Plik niedostępny" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const explicit = await page.goto("/u/ZZZZZ?lang=en");
  expect(explicit?.headers()["content-language"]).toBe("en");
  expect(await explicit!.text()).toContain('<html lang="en">');
  expect(
    (await context.cookies()).find((cookie) => cookie.name === "up-locale")
      ?.value,
  ).toBe("en");
  const cookie = await page.goto("/ZZZZZ");
  expect(cookie?.headers()["content-language"]).toBe("en");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Upload another file" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Choose file" })).toBeVisible();
  await context.close();
});
