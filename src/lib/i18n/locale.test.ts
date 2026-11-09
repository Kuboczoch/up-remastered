import { isLocale, resolveLocale } from "./locale";

describe("locale negotiation", () => {
  test.each([
    [undefined, "en"],
    ["", "en"],
    ["pl", "pl"],
    ["PL-pl", "pl"],
    ["en;q=0.2, pl-PL;q=0.8", "pl"],
    ["pl,en", "pl"],
    ["fr,pl;q=0.4", "pl"],
    ["en;q=0,*;q=0.8", "pl"],
    ["pl;q=0,*", "en"],
    ["*;q=0,pl;q=0.8", "pl"],
    ["pl;q=wat,en;q=0.5", "en"],
    ["pl;q=1.1", "en"],
    ["pl;q=0.1234", "en"],
    ["pl;extra=1,en;q=0.5", "en"],
    ["fr", "en"],
    ["en;q=0,pl;q=0", "en"],
    ["*;q=0", "en"],
    ["pl;q=0,pl-PL;q=1,en;q=0.5", "en"],
  ])("%s resolves to %s", (header, expected) => {
    expect(resolveLocale({ acceptLanguage: header })).toBe(expected);
  });

  it("uses valid query then saved preference then language hints", () => {
    expect(
      resolveLocale({ query: "en", cookie: "pl", acceptLanguage: "pl" }),
    ).toBe("en");
    expect(
      resolveLocale({ query: "fr", cookie: "pl", acceptLanguage: "en" }),
    ).toBe("pl");
    expect(resolveLocale({ cookie: "fr", acceptLanguage: "pl" })).toBe("pl");
    expect(resolveLocale({ query: "__proto__", cookie: "constructor" })).toBe(
      "en",
    );
  });

  it("rejects unsupported and non-string choices", () => {
    for (const value of [
      null,
      undefined,
      {},
      ["pl"],
      "PL",
      "pl-PL",
      "toString",
    ]) {
      expect(isLocale(value)).toBe(false);
    }
    expect(isLocale("en")).toBe(true);
    expect(isLocale("pl")).toBe(true);
  });

  it("bounds untrusted hint processing", () => {
    expect(resolveLocale({ acceptLanguage: `${" ".repeat(8192)}pl` })).toBe(
      "en",
    );
  });
});
