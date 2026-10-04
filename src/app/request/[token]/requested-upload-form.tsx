"use client";

import { useState, type FormEvent } from "react";

import styles from "../request.module.css";

import {
  RequestedUploadSuccess,
  type RequestedUploadReceipt,
} from "./requested-upload-success";

type UploadResponse = {
  upload: RequestedUploadReceipt;
};

export function RequestedUploadForm({
  maxBytes,
  token,
}: {
  maxBytes: number;
  token: string;
}) {
  const [result, setResult] = useState<RequestedUploadReceipt>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const form = new FormData(event.currentTarget);
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        throw new Error("Choose a non-empty file.");
      }
      if (file.size > maxBytes) {
        throw new Error(`The file must be no larger than ${maxBytes} bytes.`);
      }

      const upload = new FormData();
      upload.set("file", file);
      const response = await fetch(`/api/upload-requests/${token}/upload`, {
        body: upload,
        method: "POST",
      });
      const body = (await response.json()) as UploadResponse & {
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(body.error?.message ?? "Upload failed.");
      const { id, originalName, size, expiresAt } = body.upload;
      setResult({ id, originalName, size, expiresAt });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return <RequestedUploadSuccess receipt={result} />;
  }

  return (
    <form className={styles.card} onSubmit={submit}>
      <label className={styles.field}>
        Choose file
        <input name="file" required type="file" />
      </label>
      <p className={styles.muted}>
        Maximum {maxBytes} bytes. This link is single-use.
      </p>
      <button className={styles.button} disabled={busy} type="submit">
        {busy ? "Uploading…" : "Upload file"}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
