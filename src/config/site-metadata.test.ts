import { describe, expect, it } from "@jest/globals";

import { createPageTitle, siteDescription, siteName } from "./site";
import { createSiteMetadata } from "./site-metadata";

describe("site metadata", () => {
  it("uses the exact product name for home and descriptive route titles", () => {
    expect(siteName).toBe("Up - Remastered");
    expect(createPageTitle("Request a file")).toBe(
      "Request a file | Up - Remastered",
    );
  });

  it("uses the configured public origin for canonical and social URLs", () => {
    const metadata = createSiteMetadata("https://up.example.test");

    expect(metadata).toMatchObject({
      metadataBase: new URL("https://up.example.test"),
      title: siteName,
      description: siteDescription,
      alternates: { canonical: "/" },
      openGraph: {
        type: "website",
        url: "/",
        title: siteName,
        description: siteDescription,
        siteName,
      },
      twitter: {
        card: "summary",
        title: siteName,
        description: siteDescription,
      },
    });
  });
});
