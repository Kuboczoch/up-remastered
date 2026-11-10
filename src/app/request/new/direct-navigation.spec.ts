import { expect, test } from "@playwright/test";
import { translate } from "@/lib/i18n/messages";

// Persist across document navigations as well as App Router transitions. Observe
// added nodes themselves so a fallback removed in the same task is not missed.
function observeLoading() {
  const key = "request-navigation-loading";
  const forbidden = new Set([
    "Loading",
    "Wczytywanie",
    "Please wait",
    "Proszę czekać",
    "The requested content is loading.",
    "Trwa wczytywanie żądanej zawartości.",
    "Loading server limits…",
    "Wczytywanie limitów serwera…",
  ]);
  function appendLoading(text: string) {
    const seen = JSON.parse(sessionStorage.getItem(key) ?? "[]") as string[];
    seen.push(text);
    sessionStorage.setItem(key, JSON.stringify(seen));
  }
  function inspect(node: Node) {
    if (node instanceof Text) {
      if (forbidden.has(node.data.trim())) appendLoading(node.data.trim());
      return;
    }
    if (!(node instanceof Element)) return;
    for (const element of [
      node,
      ...node.querySelectorAll(
        "p,h1,option,[role=status],[aria-busy=true],.skeleton,.spinner",
      ),
    ]) {
      const text = element.textContent?.trim() ?? "";
      if (
        forbidden.has(text) ||
        element.matches(".skeleton,.spinner,[aria-busy=true]")
      ) {
        appendLoading(text || element.outerHTML);
      }
    }
  }
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") {
        if (forbidden.has(record.oldValue?.trim() ?? "")) {
          appendLoading(record.oldValue!.trim());
        }
        inspect(record.target);
      } else if (record.type === "attributes") {
        // Mutation records preserve a same-task busy/spinner state even if the
        // live element has already been restored by the time this callback runs.
        if (
          (record.attributeName === "aria-busy" &&
            record.oldValue === "true") ||
          (record.attributeName === "class" &&
            /(?:^|\s)(?:skeleton|spinner)(?:\s|$)/.test(record.oldValue ?? ""))
        ) {
          appendLoading(`${record.attributeName}=${record.oldValue}`);
        }
        inspect(record.target);
      } else for (const node of record.addedNodes) inspect(node);
    }
  }).observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    characterDataOldValue: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ["class", "aria-busy"],
  });
}

test("loading observer catches same-task insertion, text and busy/spinner flashes", async ({
  page,
}) => {
  await page.addInitScript(observeLoading);
  await page.goto("/request/new");
  await expect(
    page.getByRole("button", { name: "Create upload request", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    sessionStorage.setItem("request-navigation-loading", "[]");
    const host = document.createElement("div");
    document.body.append(host);
    const heading = document.createElement("h1");
    heading.textContent = "Please wait";
    host.append(heading);
    heading.remove();
    const transientText = document.createTextNode("Loading server limits…");
    host.append(transientText);
    transientText.remove();
    const existingText = document.createTextNode("Ready");
    host.append(existingText);
    existingText.data = "Loading";
    existingText.data = "Ready";
    host.setAttribute("aria-busy", "true");
    host.setAttribute("aria-busy", "false");
    host.className = "spinner";
    host.className = "";
    host.remove();
  });
  expect(
    await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("request-navigation-loading") ?? "[]"),
    ),
  ).toEqual(
    expect.arrayContaining([
      "Please wait",
      "Loading server limits…",
      "Loading",
      "aria-busy=true",
      "class=spinner",
    ]),
  );
});

for (const locale of ["en", "pl"] as const) {
  for (const entry of [
    "home",
    "header",
    "unavailable",
    "terminal",
    "direct",
  ] as const) {
    test(`no transient loading: ${locale} ${entry}, cold destination and stalled configuration`, async ({
      page,
      context,
      request,
    }) => {
      await context.addCookies([
        { name: "up-locale", value: locale, domain: "127.0.0.1", path: "/" },
      ]);
      await page.addInitScript(observeLoading);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      let releaseDestination!: () => void;
      const heldDestination = new Promise<void>((resolve) => {
        releaseDestination = resolve;
      });
      let destinationRequested!: () => void;
      const requested = new Promise<void>((resolve) => {
        destinationRequested = resolve;
      });
      let releaseConfiguration!: () => void;
      const heldConfiguration = new Promise<void>((resolve) => {
        releaseConfiguration = resolve;
      });
      await page.route("**/api/configuration", async (route) => {
        if (new URL(page.url()).pathname === "/request/new")
          await heldConfiguration;
        await route.continue();
      });
      let documentNavigation = false;
      await page.route("**/request/new*", async (route) => {
        const headers = route.request().headers();
        if (headers["next-router-prefetch"] || headers.purpose === "prefetch")
          return route.abort();
        documentNavigation = route.request().isNavigationRequest();
        destinationRequested();
        await heldDestination;
        await route.continue();
      });
      let managementToken: string | undefined;
      try {
        let source = "/request/manage";
        if (entry === "home") source = "/";
        if (entry === "terminal") {
          const created = await request.post("/api/upload-requests", {
            data: {
              expiresAt: new Date(Date.now() + 600_000).toISOString(),
              maxBytes: 1024,
            },
          });
          expect(created.status()).toBe(201);
          managementToken = (await created.json()).managementToken;
          expect(
            (
              await request.delete("/api/upload-requests/manage", {
                headers: { authorization: `Bearer ${managementToken}` },
              })
            ).ok(),
          ).toBe(true);
          source += `#${managementToken}`;
        }
        await page.goto(
          `${source}${source.includes("#") ? "" : `?lang=${locale}`}`,
        );
        if (source !== "/") {
          await expect(
            page.getByRole("heading", {
              name: translate(
                locale,
                entry === "terminal"
                  ? "Request status"
                  : "Owner link unavailable",
              ),
              exact: true,
            }),
          ).toBeVisible();
        }
        const name = translate(
          locale,
          entry === "home"
            ? "Request a file ↗"
            : entry === "unavailable" || entry === "terminal"
              ? "Create a new request"
              : "Request a file",
        );
        if (entry !== "direct")
          await expect(
            page.getByRole("link", { name, exact: true }),
          ).toBeVisible();
        await page.evaluate(() =>
          sessionStorage.setItem("request-navigation-loading", "[]"),
        );
        const navigating =
          entry === "direct"
            ? page.goto(`/request/new?lang=${locale}`)
            : page.getByRole("link", { name, exact: true }).click();
        await requested;
        // With document navigation, the old page survives the cold request.
        if (entry !== "direct") {
          // Chromium suspends script evaluation during document navigation.
          // Keep the cold response pending beyond the router fallback delay;
          // the observer records any intermediate App Router replacement.
          await page.waitForTimeout(750);
        }
        releaseDestination();
        await navigating;
        await expect(
          page.getByRole("heading", {
            name: translate(locale, "Request a file."),
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page).toHaveURL(/\/request\/new(?:\?lang=(?:en|pl))?$/);
        expect(
          await page.evaluate(() =>
            JSON.parse(
              sessionStorage.getItem("request-navigation-loading") ?? "[]",
            ),
          ),
        ).toEqual([]);
        expect(documentNavigation).toBe(true);
        await expect(
          page.getByRole("button", {
            name: translate(locale, "Create upload request"),
            exact: true,
          }),
        ).toBeEnabled();
        // Creation must not depend on a successful prefetch/configuration fetch.
        await page
          .getByRole("button", {
            name: translate(locale, "Create upload request"),
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("heading", {
            name: translate(locale, "Upload request created"),
          }),
        ).toBeVisible();
      } finally {
        releaseDestination();
        releaseConfiguration();
      }
    });
  }
}
