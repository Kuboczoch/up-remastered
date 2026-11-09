"use client";

import { useId } from "react";
import { useTranslation } from "@/lib/i18n/provider";

/** Keep capability links in the current page only, never in a recovery URL. */
export function ManualCopyLink({ value }: { value: string }) {
  const { t } = useTranslation();
  const instructionsId = useId();
  return (
    <div>
      <p id={instructionsId} role="status">
        {t(
          "Could not copy automatically. Select and copy the complete link below.",
        )}
      </p>
      <input
        aria-label={t("Link to copy")}
        aria-describedby={instructionsId}
        className="result-url"
        readOnly
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        onClick={(event) => event.currentTarget.select()}
      />
    </div>
  );
}
