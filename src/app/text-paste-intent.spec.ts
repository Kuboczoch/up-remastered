import { expect, test } from "@playwright/test";

for (const mode of ["File", "Text"]) {
  for (const target of ["body", ".upload-workspace"]) {
    test(`ignores plain text pasted onto ${target} in ${mode} mode until explicit text submission`, async ({
      page,
    }) => {
      let requests = 0;
      await page.route("**/api/upload", async (route) => {
        requests += 1;
        await route.abort();
      });
      await page.goto("/");
      await page.getByRole("tab", { name: "Text" }).click();
      await page.getByLabel("Or upload text").fill("existing draft");
      await page.getByRole("tab", { name: mode, exact: true }).click();
      const allowedDefault = await page.locator(target).evaluate((element) => {
        const data = new DataTransfer();
        data.setData("text/plain", "disposable clipboard secret");
        return element.dispatchEvent(
          new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: data,
          }),
        );
      });
      await page.waitForTimeout(300);
      expect(requests).toBe(0);
      expect(allowedDefault).toBe(true);
      await expect(
        page.getByRole("tab", { name: mode, exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await page.getByRole("tab", { name: "Text" }).click();
      await expect(page.getByLabel("Or upload text")).toHaveValue(
        "existing draft",
      );
      await page.getByRole("button", { name: /Advanced options/ }).click();
      await page.getByLabel("Expires after").selectOption("3");
      await expect(
        page.getByRole("switch", { name: "Key protect" }),
      ).toBeEnabled();
      await page
        .getByRole("button", { name: "Close advanced options" })
        .click();
      expect(requests).toBe(0);
      await page
        .getByRole("button", { name: "Upload text", exact: true })
        .click();
      await expect.poll(() => requests).toBe(1);
    });
  }
}

for (const target of ["input", "textarea", "contenteditable"]) {
  for (const container of ["body", ".upload-workspace"]) {
    test(`leaves ${target} paste boundaries untouched within ${container}`, async ({
      page,
    }) => {
      let requests = 0;
      await page.route("**/api/upload", async (route) => {
        requests += 1;
        await route.abort();
      });
      await page.goto("/");
      await page.getByRole("tab", { name: "Text" }).click();
      const allowedDefault = await page.evaluate(
        ({ target, container }) => {
          const element = document.createElement(
            target === "contenteditable" ? "div" : target,
          );
          if (target === "contenteditable") element.contentEditable = "true";
          const child =
            target === "contenteditable"
              ? document.createElement("span")
              : element;
          if (child !== element) element.append(child);
          document.querySelector(container)!.append(element);
          const data = new DataTransfer();
          data.setData("text/plain", "disposable boundary text");
          data.items.add(
            new File(["boundary"], "boundary.txt", { type: "text/plain" }),
          );
          const allowed = child.dispatchEvent(
            new ClipboardEvent("paste", {
              bubbles: true,
              cancelable: true,
              clipboardData: data,
            }),
          );
          element.remove();
          return allowed;
        },
        { target, container },
      );
      await page.waitForTimeout(300);
      expect(requests).toBe(0);
      expect(allowedDefault).toBe(true);
      await expect(page.getByLabel("Or upload text")).toHaveValue("");
    });
  }
}

test("native editor paste creates an editable draft with no request before Upload text", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  let requests = 0;
  await page.route("**/api/upload", async (route) => {
    requests += 1;
    expect(route.request().postDataBuffer()!.toString()).toContain(
      "edited draft",
    );
    expect(route.request().postDataBuffer()!.toString()).toContain(
      'name="expiresInHours"\r\n\r\n3',
    );
    await route.continue();
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Text" }).click();
  await page.evaluate(() => navigator.clipboard.writeText("native draft"));
  const editor = page.getByLabel("Or upload text");
  await editor.focus();
  await page.keyboard.press("Control+V");
  await expect(editor).toHaveValue("native draft");
  expect(requests).toBe(0);
  await editor.fill("edited draft");
  await page.getByRole("button", { name: /Advanced options/ }).click();
  await page.getByLabel("Expires after").selectOption("3");
  await page.getByRole("button", { name: "Close advanced options" }).click();
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Upload text", exact: true }).click();
  await expect(
    page.getByText("Upload complete", { exact: true }),
  ).toBeVisible();
  expect(requests).toBe(1);
  await expect(page.locator(".result-card time")).toHaveAttribute(
    "datetime",
    /.+/,
  );
});
