"use client";

import { createContext, useContext, useMemo } from "react";
import { defaultLocale, type Locale } from "./locale";
import {
  translate,
  translateMessage,
  type MessageKey,
  type MessageValues,
} from "./messages";
import {
  formatBytes,
  formatLocalDateTime,
  formatRelativeExpiry,
} from "@/lib/format";

const LocaleContext = createContext<Locale>(defaultLocale);
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}
export function useTranslation() {
  const locale = useContext(LocaleContext);
  return useMemo(
    () => ({
      locale,
      t: (key: MessageKey, values?: MessageValues) =>
        translate(locale, key, values),
      message: (value: string) => translateMessage(locale, value),
      formatBytes: (value: number) => formatBytes(value, locale),
      // Stable SSR timezone; browser/server defaults can differ during hydration.
      formatDateTime: (value: string | number | Date) =>
        formatLocalDateTime(value, locale, "UTC"),
      formatExpiry: (
        value: string | number | Date,
        now?: string | number | Date,
      ) => formatRelativeExpiry(value, now, locale),
    }),
    [locale],
  );
}
/** Can be embedded in server component trees: translated during SSR, not by DOM mutation. */
export function T({ id, values }: { id: MessageKey; values?: MessageValues }) {
  const { t } = useTranslation();
  return t(id, values);
}
