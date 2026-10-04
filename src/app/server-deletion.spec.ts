import { expect, test, type Page } from "@playwright/test";

const historyKey = "up-remastered:upload-history:v1";
// Owner deletion requests must not be retained in browser traces.
test.use({ trace: "off" });
async function enableHistory(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Advanced options/ }).click();
  await page.getByRole("switch", { name: "Save history" }).setChecked(true);
  await page.getByRole("button", { name: "Close advanced options" }).click();
}
async function upload(page: Page, name: string) {
  await page.locator("#file-picker").setInputFiles({
    buffer: Buffer.from("disposable deletion acceptance test"),
    name,
    mimeType: "text/plain",
  });
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function deleteFromHistory(page: Page, name: string) {
  await page.getByRole("button", { name: `More actions for ${name}` }).click();
  await page
    .getByRole("button", { name: `Delete ${name}`, exact: true })
    .click();
}
const records = (page: Page) =>
  page.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key) ?? "[]") as {
        id: string;
        accessToken: string;
        serverStatus?: string;
      }[],
    historyKey,
  );

test.afterEach(async ({ page, request }) => {
  // Dispose only this test's temporary uploads; capabilities never leave the test.
  if (!page.url().startsWith("http")) return;
  for (const entry of await records(page)) {
    if (!entry.serverStatus) {
      const response = await request.delete(`/api/u/${entry.id}`, {
        data: { accessToken: entry.accessToken },
      });
      expect([200, 404]).toContain(response.status());
    }
  }
});

test("confirmed deletion persists, invalidates the current result, and leaves a removable local record", async ({
  page,
  request,
}) => {
  await enableHistory(page);
  await upload(page, "deleted-current.txt");
  const url = await page.getByLabel("Share URL").inputValue();
  await deleteFromHistory(page, "deleted-current.txt");
  await expect(
    page.getByRole("heading", { name: "File deleted" }),
  ).toBeVisible();
  for (const name of ["Copy URL", "Show QR code"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  for (const name of ["Open file", "Download file"])
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
  const response = await request.get(url);
  expect(response.status()).toBe(404);
  expect(await response.text()).toBe("File unavailable.\n");
  expect((await records(page))[0].serverStatus).toBe("deleted");
  await page
    .getByRole("button", { name: "Upload another file", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByText("Deleted on server. Saved links no longer work."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy link", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "More actions for deleted-current.txt" })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Delete deleted-current.txt",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "Download", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Remove deleted-current.txt from history" })
    .click();
  await expect(page.locator(".history-card")).toBeHidden();
  expect(await records(page)).toEqual([]);
});

test("API-confirmed already unavailable is distinct from deleted and persists", async ({
  page,
  request,
}) => {
  await enableHistory(page);
  await upload(page, "already-gone.txt");
  const [entry] = await records(page);
  expect(
    (
      await request.delete(`/api/u/${entry.id}`, {
        data: { accessToken: entry.accessToken },
      })
    ).status(),
  ).toBe(200);
  await deleteFromHistory(page, "already-gone.txt");
  await expect(
    page.getByRole("heading", { name: "File unavailable" }),
  ).toBeVisible();
  expect((await records(page))[0].serverStatus).toBe("unavailable");
  await page.reload();
  await expect(
    page.getByText(
      "Already unavailable on server. Saved links no longer work.",
    ),
  ).toBeVisible();
});

for (const failure of ["forbidden", "server", "raw404", "network"] as const) {
  test(`${failure} failure retains live result and retryable owner metadata`, async ({
    page,
  }) => {
    await enableHistory(page);
    await upload(page, "retryable.txt");
    const before = await records(page);
    await page.route("**/api/u/*", (route) =>
      failure === "network"
        ? route.abort("failed")
        : route.fulfill({
            status:
              failure === "forbidden" ? 403 : failure === "server" ? 500 : 404,
            contentType: "text/plain",
            body: "File unavailable.\n",
          }),
    );
    await deleteFromHistory(page, "retryable.txt");
    await expect(
      page.getByText("retryable.txt could not be deleted. Try again."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Copy URL", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("link", { name: "Open file", exact: true }),
    ).toBeVisible();
    expect(JSON.stringify(await records(page)) === JSON.stringify(before)).toBe(
      true,
    );
    await page.unroute("**/api/u/*");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Copy link", exact: true }),
    ).toBeEnabled();
  });
}

test("deleting another row preserves the current result and selected URL", async ({
  page,
}) => {
  await enableHistory(page);
  await upload(page, "other.txt");
  await page
    .getByRole("button", { name: "Upload another file", exact: true })
    .click();
  await upload(page, "live-current.txt");
  const share = page.getByLabel("Share URL");
  await share.focus();
  await share.evaluate((input: HTMLInputElement) =>
    input.setSelectionRange(2, 8),
  );
  const url = await share.inputValue();
  await deleteFromHistory(page, "other.txt");
  await expect(page.getByText("other.txt was deleted.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "live-current.txt", exact: true }),
  ).toBeVisible();
  expect((await share.inputValue()) === url).toBe(true);
  expect(
    await share.evaluate((input: HTMLInputElement) => [
      input.selectionStart,
      input.selectionEnd,
    ]),
  ).toEqual([2, 8]);
  await expect(
    page.getByRole("button", { name: "Copy URL", exact: true }),
  ).toBeEnabled();
  expect(
    (await records(page)).find((entry) => entry.serverStatus === "deleted"),
  ).toBeTruthy();
});
