import type { MetadataRoute } from "next";

import { siteDescription, siteName } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: "up",
    description: siteDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#202127",
    theme_color: "#202127",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
