"use client";

import { createContext, useContext, useMemo } from "react";
import { defaultLocale, type Locale } from "./locale";
import {
  translate,
  translateMessage,
  type MessageKey,
  type MessageValues,
} from "./messages";

const LocaleContext = createContext<Locale>(defaultLocale);

/** Request-local React context, identical on the server and first hydration. */
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
    }),
    [locale],
  );
}

/** Translated during SSR, without reading browser hints or mutating the DOM. */
export function T({ id, values }: { id: MessageKey; values?: MessageValues }) {
  const { t } = useTranslation();
  return t(id, values);
}
