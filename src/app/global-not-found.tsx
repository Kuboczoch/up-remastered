import "./globals.css";
import { headers } from "next/headers";
import { isLocale } from "@/lib/i18n/locale";
import { LocaleProvider } from "@/lib/i18n/provider";
import { translate } from "@/lib/i18n/messages";
import NotFound from "./l10n/[locale]/not-found";

export default async function GlobalNotFound() {
  const value = (await headers()).get("x-up-locale");
  const locale = isLocale(value) ? value : "en";
  return (
    <html lang={locale}>
      <head>
        <title>{translate(locale, "Page not found")}</title>
      </head>
      <body>
        <LocaleProvider locale={locale}>
          <NotFound />
        </LocaleProvider>
      </body>
    </html>
  );
}
