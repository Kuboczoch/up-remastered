import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { isLocale, supportedLocales } from "@/i18n/locale";
import { LocaleProvider } from "@/i18n/provider";
import { createSiteMetadata } from "@/config/site-metadata";
import { getPublicOrigin } from "@/server/config/public-url";
import "../../globals.css";

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#202127",
};
export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}
type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return createSiteMetadata(getPublicOrigin(), locale);
}
/** Separate root: Next layouts only receive params ABOVE their segment. */
export default async function LocalizedLayout({ children, params }: Props) {
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
