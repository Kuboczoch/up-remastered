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
      message: (value: string, fallback?: MessageKey) =>
        translateMessage(locale, value, fallback),
      formatBytes: (value: number) => formatBytes(value, locale),
      formatDuration: (milliseconds: number) => {
        const day = 86_400_000;
        const hour = 3_600_000;
        const unit =
          milliseconds % day === 0
            ? "day"
            : milliseconds % hour === 0
              ? "hour"
              : "minute";
        const count =
          milliseconds /
          (unit === "day" ? day : unit === "hour" ? hour : 60_000);
        return new Intl.NumberFormat(locale, {
          style: "unit",
          unit,
          unitDisplay: "long",
          maximumFractionDigits: 0,
        }).format(count);
      },
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
