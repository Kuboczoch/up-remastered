import { renderToStaticMarkup } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import { SiteFooter, SiteHeader } from "./site-chrome";
import { LocaleProvider } from "@/lib/i18n/provider";
import { createSiteMetadata } from "@/config/site-metadata";
import { siteDescription } from "@/config/site";

it("renders Polish chrome in initial HTML, including accessible labels", () => {
  const html = renderToStaticMarkup(
    <LocaleProvider locale="pl">
      <SiteHeader />
      <SiteFooter />
    </LocaleProvider>,
  );
  expect(html).toContain("Poproś o plik");
  expect(html).toContain("Z założenia tymczasowe.");
  expect(html).toContain('aria-label="Stopka"');
  expect(html).toContain('href="/sh" download=""');
  expect(html).toContain('href="/sharex" download=""');
  expect(html).not.toContain("Request a file");
});

it("changes context without stale English controls or changed helper URLs", () => {
  const { rerender } = render(
    <LocaleProvider locale="en">
      <SiteHeader />
      <SiteFooter />
    </LocaleProvider>,
  );
  expect(
    screen.getByRole("link", { name: "Request a file" }).getAttribute("href"),
  ).toBe("/request/new");
  rerender(
    <LocaleProvider locale="pl">
      <SiteHeader />
      <SiteFooter />
    </LocaleProvider>,
  );
  expect(screen.queryByRole("link", { name: "Request a file" })).toBeNull();
  expect(
    screen.getByRole("link", { name: "Poproś o plik" }).getAttribute("href"),
  ).toBe("/request/new");
  expect(
    screen.getByRole("link", { name: "Pomocnik powłoki" }).getAttribute("href"),
  ).toBe("/sh");
});

it("localizes metadata without changing build-origin or canonical contracts", () => {
  const en = createSiteMetadata("https://files.example");
  const pl = createSiteMetadata("https://files.example", "pl");
  expect(en.description).toBe(siteDescription);
  expect(pl.description).toBe(
    "Mały, samodzielnie hostowany serwis do tymczasowego udostępniania plików.",
  );
  expect(pl.openGraph?.description).toBe(pl.description);
  expect(pl.twitter?.description).toBe(pl.description);
  expect(String(pl.metadataBase)).toBe("https://files.example/");
  expect(pl.alternates).toEqual(en.alternates);
});
