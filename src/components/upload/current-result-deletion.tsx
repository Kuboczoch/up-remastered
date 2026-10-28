"use client";

import { useRef, useState, type ReactNode } from "react";
import { DestructiveConfirmation } from "@/components/destructive-confirmation";
import { useTranslation } from "@/lib/i18n/provider";
import type { ConfirmedServerStatus } from "./upload-history";

type Props = {
  id: string;
  accessToken: string;
  name: string;
  children: ReactNode;
  onStartAnother: () => void;
  onConfirmed?: (status: ConfirmedServerStatus) => void;
};

/** Ephemeral lifecycle only: never reads or writes browser history. Key by upload ID. */
export function CurrentResultDeletion({
  id,
  accessToken,
  name,
  children,
  onStartAnother,
  onConfirmed,
}: Props) {
  const { t } = useTranslation();
  const [deleted, setDeleted] = useState<ConfirmedServerStatus | null>(null);
  const pending = useRef(false);

  async function deleteCurrent() {
    if (pending.current || deleted) return;
    pending.current = true;
    try {
      const response = await fetch(`/api/u/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      let status: ConfirmedServerStatus;
      if (response.status === 200 && (await response.text()) === "") {
        status = "deleted";
      } else if (response.status === 404) {
        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== "object" ||
          !("success" in body) ||
          body.success !== false ||
          !("message" in body) ||
          body.message !== "File not found."
        ) {
          throw new Error("Unconfirmed deletion.");
        }
        status = "unavailable";
      } else {
        throw new Error("Unconfirmed deletion.");
      }
      setDeleted(status);
      onConfirmed?.(status);
    } catch {
      // Do not surface transport messages that could contain private capabilities.
      throw new Error(
        t(
          "Deletion was not confirmed. Your file link is retained; please retry.",
        ),
      );
    } finally {
      pending.current = false;
    }
  }

  if (deleted) {
    return (
      <>
        <p className="complete-label" role="status">
          {deleted === "deleted" ? t("Deleted") : t("File unavailable")}
        </p>
        <h2>{name}</h2>
        <p>
          {deleted === "deleted"
            ? t(
                "The file was deleted from the server. Existing sharing links no longer work. This cannot be undone.",
              )
            : t(
                "The server confirmed this file is already unavailable. Existing sharing links no longer work.",
              )}
        </p>
        <button
          className="start-over-button"
          type="button"
          onClick={onStartAnother}
        >
          {t("Upload another file")}
        </button>
      </>
    );
  }
  return (
    <>
      {children}
      <div
        className="result-actions"
        role="group"
        aria-label={t("File management")}
      >
        <DestructiveConfirmation
          label={t("Delete file")}
          className="outline-button"
          title={t("Delete {name}?", { name })}
          description={t(
            "Permanently delete this file from the server? Existing sharing links will stop working. This cannot be undone.",
          )}
          confirmLabel={t("Permanently delete file")}
          onConfirm={deleteCurrent}
        />
      </div>
    </>
  );
}
