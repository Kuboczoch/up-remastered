import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { LocaleProvider, T, useTranslation } from "./provider";
import { polish, translate, translateMessage } from "./messages";
import { createSiteMetadata } from "@/config/site-metadata";
import { createManifest } from "@/config/manifest";

describe("translated representations", () => {
  it("renders Polish without effects, browser globals, or DOM replacement", () => {
    expect(
      renderToString(
        <LocaleProvider locale="pl">
          <T id="Request a file" />
        </LocaleProvider>,
      ),
    ).toContain("Poproś o plik");
    expect(renderToString(<T id="Request a file" />)).toBe("Request a file");
  });
  it("preserves caller-provided data during interpolation", () => {
    expect(translate("pl", "{siteName} home", { siteName: "A <B>" })).toBe(
      "A <B> — strona główna",
    );
    expect(translateMessage("pl", "UPLOAD_REQUEST_EXPIRED")).toBe(
      "UPLOAD_REQUEST_EXPIRED",
    );
    expect(translateMessage("pl", "my-file-name.txt")).toBe("my-file-name.txt");
  });
  it("all registered translations are actual nonempty Polish messages", () => {
    for (const [key, value] of Object.entries(polish)) {
      expect(value.trim()).not.toBe("");
      expect(value).not.toBe(key);
      const parameters = (text: string) =>
        Array.from(text.matchAll(/\{(\w+)\}/g), (m) => m[1]).sort();
      expect(parameters(value)).toEqual(parameters(key));
    }
  });
  it("uses the resolved locale for messages, numbers, dates and expiry", () => {
    function Sample() {
      const { t, formatBytes, formatDateTime, formatExpiry } = useTranslation();
      return (
        <p>
          {t("Request a file")} | {formatBytes(1536)} |{" "}
          {formatDateTime("2026-01-02T12:00:00Z")} | {formatExpiry(0, 1)}
        </p>
      );
    }
    render(
      <LocaleProvider locale="pl">
        <Sample />
      </LocaleProvider>,
    );
    expect(screen.getByText(/Poproś o plik/).textContent).toContain("1,5 KiB");
    expect(screen.getByText(/Poproś o plik/).textContent).toContain("wygasło");
  });
  it("localizes all metadata while retaining deployment URLs", () => {
    const metadata = createSiteMetadata("https://example.test", "pl");
    expect(metadata.description).toContain("tymczasowego");
    expect(metadata.metadataBase?.toString()).toBe("https://example.test/");
    expect(metadata.manifest).toBe("/locale/pl/manifest.webmanifest");
    expect(createManifest("pl").lang).toBe("pl");
  });
});
