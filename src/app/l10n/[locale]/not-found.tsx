"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/provider";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <main className="status-page">
      <p className="status-code">404</p>
      <h1>{t("Page not found")}</h1>
      <p>{t("The requested page or file is unavailable.")}</p>
      <Link className="status-action" href="/">
        {t("Return home")}
      </Link>
    </main>
  );
}
