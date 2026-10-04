"use client";
import { useTranslation } from "@/i18n/provider";

import { useEffect, useRef, useState } from "react";
import type { MessageKey } from "@/i18n/messages";
import { RequestExpiry } from "./request-expiry";
import { CopyRequestLink } from "./copy-request-link";
import {
  isRequestDetails,
  type RequestDetails,
} from "./use-upload-request-status";
import styles from "./request.module.css";

export const OWNER_STATUS_MESSAGES: Record<
  RequestDetails["status"],
  MessageKey
> = {
  active: "Waiting for upload.",
  in_progress:
    "An upload is in progress. Your file will be available after delivery completes.",
  consumed: "File delivered. You can now open or download it.",
  expired: "This request has expired. Create a new request to receive a file.",
  retry: "The previous upload did not complete. Waiting for another attempt.",
  revoked:
    "This request has been revoked. Create a new request to receive a file.",
};

export function RequestOwnerStatus({
  request,
  token,
  onUpdate,
}: {
  request: RequestDetails;
  token: string;
  onUpdate: (request: RequestDetails) => void;
}) {
  const { t, formatBytes } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const safeButton = useRef<HTMLButtonElement>(null);
  const statusFocus = useRef<HTMLParagraphElement>(null);
  const returnFocus = useRef(false);
  const focusStatusOnReturn = useRef(false);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shareUrl = `/${request.uploadId}`;
  const available = request.status === "consumed" && !!request.uploadId;
  const revocable = ["active", "retry", "in_progress"].includes(request.status);
  useEffect(() => {
    if (!revocable && dialog.current?.open) dialog.current.close();
    if (!busy && returnFocus.current) {
      // Keep the flag until focus is actually restored: live status updates can
      // replace the trigger between this effect and the animation frame.
      const frame = requestAnimationFrame(() => {
        (focusStatusOnReturn.current || !revocable
          ? statusFocus.current
          : trigger.current
        )?.focus();
        returnFocus.current = false;
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [busy, revocable]);
  function close() {
    dialog.current?.close();
    returnFocus.current = busy;
    if (!busy) (revocable ? trigger.current : statusFocus.current)?.focus();
  }
  async function revoke() {
    if (submitting.current || !revocable) return;
    submitting.current = true;
    focusStatusOnReturn.current = false;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/upload-requests/manage", {
        headers: { authorization: `Bearer ${token}` },
        method: "DELETE",
      });
      if (!response.ok)
        throw new Error(t("Could not revoke the request. Please try again."));
      const body = (await response.json()) as { request: RequestDetails };
      if (!isRequestDetails(body?.request))
        throw new Error(t("Could not revoke the request. Please try again."));
      focusStatusOnReturn.current = ![
        "active",
        "retry",
        "in_progress",
      ].includes(body.request.status);
      onUpdate(body.request);
    } catch {
      setError(t("Could not revoke the request. Please try again."));
    } finally {
      submitting.current = false;
      // The async handler captured the pre-submit busy value. Restore focus only
      // after React re-enables the trigger (or renders the terminal status).
      returnFocus.current = true;
      dialog.current?.close();
      setBusy(false);
    }
  }
  return (
    <>
      <p>
        {t("Limit:")} {formatBytes(request.maxBytes)} {t("· Request expires")}{" "}
        <RequestExpiry expiresAt={request.expiresAt} />
      </p>
      <p
        ref={statusFocus}
        tabIndex={-1}
        className={styles.status}
        role="status"
      >
        {t(OWNER_STATUS_MESSAGES[request.status])}
      </p>
      {available ? (
        <div className={styles.actions}>
          <a
            className={styles.linkButton}
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("Open file")}{" "}
          </a>
          <a className={styles.linkButton} href={`${shareUrl}?download=1`}>
            {t("Download file")}{" "}
          </a>
          <CopyRequestLink
            label={t("Copy download link")}
            value={
              typeof window === "undefined"
                ? shareUrl
                : new URL(shareUrl, window.location.origin).href
            }
          />
        </div>
      ) : (
        request.uploadId &&
        revocable && (
          <p className={styles.result}>
            {t("Reserved download link:")} <code>{shareUrl}</code>{" "}
            {t("· Not available until delivery completes.")}{" "}
          </p>
        )
      )}
      {revocable && (
        <button
          ref={trigger}
          className={styles.button}
          disabled={busy}
          type="button"
          onClick={() => {
            dialog.current?.showModal();
            safeButton.current?.focus();
          }}
        >
          {t("Revoke request")}{" "}
        </button>
      )}
      <dialog
        ref={dialog}
        className={styles.confirmation}
        aria-labelledby="revoke-title"
        aria-describedby="revoke-explanation"
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) close();
        }}
      >
        <h2 id="revoke-title">{t("Revoke this request?")}</h2>
        <p id="revoke-explanation">
          {t(
            "This permanently stops this link from accepting a file. Any upload in progress will not be delivered. You will need a new request to receive a file.",
          )}{" "}
        </p>
        <div className={styles.actions}>
          <button
            ref={safeButton}
            className={styles.linkButton}
            type="button"
            disabled={busy}
            onClick={close}
          >
            {t("Keep request")}{" "}
          </button>
          <button
            className={styles.button}
            type="button"
            disabled={busy}
            onClick={revoke}
          >
            {busy ? t("Revoking…") : t("Confirm revoke")}
          </button>
        </div>
      </dialog>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </>
  );
}
