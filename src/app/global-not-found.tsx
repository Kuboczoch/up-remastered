import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { localeCookie, resolveLocale } from "@/i18n/locale";
import { LocaleProvider } from "@/i18n/provider";
import NotFound from "./not-found";
import "./globals.css";

import { translate } from "@/i18n/messages";

async function getErrorLocale() {
  const [requestHeaders, requestCookies] = await Promise.all([
    headers(),
    cookies(),
  ]);
  return resolveLocale(
    requestHeaders.get("accept-language"),
    requestHeaders.get("x-up-not-found-locale") ??
      requestCookies.get(localeCookie)?.value,
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getErrorLocale();
  return {
    title: `${translate(locale, "Page not found")} | Up - Remastered`,
    description: translate(
      locale,
      "The requested page or file is unavailable.",
    ),
  };
}

export default async function GlobalNotFound() {
  const locale = await getErrorLocale();
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale}>
          <NotFound />
        </LocaleProvider>
      </body>
    </html>
  );
}
