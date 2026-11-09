import type { Metadata, Viewport } from "next";

import { createSiteMetadata } from "@/config/site-metadata";
import { getPublicOrigin } from "@/server/config/public-url";

import { notFound } from "next/navigation";
import { isLocale, supportedLocales } from "@/lib/i18n/locale";
import { LocaleProvider } from "@/lib/i18n/provider";
import "../../globals.css";

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#202127",
};

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return createSiteMetadata(getPublicOrigin(), locale);
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
