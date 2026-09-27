import { describe, expect, it } from "@jest/globals";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sourcePath = join(root, "public", "brand-mark.svg");
const generatedAssets = [
  {
    path: "src/app/icon.png",
    sha256: "8876018e31335e18187cb01cce05def6aaba0e61c18519f32f927c180882ea79",
    size: 512,
  },
  {
    path: "src/app/apple-icon.png",
    sha256: "f8b68a7b950481ec00c470e6821a8ff2ce86343da9790227f02a904080e16866",
    size: 180,
  },
  {
    path: "public/icons/icon-192.png",
    sha256: "fda125c95cc3b92486302f5458fe93fa9c631740dc39213f6013d85c5124ded7",
    size: 192,
  },
  {
    path: "public/icons/icon-512.png",
    sha256: "8876018e31335e18187cb01cce05def6aaba0e61c18519f32f927c180882ea79",
    size: 512,
  },
] as const;

describe("brand assets", () => {
  it("keeps the canonical mark monochrome and transparent outside its shape", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain('fill="#111b2b"');
    expect(source).toContain('fill="#fff"');
    expect(source).toContain(
      '<rect width="512" height="512" rx="152" fill="#111b2b"',
    );
    expect(source).not.toMatch(/#(?:1267e9|38bdf8)/i);
  });

  it.each(generatedAssets)(
    "keeps $path synchronized with the approved source rendering",
    ({ path, sha256, size }) => {
      const asset = readFileSync(join(root, path));

      expect(createHash("sha256").update(asset).digest("hex")).toBe(sha256);
      expect(asset.subarray(1, 4).toString("ascii")).toBe("PNG");
      expect(asset.readUInt32BE(16)).toBe(size);
      expect(asset.readUInt32BE(20)).toBe(size);
      expect(asset[25]).toBe(6);
    },
  );

  it("keeps the legacy favicon synchronized with the approved source rendering", () => {
    const favicon = readFileSync(join(root, "src", "app", "favicon.ico"));

    expect(createHash("sha256").update(favicon).digest("hex")).toBe(
      "6f0720f204634d65e5048143e64a9765c28894217df5e0c98f8033d1b513e0c5",
    );
    expect(favicon.readUInt16LE(0)).toBe(0);
    expect(favicon.readUInt16LE(2)).toBe(1);
    expect(favicon.readUInt16LE(4)).toBe(3);
    expect(
      Array.from({ length: 3 }, (_, index) => [
        favicon[6 + index * 16],
        favicon[7 + index * 16],
      ]),
    ).toEqual([
      [48, 48],
      [32, 32],
      [16, 16],
    ]);
  });
});
