import { expect, test } from "@playwright/test";

test.use({
  locale: "pl-PL",
  timezoneId: "Pacific/Honolulu",
  extraHTTPHeaders: { "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.5" },
});

test("Polish initial HTML and first browser mutations never flash English across upload/request navigation", async ({
  page,
  request,
}) => {
  for (const [path, phrase] of [
    ["/", "Wybierz plik"],
    ["/request/new", "Prośba wygasa"],
    ["/request/manage", "Ładowanie stanu prośby…"],
  ]) {
    const response = await request.get(path);
    expect(response.headers()["content-language"]).toBe("pl");
    const html = await response.text();
    expect(html).toContain('lang="pl"');
    expect(html).toContain(phrase);
    expect(html).not.toMatch(
      />Choose file<|>Request expires<|>Loading server limits…</,
    );
  }
  const warnings: string[] = [];
  page.on("pageerror", (e) => warnings.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") warnings.push(m.text());
  });
  await page.addInitScript(() => {
    (window as typeof window & { wrongLanguage?: string[] }).wrongLanguage = [];
    new MutationObserver(() => {
      const text = document.body?.innerText ?? "";
      if (
        /Choose file|Advanced options|Loading server limits|Create upload request/.test(
          text,
        )
      )
        (
          window as typeof window & { wrongLanguage: string[] }
        ).wrongLanguage.push(text);
    }).observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
  await page.goto("/");
  await expect(page.getByLabel("Wybierz plik")).toBeAttached();
  await page.getByRole("button", { name: "Opcje zaawansowane" }).click();
  await expect(page.getByLabel("Wygasa po")).toContainText("3 godziny");
  await page.getByLabel("Limit pobrań").fill("2");
  await expect(page.getByLabel("Limit pobrań")).toHaveAttribute(
    "aria-valuetext",
    "2 pobrania",
  );
  await page
    .getByRole("button", { name: "Zamknij opcje zaawansowane" })
    .click();
  await page.getByRole("tab", { name: "Tekst", exact: true }).click();
  await page.getByRole("button", { name: "Opcje zaawansowane" }).click();
  await expect(page.getByLabel("Kodowanie tekstu")).toBeDisabled();
  await expect(page.getByLabel("Kodowanie tekstu")).toHaveValue("utf-8");
  await page
    .getByRole("button", { name: "Zamknij opcje zaawansowane" })
    .click();
  await page
    .getByRole("button", { name: "Prześlij tekst", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Wpisz lub wklej tekst przed przesłaniem.",
  );
  await page.getByRole("link", { name: "Poproś o plik ↗" }).click();
  await expect(
    page.getByRole("button", { name: "Utwórz prośbę o plik" }),
  ).toBeEnabled();
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { wrongLanguage: string[] }).wrongLanguage,
    ),
  ).toEqual([]);
  expect(warnings).toEqual([]);
});

test("Polish request creation, requester delivery, owner terminal status and UTC dates use real APIs", async ({
  page,
  request,
}) => {
  await page.goto("/request/new");
  await page.getByRole("button", { name: "Utwórz prośbę o plik" }).click();
  await expect(
    page.getByRole("heading", { name: "Prośba o plik utworzona" }),
  ).toBeVisible();
  const uploadUrl = await page
    .locator('a[href*="/request/"]')
    .filter({ hasNotText: "Zarządzaj" })
    .first()
    .getAttribute("href");
  // Result URLs are capability links; read their hrefs without printing them.
  const links = await page
    .locator("main a")
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLAnchorElement).href));
  const ownerUrl = links.find((url) => url.includes("/request/manage#"));
  const target = links.find(
    (url) =>
      new URL(url).pathname.startsWith("/request/") &&
      !url.includes("/request/manage") &&
      !url.includes("/request/new"),
  );
  expect(uploadUrl).toBeTruthy();
  expect(ownerUrl).toBeTruthy();
  expect(target).toBeTruthy();
  const initial = await request.get(target!);
  expect(await initial.text()).toContain("Maksymalnie");
  await page.goto(target!);
  await page.getByLabel("Wybierz plik").setInputFiles({
    name: "DoNotTranslate.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("bytes stay unchanged"),
  });
  await page
    .getByRole("button", { name: "Prześlij plik", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Przesyłanie zakończone" }),
  ).toBeVisible();
  await expect(page.getByText("DoNotTranslate.txt")).toBeVisible();
  await expect(
    page.getByText(
      "Twój plik został dostarczony. Osoba prosząca może go teraz pobrać.",
    ),
  ).toBeVisible();
  const expiry = page.locator("time");
  const timestamp = await expiry.getAttribute("datetime");
  const expected = await page.evaluate(
    (value) =>
      new Intl.DateTimeFormat("pl", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(value!)),
    timestamp,
  );
  await expect(expiry).toHaveText(expected);
  await page.goto(ownerUrl!);
  await expect(
    page.getByRole("status").filter({ hasText: "Plik dostarczony" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Pobierz plik" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Kopiuj link do pobierania" }),
  ).toBeVisible();
});

test("Polish request busy, cancellation and malformed remote errors never expose English or sensitive payloads", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/upload-requests", {
    data: {
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      maxBytes: 4096,
    },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  await page.goto(body.uploadUrl);
  await page.getByLabel("Wybierz plik").setInputFiles({
    name: "same.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("content"),
  });
  await page.route("**/api/upload-requests/*/upload", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "SQLITE_ERROR", message: "secret-token raw English" },
      }),
    });
  });
  await page
    .getByRole("button", { name: "Prześlij plik", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Anuluj przesyłanie" }),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Przesyłanie nie powiodło się. Możesz spróbować ponownie z wybranym plikiem.",
  );
  await expect(page.locator("main").getByRole("alert")).not.toContainText(
    /SQLITE|secret|English/,
  );
  await page
    .getByRole("button", { name: "Prześlij plik", exact: true })
    .click();
  await page.getByRole("button", { name: "Anuluj przesyłanie" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText(
    "Anulowano. Wybrany plik pozostaje zachowany.",
  );
  expect(
    await page
      .getByLabel("Wybierz plik")
      .evaluate((node: HTMLInputElement) =>
        Array.from(node.files ?? []).map((file) => file.name),
      ),
  ).toEqual(["same.txt"]);
});

test("native revoke dialog restores focus after errors and success; public revoked state is Polish on initial HTML", async ({
  page,
  request,
  browser,
}) => {
  const response = await request.post("/api/upload-requests", {
    data: {
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      maxBytes: 4096,
    },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  await page.goto(body.managementUrl);
  const trigger = page.getByRole("button", { name: "Unieważnij prośbę" });
  await expect(trigger).toBeVisible();
  await page.route("**/api/upload-requests/manage", (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: { message: "raw secret-token", code: "UNKNOWN_CODE" },
          }),
        })
      : route.continue(),
  );
  await trigger.click();
  await expect(
    page.getByRole("button", { name: "Zachowaj prośbę" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Potwierdź unieważnienie" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Nie udało się unieważnić prośby. Spróbuj ponownie.",
  );
  await expect(trigger).toBeFocused();
  await page.unroute("**/api/upload-requests/manage");
  await trigger.click();
  await page.getByRole("button", { name: "Potwierdź unieważnienie" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Ta prośba została unieważniona" }),
  ).toBeFocused();
  const html = await (await request.get(body.uploadUrl)).text();
  expect(html).toContain(
    "Ta prośba została unieważniona. Poproś o nowy link do prośby.",
  );
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    locale: "pl-PL",
    extraHTTPHeaders: { "Accept-Language": "pl" },
  });
  try {
    const staticPage = await noJs.newPage();
    await staticPage.goto(body.uploadUrl);
    await expect(
      staticPage.getByText(
        "Ta prośba została unieważniona. Poproś o nowy link do prośby.",
      ),
    ).toBeVisible();
    await expect(staticPage.locator("html")).toHaveAttribute("lang", "pl");
  } finally {
    await noJs.close();
  }
});
