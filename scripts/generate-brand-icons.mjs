import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "brand-mark.svg");
const pngTargets = [
  [join(root, "src", "app", "icon.png"), 512],
  [join(root, "src", "app", "apple-icon.png"), 180],
  [join(root, "public", "icons", "icon-192.png"), 192],
  [join(root, "public", "icons", "icon-512.png"), 512],
];

function runMagick(args) {
  const result = spawnSync("magick", args, { stdio: "inherit" });

  if (result.error?.code === "ENOENT") {
    throw new Error("ImageMagick 7 is required to generate brand icons.");
  }
  if (result.status !== 0) {
    throw new Error(`magick exited with status ${result.status ?? "unknown"}`);
  }
}

for (const [target, size] of pngTargets) {
  runMagick([
    "-background",
    "none",
    "-define",
    "png:color-type=6",
    source,
    "-resize",
    `${size}x${size}`,
    target,
  ]);
}

runMagick([
  "-background",
  "none",
  source,
  "-define",
  "icon:auto-resize=48,32,16",
  join(root, "src", "app", "favicon.ico"),
]);
