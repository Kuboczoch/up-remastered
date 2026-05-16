import { describe, expect, it, jest } from "@jest/globals";

import robots from "./robots";

jest.mock("server-only", () => ({}));

describe("robots", () => {
  it("allows the homepage and disallows private URL spaces", () => {
    process.env.UP_PUBLIC_ORIGIN = "https://up.example.test";

    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/download/", "/share/"],
      },
      sitemap: "https://up.example.test/sitemap.xml",
    });
  });
});
