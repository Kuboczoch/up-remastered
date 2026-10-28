"use client";

import { useEffect, useRef, useState } from "react";

import { copyLink } from "@/lib/copy-link";
import { formatBytes, formatLocalDateTime } from "@/lib/format";

import styles from "../request.module.css";

// Only public completion data belongs here, never the raw API response/capabilities.
export type RequestedUploadReceipt = {
  id: string;
  originalName: string;
  size: number;
  expiresAt: string;
};

export function RequestedUploadSuccess({
  receipt,
}: {
  receipt: RequestedUploadReceipt;
}) {
  const [feedback, setFeedback] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const mounted = useRef(false);
  const attempt = useRef(0);
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);
  const validId = /^[0-9A-Z]{5}$/.test(receipt.id);
  const shareUrl = validId
    ? new URL(`/${receipt.id}`, window.location.origin).href
    : undefined;

  useEffect(() => {
    mounted.current = true;
    heading.current?.focus();
    return () => {
      mounted.current = false;
      attempt.current += 1;
      clearTimeout(reset.current);
    };
  }, []);

  async function copy() {
    if (!shareUrl) return;
    const current = ++attempt.current;
    clearTimeout(reset.current);
    setFeedback("idle");
    const copied = await copyLink(shareUrl);
    if (!mounted.current || current !== attempt.current) return;
    setFeedback(copied ? "copied" : "failed");
    if (copied) {
      reset.current = setTimeout(() => {
        if (mounted.current && current === attempt.current) setFeedback("idle");
      }, 3000);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="upload-complete">
      <h2 id="upload-complete" ref={heading} tabIndex={-1}>
        Upload complete
      </h2>
      <p role="status">The requester can now retrieve your file.</p>
      <dl className={`${styles.details} ${styles.receipt}`}>
        <div>
          <dt>Filename</dt>
          <dd>{receipt.originalName}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{formatBytes(receipt.size)}</dd>
        </div>
        <div>
          <dt>File expires</dt>
          <dd>
            <time dateTime={receipt.expiresAt}>
              {formatLocalDateTime(receipt.expiresAt)}
            </time>
          </dd>
        </div>
      </dl>
      <p>
        This request link has been used and cannot accept another upload.
        Reloading it will show that the request is unavailable. Ask the
        requester for a new request link if you need to send another file.
      </p>
      {shareUrl ? (
        <>
          <p className={styles.muted}>
            Anyone with the file link can access it until it expires. It is
            separate from this single-use request link.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              onClick={() => void copy()}
            >
              {feedback === "copied" ? "Copied" : "Copy link"}
            </button>
            <a className={styles.linkButton} href={shareUrl}>
              Open file
            </a>
            <a className={styles.linkButton} href={`${shareUrl}?download=1`}>
              Download file
            </a>
          </div>
          <p
            aria-live="polite"
            aria-atomic="true"
            role={feedback === "idle" ? undefined : "status"}
          >
            {feedback === "copied"
              ? "Link copied."
              : feedback === "failed"
                ? "Could not copy automatically. Select and copy the file link manually."
                : ""}
          </p>
          {feedback === "failed" ? (
            <label className={styles.field}>
              File link for manual copying
              <input
                readOnly
                value={shareUrl}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          ) : null}
        </>
      ) : (
        <p>
          The file link is unavailable. Ask the requester to retrieve the file
          from their request management page.
        </p>
      )}
    </section>
  );
}
