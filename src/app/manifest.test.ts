import { describe, expect, it } from "@jest/globals";

import { siteDescription, siteName } from "@/config/site";

import manifest from "./manifest";

describe("web manifest", () => {
  it("describes the shipped app and local icons", () => {
    expect(manifest()).toEqual({
      name: siteName,
      short_name: "up",
      description: siteDescription,
      start_url: "/",
      display: "standalone",
      background_color: "#202127",
      theme_color: "#202127",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
  });
});
