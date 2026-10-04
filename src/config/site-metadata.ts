import type { Metadata } from "next";

import { siteDescription, siteName } from "@/config/site";
import { translate, type MessageKey } from "@/i18n/messages";
import { type Locale } from "@/i18n/locale";

export function createSiteMetadata(
  publicOrigin: string,
  locale: Locale = "en",
): Metadata {
  const description = translate(locale, siteDescription as MessageKey);
  return {
    metadataBase: new URL(publicOrigin),
    manifest: `/locale/${locale}/manifest.webmanifest`,
    title: siteName,
    description,
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      url: "/",
      title: siteName,
      description,
      siteName,
    },
    twitter: {
      card: "summary",
      title: siteName,
      description,
    },
  };
}
