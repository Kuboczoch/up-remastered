"use client";

import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/format";
import { RequestExpiry } from "./request-expiry";
import { CopyRequestLink } from "./copy-request-link";
import { type RequestDetails } from "./use-upload-request-status";
import styles from "./request.module.css";

export const OWNER_STATUS_MESSAGES: Record<RequestDetails["status"], string> = {
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
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const safeButton = useRef<HTMLButtonElement>(null);
  const statusFocus = useRef<HTMLParagraphElement>(null);
  const returnFocus = useRef(false);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shareUrl = `/${request.uploadId}`;
  const available = request.status === "consumed" && !!request.uploadId;
  const revocable = ["active", "retry", "in_progress"].includes(request.status);
  useEffect(() => {
    if (!revocable && dialog.current?.open) dialog.current.close();
    if (!busy && returnFocus.current) {
      returnFocus.current = false;
      (revocable ? trigger.current : statusFocus.current)?.focus();
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
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/upload-requests/manage", {
        headers: { authorization: `Bearer ${token}` },
        method: "DELETE",
      });
      if (!response.ok)
        throw new Error("Could not revoke the request. Please try again.");
      const body = (await response.json()) as { request: RequestDetails };
      onUpdate(body.request);
    } catch {
      setError("Could not revoke the request. Please try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
      close();
    }
  }
  return (
    <>
      <p>
        Limit: {formatBytes(request.maxBytes)} · Request expires{" "}
        <RequestExpiry expiresAt={request.expiresAt} />
      </p>
      <p
        ref={statusFocus}
        tabIndex={-1}
        className={styles.status}
        role="status"
      >
        {OWNER_STATUS_MESSAGES[request.status]}
      </p>
      {available ? (
        <div className={styles.actions}>
          <a
            className={styles.linkButton}
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open file
          </a>
          <a className={styles.linkButton} href={`${shareUrl}?download=1`}>
            Download file
          </a>
          <CopyRequestLink
            label="Copy download link"
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
            Reserved download link: <code>{shareUrl}</code> · Not available
            until delivery completes.
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
          Revoke request
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
        <h2 id="revoke-title">Revoke this request?</h2>
        <p id="revoke-explanation">
          This permanently stops this link from accepting a file. Any upload in
          progress will not be delivered. You will need a new request to receive
          a file.
        </p>
        <div className={styles.actions}>
          <button
            ref={safeButton}
            className={styles.linkButton}
            type="button"
            disabled={busy}
            onClick={close}
          >
            Keep request
          </button>
          <button
            className={styles.button}
            type="button"
            disabled={busy}
            onClick={revoke}
          >
            {busy ? "Revoking…" : "Confirm revoke"}
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
