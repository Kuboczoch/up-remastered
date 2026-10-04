"use client";

import { useRef, useState, type ReactNode } from "react";
import { DestructiveConfirmation } from "@/components/destructive-confirmation";

type Props = {
  id: string;
  accessToken: string;
  name: string;
  children: ReactNode;
  onStartAnother: () => void;
};

/** Ephemeral lifecycle only: never reads or writes browser history. Key by upload ID. */
export function CurrentResultDeletion({
  id,
  accessToken,
  name,
  children,
  onStartAnother,
}: Props) {
  const [deleted, setDeleted] = useState(false);
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
      // This route confirms deletion with exactly 200 and an empty body.
      // Raw 404, auth errors and proxy/unexpected success bodies are not confirmation.
      if (response.status !== 200 || (await response.text()) !== "") {
        throw new Error(
          "Deletion was not confirmed. Your file link is retained; please retry.",
        );
      }
      setDeleted(true);
    } catch {
      // Do not surface transport messages that could contain private capabilities.
      throw new Error(
        "Deletion was not confirmed. Your file link is retained; please retry.",
      );
    } finally {
      pending.current = false;
    }
  }

  if (deleted) {
    return (
      <>
        <p className="complete-label" role="status">
          Deleted
        </p>
        <h2>{name}</h2>
        <p>
          The file was deleted from the server. Existing sharing links no longer
          work. This cannot be undone.
        </p>
        <button
          className="start-over-button"
          type="button"
          onClick={onStartAnother}
        >
          Upload another file
        </button>
      </>
    );
  }
  return (
    <>
      {children}
      <div className="result-actions" role="group" aria-label="File management">
        <DestructiveConfirmation
          label="Delete file"
          className="outline-button"
          title={`Delete ${name}?`}
          description="Permanently delete this file from the server? Existing sharing links will stop working. This cannot be undone."
          confirmLabel="Permanently delete file"
          onConfirm={deleteCurrent}
        />
      </div>
    </>
  );
}
