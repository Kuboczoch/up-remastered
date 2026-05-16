import type { MetadataRoute } from "next";

import { getPublicUrl } from "@/server/config/public-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/download/", "/share/"],
    },
    sitemap: getPublicUrl("/sitemap.xml"),
  };
}
