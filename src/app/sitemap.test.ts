import { describe, expect, it, jest } from "@jest/globals";

import sitemap from "./sitemap";

jest.mock("server-only", () => ({}));

describe("sitemap", () => {
  it("lists only the public homepage", () => {
    process.env.UP_PUBLIC_ORIGIN = "https://up.example.test";

    expect(sitemap()).toEqual([
      {
        url: "https://up.example.test/",
        lastModified: expect.any(Date),
        changeFrequency: "weekly",
        priority: 1,
      },
    ]);
  });
});
