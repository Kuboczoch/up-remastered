import type { Metadata, Viewport } from "next";
import { createSiteMetadata } from "@/config/site-metadata";
import { getPublicOrigin } from "@/server/config/public-url";
import { defaultLocale, isLocale } from "@/i18n/locale";
import { LocaleProvider } from "@/i18n/provider";
import "../globals.css";

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#202127",
};
type LayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale?: string }>;
}>;
export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { locale } = await params;
  return createSiteMetadata(
    getPublicOrigin(),
    isLocale(locale) ? locale : defaultLocale,
  );
}
export default async function RootLayout({ children, params }: LayoutProps) {
  const { locale: requested } = await params;
  const locale = isLocale(requested) ? requested : defaultLocale;
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
