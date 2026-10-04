import { expect, test } from "@playwright/test";

for (const owner of ["creation", "manager"] as const) {
  test(`${owner} revocation confirms, cancels and preserves active request on failure`, async ({
    page,
  }) => {
    await page.goto("/request/new");
    await page.getByRole("button", { name: "Create upload request" }).click();
    const ownerLink = page.locator('a[href*="/request/manage#"]');
    await expect(ownerLink).toBeVisible();
    if (owner === "manager")
      await page.goto((await ownerLink.getAttribute("href"))!);
    const trigger = page.getByRole("button", { name: "Revoke request" });
    await expect(trigger).toBeEnabled();
    let deletes = 0;
    await page.route("**/api/upload-requests/manage", async (route) => {
      if (route.request().method() !== "DELETE") return route.continue();
      deletes += 1;
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { message: "Could not revoke the request." },
        }),
      });
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Revoke upload request?" });
    await expect(dialog).toContainText("shared upload link will stop working");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(deletes).toBe(0);
    await trigger.click();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    expect(deletes).toBe(0);
    await trigger.click();
    await dialog
      .getByRole("button", { name: "Confirm revoke request" })
      .click();
    await expect(dialog.getByRole("alert")).toContainText("Could not revoke");
    expect(deletes).toBe(1);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("status")).toContainText("active");
  });
}
