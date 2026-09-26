import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const files = execFileSync("git", ["ls-files", "*.md"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
const broken = [];
let checked = 0;
for (const file of files) {
  const markdown = readFileSync(file, "utf8");
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0].split("?")[0];
    if (!target || /^(?:https?:|mailto:|#)/.test(target)) continue;
    checked += 1;
    if (!existsSync(resolve(dirname(file), decodeURIComponent(target)))) {
      broken.push(`${file}: ${match[1]}`);
    }
  }
}
if (broken.length)
  throw new Error(`Broken Markdown links:\n${broken.join("\n")}`);
console.log(JSON.stringify({ event: "markdown_links_verified", checked }));
