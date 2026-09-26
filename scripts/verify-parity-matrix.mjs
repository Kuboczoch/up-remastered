import { readFileSync } from "node:fs";

const markdown = readFileSync("docs/project/upstream-parity.md", "utf8");
const rows = markdown.split("\n").filter((line) => line.startsWith("| [#"));
const ids = rows.map((line) => Number(line.match(/^\| \[#(\d+)\]/)?.[1]));
const generic = rows.filter((line) =>
  line.includes("Implemented in remastered with automated coverage"),
);
if (rows.length !== 125 || new Set(ids).size !== 125 || generic.length) {
  throw new Error(
    `Parity matrix incomplete: rows=${rows.length}, unique=${new Set(ids).size}, generic=${generic.length}`,
  );
}
console.log(
  JSON.stringify({ event: "parity_matrix_verified", rows: rows.length }),
);
