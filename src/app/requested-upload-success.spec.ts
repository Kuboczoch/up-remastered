import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const mode of ["supported", "missing", "rejected"] as const) {
  test(`recipient completion: ${mode} clipboard, narrow layout and consumed reload`, async ({
    page,
    context,
    request,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    if (mode === "supported") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    } else {
      await page.addInitScript((clipboardMode) => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value:
            clipboardMode === "missing"
              ? undefined
              : {
                  writeText: async () => {
                    throw new Error("Clipboard denied");
                  },
                },
        });
      }, mode);
    }
    const created = await request.post("/api/upload-requests", {
      data: {
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        maxBytes: 2048,
      },
    });
    expect(created.status()).toBe(201);
    const owner = await created.json();
    const filename = `${"recipient-report-".repeat(8)}.txt`;
    let uploaded:
      | { upload: { id: string; expiresAt: string }; accessToken: string }
      | undefined;
    try {
      await page.goto(owner.uploadUrl);
      await page.getByLabel("Choose file").setInputFiles({
        name: filename,
        mimeType: "text/plain",
        buffer: Buffer.alloc(1024, "x"),
      });
      const response = page.waitForResponse(
        (result) =>
          result.request().method() === "POST" &&
          result.url().endsWith("/upload"),
      );
      await page.getByRole("button", { name: "Upload file" }).click();
      const result = await response;
      expect(result.status()).toBe(201);
      uploaded = await result.json();
      const heading = page.getByRole("heading", { name: "Upload complete" });
      await expect(heading).toBeFocused();
      await expect(page.getByRole("status")).toHaveText(
        "The requester can now retrieve your file.",
      );
      await expect(page.getByText(filename, { exact: true })).toBeVisible();
      await expect(page.getByText("1 KiB", { exact: true })).toBeVisible();
      await expect(page.locator("time")).toHaveAttribute(
        "datetime",
        uploaded!.upload.expiresAt,
      );
      await expect(page.getByLabel("Choose file")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Upload file" }),
      ).toHaveCount(0);
      const shareUrl = new URL(`/${uploaded!.upload.id}`, page.url()).href;
      await expect(
        page.getByRole("link", { name: "Open file" }),
      ).toHaveAttribute("href", shareUrl);
      await expect(
        page.getByRole("link", { name: "Download file" }),
      ).toHaveAttribute("href", `${shareUrl}?download=1`);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).include("main").analyze()).violations,
      ).toEqual([]);
      const exposed = await page.evaluate(() =>
        JSON.stringify({
          html: document.body.innerHTML,
          local: { ...localStorage },
          session: { ...sessionStorage },
        }),
      );
      expect(exposed.includes(owner.managementToken)).toBe(false);
      expect(exposed.includes(uploaded!.accessToken)).toBe(false);
      await page.getByRole("button", { name: "Copy link" }).click();
      if (mode === "supported") {
        await expect(
          page.getByRole("button", { name: "Copied" }),
        ).toBeVisible();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
          shareUrl,
        );
        await expect(
          page.getByRole("button", { name: "Copy link" }),
        ).toBeVisible();
      } else {
        await expect(
          page.getByLabel("File link for manual copying"),
        ).toHaveValue(shareUrl);
        await expect(
          page.getByLabel("File link for manual copying"),
        ).toHaveAttribute("readonly", "");
        await expect(
          page.getByRole("status").filter({ hasText: "Select and copy" }),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "Copied" })).toHaveCount(
          0,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      const download = page.waitForEvent("download");
      await page.getByRole("link", { name: "Download file" }).click();
      expect((await download).suggestedFilename()).toBe(filename);
      await page.getByRole("link", { name: "Open file" }).click();
      await expect(page).toHaveURL(shareUrl);
      await expect(page.locator("body")).toContainText("x".repeat(1024));
      await page.goto(owner.uploadUrl);
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Upload request unavailable" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Upload file" }),
      ).toHaveCount(0);
    } finally {
      if (uploaded)
        await request.delete(`/api/u/${uploaded.upload.id}`, {
          data: { accessToken: uploaded.accessToken },
        });
      else
        await request.delete("/api/upload-requests/manage", {
          headers: { Authorization: `Bearer ${owner.managementToken}` },
        });
    }
  });
}
