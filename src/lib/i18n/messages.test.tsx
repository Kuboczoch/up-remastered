import { renderToStaticMarkup } from "react-dom/server";
import { dictionaries, translate, translateMessage } from "./messages";
import { LocaleProvider, T } from "./provider";

describe("SSR-safe translation registry", () => {
  it("has identical complete English/Polish key and placeholder coverage", () => {
    expect(Object.keys(dictionaries.pl).sort()).toEqual(
      Object.keys(dictionaries.en).sort(),
    );
    for (const key of Object.keys(
      dictionaries.en,
    ) as (keyof typeof dictionaries.en)[]) {
      expect(dictionaries.pl[key]).not.toBe("");
      expect(dictionaries.pl[key].match(/\{\w+\}/g)?.sort() ?? []).toEqual(
        key.match(/\{\w+\}/g)?.sort() ?? [],
      );
    }
  });

  it("interpolates values once without interpreting markup or replacement syntax", () => {
    expect(
      translate("pl", "{name} was deleted.", {
        name: "<script>$&{name}</script>",
      }),
    ).toBe("Plik <script>$&{name}</script> został usunięty.");
    expect(translate("en", "{name} was deleted.")).toBe("{name} was deleted.");
  });

  it("whitelists errors rather than displaying remote text", () => {
    expect(translateMessage("pl", "server secret token=abc")).toBe(
      "Coś poszło nie tak",
    );
    expect(translateMessage("pl", "Upload failed. Try again.")).toBe(
      "Przesyłanie nie powiodło się. Spróbuj ponownie.",
    );
  });

  it("produces translated initial markup and isolates sequential SSR requests", () => {
    const render = (locale: "en" | "pl") =>
      renderToStaticMarkup(
        <LocaleProvider locale={locale}>
          <p>
            <T id="Request a file" />
          </p>
          <T id="{name} was deleted." values={{ name: "<private>" }} />
        </LocaleProvider>,
      );
    expect(render("pl")).toBe(
      "<p>Poproś o plik</p>Plik &lt;private&gt; został usunięty.",
    );
    expect(render("en")).toBe(
      "<p>Request a file</p>&lt;private&gt; was deleted.",
    );
    expect(render("pl")).toContain("Poproś o plik");
  });
});
