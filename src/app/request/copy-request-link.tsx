"use client";

import { useEffect, useRef, useState } from "react";
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
  const sequence = useRef(0);
  const [feedback, setFeedback] = useState<{
    value: string;
    outcome: "copied" | "manual";
  }>();
  useEffect(() => {
    return () => {
      sequence.current += 1;
    };
  }, [value]);
  const outcome = feedback?.value === value ? feedback.outcome : undefined;
  return (
    <div className={styles.copy}>
      <button
        className={styles.linkButton}
        type="button"
        onClick={async () => {
          const attempt = ++sequence.current;
          setFeedback(undefined);
          const outcome = await copyLink(value);
          if (attempt !== sequence.current) return;
          setFeedback({ value, outcome });
        }}
      >
        {label}
      </button>
      {outcome === "copied" && <p aria-live="polite">{t("Link copied.")}</p>}
      {outcome === "manual" && <ManualCopyLink url={value} />}
    </div>
  );
}
