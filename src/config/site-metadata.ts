import type { Metadata } from "next";

import { siteDescription, siteName } from "@/config/site";

export function createSiteMetadata(publicOrigin: string): Metadata {
  return {
    metadataBase: new URL(publicOrigin),
    title: siteName,
    description: siteDescription,
    alternates: {
      canonical: "/",
    },
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
  };
}
