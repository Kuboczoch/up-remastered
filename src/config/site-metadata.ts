import type { Metadata } from "next";

import { siteDescription, siteName } from "@/config/site";
import { defaultLocale, type Locale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/messages";

export function createSiteMetadata(
  publicOrigin: string,
  locale: Locale = defaultLocale,
): Metadata {
  const description =
    locale === "en"
      ? siteDescription
      : translate(locale, "Small self-hosted temporary file hosting service.");
  return {
    metadataBase: new URL(publicOrigin),
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
