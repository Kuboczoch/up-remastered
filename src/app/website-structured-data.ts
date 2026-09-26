import { siteDescription, siteName } from "@/config/site";

export type WebsiteStructuredData = {
  "@context": "https://schema.org";
  "@type": "WebSite";
  description: string;
  name: string;
  url: string;
};

export function createWebsiteStructuredData(
  url: string,
): WebsiteStructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    description: siteDescription,
    name: siteName,
    url,
  };
}

export function serializeStructuredData(data: WebsiteStructuredData): string {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}
