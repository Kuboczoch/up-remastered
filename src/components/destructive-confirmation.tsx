"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./destructive-confirmation.module.css";

type Props = {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

/** Confirmation only: recovery and lifecycle reconciliation belong to callers. */
export function DestructiveConfirmation({
  label,
  title,
  description,
  confirmLabel,
  onConfirm,
  disabled,
  className,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const returnTarget = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const fallback = useRef<HTMLElement | null>(null);
  const workspace = useRef<HTMLElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const background = new Map<HTMLElement, boolean>();
    const isolate = () => {
      Array.from(document.body.children).forEach((child) => {
        if (
          child instanceof HTMLElement &&
          !child.contains(panel.current) &&
          !background.has(child)
        ) {
          background.set(child, child.inert);
          child.inert = true;
        }
      });
    };
    isolate();
    const observer = new MutationObserver(isolate);
    observer.observe(document.body, { childList: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancel.current?.focus();
    return () => {
      observer.disconnect();
      background.forEach((inert, element) => {
        element.inert = inert;
      });
      document.body.style.overflow = overflow;
      const target = returnTarget.current?.isConnected
        ? returnTarget.current
        : fallback.current?.isConnected
          ? fallback.current
          : workspace.current;
      if (target?.isConnected) {
        if (target !== returnTarget.current) target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    };
  }, [open]);

  useEffect(() => {
    if (busy) panel.current?.focus();
    else if (open) cancel.current?.focus();
  }, [busy, open]);

  async function confirm() {
    if (pending.current || disabled) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      setOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The operation failed. Please retry.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={[className, styles.trigger].filter(Boolean).join(" ")}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          fallback.current =
            trigger.current?.closest<HTMLElement>("section, .history-region") ??
            null;
          workspace.current =
            trigger.current?.closest<HTMLElement>(".upload-workspace") ?? null;
          const popover = trigger.current?.closest<HTMLElement>("[popover]");
          returnTarget.current = popover
            ? (trigger.current
                ?.closest(".history-more")
                ?.querySelector<HTMLButtonElement>("button[popoverTarget]") ??
              null)
            : trigger.current;
          popover?.hidePopover?.();
          setError("");
          setOpen(true);
        }}
        ref={trigger}
      >
        {label}
      </button>
      {open &&
        createPortal(
          <div className={styles.backdrop}>
            <div
              className={styles.dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${id}-title`}
              aria-describedby={`${id}-description`}
              aria-busy={busy}
              tabIndex={-1}
              ref={panel}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  if (!pending.current) setOpen(false);
                }
                if (event.key === "Tab") {
                  const controls = Array.from(
                    panel.current?.querySelectorAll<HTMLButtonElement>(
                      "button:not(:disabled)",
                    ) ?? [],
                  );
                  const first = controls[0];
                  const last = controls.at(-1);
                  if (
                    event.shiftKey &&
                    (document.activeElement === first ||
                      document.activeElement === panel.current)
                  ) {
                    event.preventDefault();
                    last?.focus();
                  } else if (
                    !event.shiftKey &&
                    (document.activeElement === last ||
                      document.activeElement === panel.current)
                  ) {
                    event.preventDefault();
                    first?.focus();
                  } else if (!controls.length) {
                    event.preventDefault();
                  }
                }
              }}
            >
              <h2 id={`${id}-title`}>{title}</h2>
              <p id={`${id}-description`}>{description}</p>
              {error && <p role="alert">{error}</p>}
              {busy && (
                <p role="status">Working… This operation cannot be undone.</p>
              )}
              <div className={styles.actions}>
                <button
                  className="outline-button"
                  ref={cancel}
                  type="button"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className={styles.danger}
                  type="button"
                  disabled={busy || disabled}
                  onClick={() => void confirm()}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
