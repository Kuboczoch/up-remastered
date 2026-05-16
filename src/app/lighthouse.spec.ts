import { writeFile } from "node:fs/promises";
import { createServer } from "node:net";

import { expect, test } from "@playwright/test";
import lighthouse from "lighthouse";
import { chromium } from "playwright";

const auditedCategories = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
] as const;

const minimumScores: Record<(typeof auditedCategories)[number], number> = {
  performance: 0.9,
  accessibility: 1,
  "best-practices": 0.95,
  seo: 1,
};

test("tracks the homepage Lighthouse baseline", async ({
  baseURL,
}, testInfo) => {
  expect(baseURL).toBeDefined();

  const port = await getUnusedPort();
  const browser = await chromium.launch({
    args: [`--remote-debugging-port=${port}`],
  });

  try {
    const result = await lighthouse(`${baseURL}/`, {
      formFactor: "desktop",
      logLevel: "error",
      onlyCategories: [...auditedCategories],
      output: "json",
      port,
      screenEmulation: {
        disabled: false,
        mobile: false,
        width: 1350,
        height: 940,
        deviceScaleFactor: 1,
      },
    });

    expect(result).toBeDefined();

    const lhr = result?.lhr;
    expect(lhr).toBeDefined();

    const scores = Object.fromEntries(
      auditedCategories.map((category) => {
        const score = lhr?.categories[category]?.score;

        expect(score).not.toBeNull();
        expect(score ?? 0).toBeGreaterThanOrEqual(minimumScores[category]);

        return [category, Math.round((score ?? 0) * 100)];
      }),
    );

    const outputPath = testInfo.outputPath("lighthouse-homepage.json");
    await writeFile(
      outputPath,
      JSON.stringify(
        {
          url: lhr?.finalDisplayedUrl,
          fetchTime: lhr?.fetchTime,
          scores,
          minimumScores: Object.fromEntries(
            Object.entries(minimumScores).map(([category, score]) => [
              category,
              Math.round(score * 100),
            ]),
          ),
        },
        null,
        2,
      ),
    );
    await testInfo.attach("lighthouse-homepage", {
      path: outputPath,
      contentType: "application/json",
    });
  } finally {
    await browser.close();
  }
});

async function getUnusedPort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to allocate a TCP port.")));
        return;
      }

      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}
