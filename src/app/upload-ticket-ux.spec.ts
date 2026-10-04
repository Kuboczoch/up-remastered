import { chromium, expect, test, type Page } from "@playwright/test";

async function upload(page: Page, name = "disposable.txt") {
  await page.getByLabel("Choose file").setInputFiles({
    name,
    mimeType: "text/plain",
    buffer: Buffer.from("disposable"),
  });
  await expect(
    page.getByRole("button", { name: "Copy URL", exact: true }),
  ).toBeVisible();
  return page.getByLabel("Share URL").inputValue();
}
async function confirmDeletion(page: Page) {
  await page.getByRole("button", { name: "Delete file", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
}

test("background paste drafts only and ignores editable descendants; explicit submit publishes", async ({
  page,
}) => {
  let posts = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/upload") && request.method() === "POST")
      posts++;
  });
  await page.goto("/");
  await expect(page.getByText("4 KiB max")).toBeVisible();
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "secret draft");
    document.body.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.getByLabel("Or upload text")).toHaveValue("secret draft");
  expect(posts).toBe(0);
  await page.evaluate(() => {
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    const child = document.createElement("span");
    editable.append(child);
    document.body.append(editable);
    const data = new DataTransfer();
    data.setData("text/plain", "do not capture");
    child.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
    editable.remove();
  });
  await expect(page.getByLabel("Or upload text")).toHaveValue("secret draft");
  expect(posts).toBe(0);
  await page.getByRole("button", { name: "Upload text", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copy URL", exact: true }),
  ).toBeVisible();
  expect(posts).toBe(1);
});

test("history-off deletion uses modal safe focus, Escape return, terminal state and real 404", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const url = await upload(page);
  await confirmDeletion(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Delete file", exact: true }),
  ).toBeFocused();
  expect((await request.get(url)).status()).toBe(200);
  await confirmDeletion(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete file", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "File deleted", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy URL", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show QR code" })).toHaveCount(
    0,
  );
  expect((await request.get(url)).status()).toBe(404);
  expect(
    await page.evaluate(() => localStorage.getItem("up-remastered:history:v1")),
  ).toBeNull();
});

test("failed delete retains live result and duplicate activation sends only one request", async ({
  page,
}) => {
  await page.goto("/");
  const url = await upload(page);
  let deletes = 0;
  await page.route("**/api/u/*", async (route) => {
    if (route.request().method() !== "DELETE") return route.continue();
    deletes++;
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "Deletion unavailable" }),
    });
  });
  await confirmDeletion(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete file", exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect(
    page.getByText("disposable.txt could not be deleted. Try again.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(deletes).toBe(1);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Share URL")).toHaveValue(url);
  await expect(
    page.getByRole("button", { name: "Copy URL", exact: true }),
  ).toBeVisible();
});

test("clipboard absent and denied show complete selectable fallback; permission success is accurate", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto("/");
  const url = await upload(page);
  await page.getByRole("button", { name: "Copy URL", exact: true }).click();
  const fallback = page.getByLabel("Complete link for manual copying");
  await expect(fallback).toHaveValue(url);
  await fallback.focus();
  expect(
    await fallback.evaluate(
      (input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!,
    ),
  ).toBe(url.length);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          Promise.reject(new DOMException("Denied", "NotAllowedError")),
      },
    });
  });
  await page.getByRole("button", { name: "Copy URL", exact: true }).click();
  await expect(fallback).toHaveValue(url);
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => undefined },
    });
  });
  await page.getByRole("button", { name: "Copy URL", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  await expect(fallback).toHaveCount(0);
});

test("native sharing uses public URL only; cancel is silent, genuine rejection announced", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (window as unknown as { payload: ShareData }).payload = data;
      },
    });
  });
  await page.goto("/");
  const url = await upload(page);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { payload: ShareData }).payload,
    ),
  ).toEqual({
    title: "Temporary file",
    text: "Anyone with this link can download the file.",
    url,
  });
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: () => Promise.reject(new DOMException("Canceled", "AbortError")),
    });
  });
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(
    page.getByText("Sharing failed. Use Copy link instead."),
  ).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: () => Promise.reject(new Error("Failed")),
    });
  });
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(
    page.getByText("Sharing failed. Use Copy link instead."),
  ).toBeVisible();
});

test("protected results and history omit native share and never expose key in payload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: async () => {
        throw new Error("Must not share protected links");
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Advanced options" }).click();
  await page.getByRole("switch", { name: "Key protect" }).check();
  await page.getByRole("switch", { name: "Save history" }).check();
  await page.getByRole("button", { name: "Close advanced options" }).click();
  const url = await upload(page, "protected.txt");
  expect(url).toContain("#key=");
  await expect(
    page.getByRole("button", { name: "Share", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Share protected.txt", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/Protected links cannot use native Share/),
  ).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });
  await page.getByRole("button", { name: "Copy URL", exact: true }).click();
  await expect(page.getByLabel("Complete link for manual copying")).toHaveValue(
    url,
  );
  await confirmDeletion(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete file", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "File deleted", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Complete link for manual copying")).toHaveCount(
    0,
  );
});

test("upfront insecure-context protection feedback disables option without changing normal upload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isSecureContext", { value: false });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Advanced options" }).click();
  await expect(
    page.getByRole("switch", { name: "Key protect" }),
  ).toBeDisabled();
  await expect(page.getByText(/Key protection requires HTTPS/)).toBeVisible();
  await page.getByRole("button", { name: "Close advanced options" }).click();
  expect(await upload(page)).not.toContain("#key=");
});

test("real non-loopback HTTP origin disables protection and exposes clipboard manual fallback", async ({
  baseURL,
}) => {
  const browser = await chromium.launch({
    args: [
      "--host-resolver-rules=MAP upload-insecure.test 127.0.0.1",
      "--no-proxy-server",
    ],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`http://upload-insecure.test:${new URL(baseURL!).port}/`);
    expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
    expect(await page.evaluate(() => typeof navigator.clipboard)).toBe(
      "undefined",
    );
    expect(await page.evaluate(() => typeof window.crypto?.subtle)).toBe(
      "undefined",
    );
    await page.getByRole("button", { name: "Advanced options" }).click();
    await expect(
      page.getByRole("switch", { name: "Key protect" }),
    ).toBeDisabled();
    await expect(page.getByText(/Key protection requires HTTPS/)).toBeVisible();
    await page.getByRole("button", { name: "Close advanced options" }).click();
    await page.route("**/api/upload", async (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "not-for-sharing",
          upload: {
            id: "A1B2C",
            originalName: "public.txt",
            shareUrl: `http://upload-insecure.test:${new URL(baseURL!).port}/A1B2C`,
            size: 6,
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        }),
      }),
    );
    const url = await upload(page, "public.txt");
    await page.getByRole("button", { name: "Copy URL", exact: true }).click();
    await expect(
      page.getByLabel("Complete link for manual copying"),
    ).toHaveValue(url);
  } finally {
    await browser.close();
  }
});

async function enableHistory(page: Page) {
  await page.getByRole("button", { name: "Advanced options" }).click();
  await page.getByRole("switch", { name: "Save history" }).check();
  await page.getByRole("button", { name: "Close advanced options" }).click();
}

async function historyDelete(page: Page, name: string) {
  await page.getByRole("button", { name: `More actions for ${name}` }).click();
  await page
    .getByRole("button", { name: `Delete ${name}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete file", exact: true })
    .click();
}

test("history deletion reconciles matching ID only and local removal never deletes server files", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await enableHistory(page);
  const first = await upload(page, "first.txt");
  await page.getByRole("button", { name: "Upload another file" }).click();
  const second = await upload(page, "second.txt");
  await historyDelete(page, "first.txt");
  await expect(
    page.getByText("first.txt was deleted.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Share URL")).toHaveValue(second);
  expect((await request.get(first)).status()).toBe(404);
  await page
    .getByRole("button", { name: "More actions for second.txt" })
    .click();
  await page
    .getByRole("button", {
      name: "Remove second.txt from history",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("second.txt was removed from this browser."),
  ).toBeVisible();
  expect((await request.get(second)).status()).toBe(200);
  await page.getByRole("button", { name: "Upload another file" }).click();
  const third = await upload(page, "third.txt");
  await historyDelete(page, "third.txt");
  await expect(
    page.getByRole("heading", { name: "File deleted", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Share URL")).toHaveCount(0);
  expect((await request.get(third)).status()).toBe(404);
});

test("history native share uses selected exact URL and history copy rejects accurately", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: async (data: ShareData) => {
        (window as unknown as { payload: ShareData }).payload = data;
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
  });
  await page.goto("/");
  await enableHistory(page);
  const first = await upload(page, "history-one.txt");
  await page.getByRole("button", { name: "Upload another file" }).click();
  await upload(page, "history-two.txt");
  await page
    .getByRole("button", { name: "Share history-one.txt", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => (window as unknown as { payload: ShareData }).payload.url,
    ),
  ).toBe(first);
  await page
    .locator(".history-list li")
    .filter({ hasText: "history-one.txt" })
    .getByRole("button", { name: "Copy link", exact: true })
    .click();
  await expect(page.getByLabel("Complete link for manual copying")).toHaveValue(
    first,
  );
  await expect(page.getByText("Link copied.", { exact: true })).toHaveCount(0);
});

test("unsupported native share leaves no broken action and full copy remains available", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
  });
  await page.goto("/");
  await enableHistory(page);
  await upload(page);
  await expect(
    page.getByRole("button", { name: "Share", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Share disposable.txt", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Copy URL", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Copy link", exact: true }),
  ).toBeEnabled();
});

test("already-unavailable DELETE 404 is terminal and history failures retain metadata and sharing", async ({
  page,
}) => {
  await page.goto("/");
  await enableHistory(page);
  const url = await upload(page, "retained.txt");
  await page.route("**/api/u/*", async (route) => {
    if (route.request().method() !== "DELETE") return route.continue();
    await route.fulfill({ status: 403, body: "Denied" });
  });
  await historyDelete(page, "retained.txt");
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "retained.txt could not be deleted. Try again.",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Share URL")).toHaveValue(url);
  await expect(page.locator(".history-list li")).toHaveCount(1);
  await page.unroute("**/api/u/*");
  await page.route("**/api/u/*", async (route) => {
    if (route.request().method() !== "DELETE") return route.continue();
    await route.fulfill({ status: 404, body: "Unavailable" });
  });
  await historyDelete(page, "retained.txt");
  await expect(
    page.getByRole("heading", { name: "File deleted", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".history-list li")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Copy URL", exact: true }),
  ).toHaveCount(0);
});

test("late clipboard rejection after deletion cannot resurrect full-link fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: () =>
          new Promise((_, reject) => {
            (window as unknown as { rejectCopy: () => void }).rejectCopy = () =>
              reject(new Error("denied"));
          }),
      },
    });
  });
  await page.goto("/");
  await upload(page);
  await page.getByRole("button", { name: "Copy URL", exact: true }).click();
  await confirmDeletion(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete file", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "File deleted", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { rejectCopy: () => void }).rejectCopy(),
  );
  await expect(page.getByLabel("Complete link for manual copying")).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toHaveCount(0);
});

for (const width of [320, 390]) {
  test(`mobile ${width}: navigation and footer targets fit, result and modal have no overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    for (const target of await page
      .locator(".upload-rail a, .site-footer a")
      .all()) {
      const bounds = await target.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(43.99); // subpixel layout rounding tolerance
    }
    await enableHistory(page);
    await upload(page, "long-disposable-filename-for-mobile-confirmation.txt");
    await expect(
      page.getByRole("button", { name: "Copy link", exact: true }),
    ).toBeVisible();
    for (const target of await page
      .locator(
        ".history-actions > button, .clear-history, .result-actions > *, .share-row button",
      )
      .all()) {
      const bounds = await target.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(43.99); // subpixel layout rounding tolerance
    }
    await confirmDeletion(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Shift+Tab");
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Delete file", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
