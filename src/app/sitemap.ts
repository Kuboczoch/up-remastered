import type { MetadataRoute } from "next";

import { getPublicUrl } from "@/server/config/public-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: getPublicUrl("/"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
