"use client";
import { useTranslation } from "@/i18n/provider";

export function ManualCopyLink({ url }: { url: string }) {
  const { t } = useTranslation();
  return (
    <div className="manual-copy" role="status">
      <p>
        {t(
          "Automatic copy is unavailable. Select the complete link below and copy it manually.",
        )}{" "}
      </p>
      <input
        aria-label={t("Complete link for manual copying")}
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
      />
    </div>
  );
}
