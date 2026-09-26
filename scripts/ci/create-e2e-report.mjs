import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

const marker = "<!-- up-remastered-e2e-report -->";
const inputPath = process.argv[2] ?? "playwright-report/results.json";
const outputPath = process.argv[3] ?? "pr-e2e-report.md";

function collectResults(suites) {
  const results = [];

  for (const suite of suites ?? []) {
    results.push(...collectResults(suite.suites));

    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          results.push({ result, title: spec.title });
        }
      }
    }
  }

  return results;
}

async function readLighthouseScores(results) {
  for (const { result } of results) {
    const attachment = result.attachments?.find(
      ({ name }) => name === "lighthouse-homepage",
    );

    if (!attachment?.path) {
      continue;
    }

    const attachmentPath = isAbsolute(attachment.path)
      ? attachment.path
      : resolve(attachment.path);
    const report = JSON.parse(await readFile(attachmentPath, "utf8"));

    return {
      minimumScores: report.minimumScores,
      scores: report.scores,
    };
  }

  return undefined;
}

function firstFailure(results) {
  for (const { result, title } of results) {
    const error = result.errors?.[0];

    if (error) {
      return `${title}: ${error.message ?? error.stack ?? "Unknown failure"}`;
    }
  }

  return undefined;
}

function runUrl() {
  const server = process.env.GITHUB_SERVER_URL;
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;

  return server && repository && runId
    ? `${server}/${repository}/actions/runs/${runId}`
    : undefined;
}

async function main() {
  let report;

  try {
    report = JSON.parse(await readFile(inputPath, "utf8"));
  } catch (error) {
    await writeFile(
      outputPath,
      `${marker}\n## Playwright and Lighthouse\n\nReport unavailable: ${error.message}\n`,
    );
    return;
  }

  const results = collectResults(report.suites);
  const lighthouse = await readLighthouseScores(results).catch(() => undefined);
  const stats = report.stats ?? {};
  const lines = [
    marker,
    "## Playwright and Lighthouse",
    "",
    `**Playwright:** ${stats.unexpected ? "❌ failed" : "✅ passed"}`,
    "",
    "| Passed | Failed | Flaky | Skipped |",
    "| ---: | ---: | ---: | ---: |",
    `| ${stats.expected ?? 0} | ${stats.unexpected ?? 0} | ${stats.flaky ?? 0} | ${stats.skipped ?? 0} |`,
    "",
  ];

  if (lighthouse) {
    lines.push(
      "| Lighthouse category | Score | Minimum |",
      "| --- | ---: | ---: |",
      ...Object.entries(lighthouse.scores).map(
        ([category, score]) =>
          `| ${category} | ${score} | ${lighthouse.minimumScores?.[category] ?? "—"} |`,
      ),
      "",
    );
  } else {
    lines.push("**Lighthouse:** no score attachment was produced.", "");
  }

  const failure = firstFailure(results);
  if (failure) {
    lines.push(
      "<details><summary>Latest failure</summary>",
      "",
      "```text",
      failure.slice(0, 4000).replaceAll("```", "'''"),
      "```",
      "",
      "</details>",
      "",
    );
  }

  const url = runUrl();
  if (url) {
    lines.push(`[Workflow run](${url})`, "");
  }

  await writeFile(outputPath, `${lines.join("\n")}\n`);
}

await main();
