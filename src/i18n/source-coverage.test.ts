import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { dictionaries, polish, translate, type MessageKey } from "./messages";

const files = [
  "src/components/upload/upload-experience.tsx",
  "src/components/manual-copy-link.tsx",
  "src/components/destructive-confirmation.tsx",
  "src/app/request/new/content.tsx",
  "src/app/request/new/create-request-form.tsx",
  "src/app/request/[token]/content.tsx",
  "src/app/request/[token]/requested-upload-form.tsx",
  "src/app/request/manage/content.tsx",
  "src/app/request/manage/manage-request.tsx",
  "src/app/request/request-owner-status.tsx",
  "src/app/request/copy-request-link.tsx",
  "src/app/request/request-expiry.tsx",
];
test.each(files)(
  "%s contains no raw app-owned JSX text or accessible labels",
  (file) => {
    const source = ts.createSourceFile(
      file,
      readFileSync(join(process.cwd(), file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const untranslated: string[] = [];
    function walk(node: ts.Node) {
      // Symbols, punctuation and literal numeric ticks are language-neutral.
      if (ts.isJsxText(node) && /\p{L}/u.test(node.text))
        untranslated.push(node.text.trim());
      if (
        ts.isJsxAttribute(node) &&
        ["aria-label", "title", "placeholder", "alt"].includes(
          node.name.getText(source),
        ) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer)
      )
        untranslated.push(node.initializer.text);
      ts.forEachChild(node, walk);
    }
    walk(source);
    expect(untranslated).toEqual([]);
  },
);
test("English and Polish dictionaries have identical typed coverage and preserve interpolated values", () => {
  expect(Object.keys(dictionaries.en).sort()).toEqual(
    Object.keys(dictionaries.pl).sort(),
  );
  for (const key of Object.keys(polish) as MessageKey[]) {
    expect(translate("en", key)).toBe(key);
    const values = Object.fromEntries(
      [...key.matchAll(/\{(\w+)\}/g)].map((match) => [
        match[1],
        "DoNotTranslate.txt#key=ABC",
      ]),
    );
    expect(translate("pl", key, values)).not.toMatch(/\{\w+\}/);
  }
});
