import { describe, expect, it } from "@jest/globals";

import {
  createWebsiteStructuredData,
  serializeStructuredData,
} from "./website-structured-data";

describe("website structured data", () => {
  it("describes only the shipped public website", () => {
    expect(createWebsiteStructuredData("https://up.example.test/")).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      description: "Small self-hosted temporary file hosting service.",
      name: "Up - Remastered",
      url: "https://up.example.test/",
    });
  });

  it("serializes JSON-LD without allowing a closing script tag", () => {
    const serialized = serializeStructuredData({
      ...createWebsiteStructuredData("https://up.example.test/"),
      name: "</script>",
    });

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toMatchObject({ name: "</script>" });
  });
});
