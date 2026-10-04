import { siteDescription, siteName } from "@/config/site";
import { translate } from "@/i18n/messages";
import type { Locale } from "@/i18n/locale";

export type WebsiteStructuredData = {
  "@context": "https://schema.org";
  "@type": "WebSite";
  description: string;
  name: string;
  url: string;
};

export function createWebsiteStructuredData(
  url: string,
  locale: Locale = "en",
): WebsiteStructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    description: translate(locale, siteDescription),
    name: siteName,
    url,
  };
}

export function serializeStructuredData(data: WebsiteStructuredData): string {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}
