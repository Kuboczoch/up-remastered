import { readFileSync } from "node:fs";
import { join } from "node:path";

// Source contracts only: JSDOM does not measure CSS layout. Browser geometry
// (including wrapping, overlap and hit testing) lives in mobile-navigation.spec.ts.
function rulesFor(source: string, selector: string) {
  const rules = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
    ([, selectors]) =>
      selectors.split(",").some((part) => part.trim() === selector),
  );
  return rules.map(([, , declarations]) => declarations).join("\n");
}

const globalSource = readFileSync(
  join(process.cwd(), "src/app/globals.css"),
  "utf8",
);
const requestSource = readFileSync(
  join(process.cwd(), "src/app/request/request.module.css"),
  "utf8",
);
const media = "@media (max-width: 760px)";
const globals = globalSource.slice(globalSource.lastIndexOf(media));
const request = requestSource.slice(requestSource.lastIndexOf(media));

describe("mobile navigation CSS source contracts", () => {
  test.each([
    ".upload-rail a",
    ".site-footer a",
    ".site-header > .outline-button",
    ".site-brand",
  ])("%s has a real minimum 44px hit area", (selector) => {
    const rule = rulesFor(globals, selector);
    expect(rule).toMatch(/min-height:\s*44px/);
    expect(rule).toMatch(/min-width:\s*44px/);
  });

  test.each([".header a", ".button", ".linkButton"])(
    "request %s has a real minimum 44px hit area",
    (selector) => {
      const rule = rulesFor(request, selector);
      expect(rule).toMatch(/min-height:\s*44px/);
      expect(rule).toMatch(/min-width:\s*44px/);
    },
  );

  test("footer has safe-area padding without inflating link typography", () => {
    expect(rulesFor(globals, ".site-footer-inner")).toContain(
      "env(safe-area-inset-bottom)",
    );
    expect(rulesFor(globals, ".site-footer a")).not.toMatch(/font-size:/);
    expect(rulesFor(globals, ".upload-rail a")).not.toMatch(/font-size:/);
  });
});
