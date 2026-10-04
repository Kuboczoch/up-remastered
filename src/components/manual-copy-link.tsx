"use client";

import { useId } from "react";
import { useTranslation } from "@/i18n/provider";

/** Keep capability links in the current page only, never in a recovery URL. */
export function ManualCopyLink({ url }: { url: string }) {
  const { t } = useTranslation();
  const instructionsId = useId();
  return (
    <div className="manual-copy" role="status">
      <p id={instructionsId}>
        {t(
          "Automatic copy is unavailable. Select the complete link below and copy it manually.",
        )}
      </p>
      <input
        aria-label={t("Complete link for manual copying")}
        aria-describedby={instructionsId}
        className="result-url"
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        onClick={(event) => event.currentTarget.select()}
      />
    </div>
  );
}
