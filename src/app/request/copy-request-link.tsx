"use client";

import { useState } from "react";
import { copyLink } from "@/lib/copy-link";
import { ManualCopyLink } from "@/components/manual-copy-link";
import { useTranslation } from "@/i18n/provider";
import styles from "./request.module.css";

/** Compatibility export; all link copying uses the shared secure-context helper. */
export async function copyRequestLink(value: string): Promise<boolean> {
  return (await copyLink(value)) === "copied";
}

export function CopyRequestLink({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<"copied" | "manual">();
  return (
    <div className={styles.copy}>
      <button
        className={styles.linkButton}
        type="button"
        onClick={async () => setFeedback(await copyLink(value))}
      >
        {label}
      </button>
      {feedback === "copied" && <p aria-live="polite">{t("Link copied.")}</p>}
      {feedback === "manual" && <ManualCopyLink url={value} />}
    </div>
  );
}
