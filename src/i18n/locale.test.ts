import { resolveLocale, mergeVary } from "./locale";

describe("locale negotiation", () => {
  test.each([
    [undefined, "en"], ["", "en"], ["pl", "pl"],
    ["PL-pl", "pl"], ["en;q=0.2, pl-PL;q=0.8", "pl"],
    ["en;q=0.9,pl", "pl"], ["pl,en", "pl"],
    ["fr,pl;q=0.4", "pl"], ["en;q=0,*;q=0.8", "pl"],
    ["pl;q=0,*", "en"], ["*;q=0,pl;q=0.8", "pl"],
    ["pl;q=wat,en;q=0.5", "en"], ["pl;q=1.1", "en"],
    ["pl;q=0.1234", "en"], ["fr", "en"],
    ["en;q=0,pl;q=0", "en"], ["*;q=0", "en"],
    ["pl;q=0,pl-PL;q=1,en;q=0.5", "en"],
  ])("%s resolves to %s", (header, expected) => {
    expect(resolveLocale(header)).toBe(expected);
  });
  it("honors supported explicit choice over hints", () => {
    expect(resolveLocale("pl", "en")).toBe("en");
    expect(resolveLocale("en", "pl")).toBe("pl");
    expect(resolveLocale("pl", "fr")).toBe("pl");
  });
  it("merges Vary without dropping framework tokens", () => {
    expect(mergeVary("RSC, Next-Router-State-Tree", "Accept-Language", "Cookie"))
      .toBe("RSC, Next-Router-State-Tree, Accept-Language, Cookie");
    expect(mergeVary("accept-language", "Accept-Language")).toBe("accept-language");
    expect(mergeVary("*", "Accept-Language")).toBe("*");
  });
});
