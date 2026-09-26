import { writeFile } from "node:fs/promises";
import { createServer } from "node:net";

import { chromium, expect, test } from "@playwright/test";
import lighthouse from "lighthouse";

const auditedCategories = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
] as const;

const minimumScores: Record<(typeof auditedCategories)[number], number> = {
  performance: 0.95,
  accessibility: 1,
  "best-practices": 0.95,
  seo: 1,
};

test("tracks the homepage Lighthouse baseline", async ({
  baseURL,
}, testInfo) => {
  expect(baseURL).toBeDefined();

  const remoteDebuggingPort = await reserveRemoteDebuggingPort();
  const browser = await chromium.launch({
    args: [`--remote-debugging-port=${remoteDebuggingPort}`],
  });

  try {
    const result = await lighthouse(`${baseURL}/`, {
      formFactor: "desktop",
      logLevel: "error",
      onlyCategories: [...auditedCategories],
      output: "json",
      port: remoteDebuggingPort,
      throttlingMethod: "provided",
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
          performanceAudits: lhr?.categories.performance.auditRefs
            .filter(({ weight }) => weight > 0)
            .map(({ id, weight }) => ({
              id,
              score: Math.round((lhr.audits[id]?.score ?? 0) * 100),
              title: lhr.audits[id]?.title,
              value: lhr.audits[id]?.displayValue,
              weight,
            })),
          lcpDiagnostics: Object.fromEntries(
            Object.entries(lhr?.audits ?? {})
              .filter(([id]) => /lcp|largest-contentful-paint/i.test(id))
              .map(([id, audit]) => [
                id,
                {
                  displayValue: audit.displayValue,
                  score: audit.score,
                  details: audit.details,
                },
              ]),
          ),
          failedInsights: Object.fromEntries(
            Object.entries(lhr?.audits ?? {})
              .filter(
                ([id, audit]) => id.endsWith("-insight") && audit.score !== 1,
              )
              .map(([id, audit]) => [id, audit.details]),
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

    for (const category of auditedCategories) {
      const score = lhr?.categories[category]?.score;

      expect(score).not.toBeNull();
      expect(score ?? 0).toBeGreaterThanOrEqual(minimumScores[category]);
    }

    expect(
      lhr?.audits["first-contentful-paint"]?.numericValue,
    ).toBeLessThanOrEqual(1_000);
    expect(
      lhr?.audits["largest-contentful-paint"]?.numericValue,
    ).toBeLessThanOrEqual(1_500);
    expect(
      lhr?.audits["total-blocking-time"]?.numericValue,
    ).toBeLessThanOrEqual(200);
    expect(
      lhr?.audits["cumulative-layout-shift"]?.numericValue,
    ).toBeLessThanOrEqual(0.1);
  } finally {
    await browser.close();
  }
});

async function reserveRemoteDebuggingPort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close(() =>
          reject(new Error("Unable to reserve a remote debugging port.")),
        );
        return;
      }

      server.close(() => resolve(address.port));
    });
  });
}
