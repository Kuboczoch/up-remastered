"use client";

import { useState } from "react";
import styles from "./request.module.css";

// Reconcile this helper with the upload worker's shared copy-link utility.
export async function copyRequestLink(value: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function CopyRequestLink({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [feedback, setFeedback] = useState<"copied" | "manual">();
  return (
    <div className={styles.copy}>
      <button
        className={styles.linkButton}
        type="button"
        onClick={async () =>
          setFeedback((await copyRequestLink(value)) ? "copied" : "manual")
        }
      >
        {label}
      </button>
      {feedback && (
        <p aria-live="polite">
          {feedback === "copied"
            ? "Link copied."
            : "Automatic copy unavailable. Select the complete link below and copy it manually."}
        </p>
      )}
      {feedback === "manual" && (
        <label className={styles.field}>
          Link to copy manually
          <input
            readOnly
            value={value}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      )}
    </div>
  );
}
