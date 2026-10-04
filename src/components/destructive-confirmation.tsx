"use client";

import { useEffect, useId, useRef } from "react";

export function DestructiveConfirmation({
  name,
  description,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  name: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      className="qr-dialog destructive-dialog"
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ),
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <h2 id={titleId}>
        {confirmLabel}: {name}?
      </h2>
      <p id={descriptionId}>{description}</p>
      {error && <p role="alert">{error}</p>}
      <div className="result-actions">
        <button
          className="outline-button"
          ref={cancelRef}
          disabled={busy}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="outline-button destructive-action"
          disabled={busy}
          onClick={onConfirm}
          type="button"
        >
          {busy ? "Please wait…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
