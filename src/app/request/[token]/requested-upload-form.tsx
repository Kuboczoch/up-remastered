"use client";

import { useState, type FormEvent } from "react";
import { formatBytes } from "@/lib/format";

import styles from "../request.module.css";

type UploadResponse = {
  accessToken: string;
  upload: {
    expiresAt: string;
    originalName: string;
    shareUrl: string;
    size: number;
  };
};

export function RequestedUploadForm({
  maxBytes,
  token,
}: {
  maxBytes: number;
  token: string;
}) {
  const [result, setResult] = useState<UploadResponse>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (unavailable) return;
    setBusy(true);
    setError("");

    try {
      const form = new FormData(event.currentTarget);
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        throw new Error("Choose a non-empty file.");
      }
      if (file.size > maxBytes) {
        throw new Error(
          `The file must be no larger than ${formatBytes(maxBytes, "en")}.`,
        );
      }

      const upload = new FormData();
      upload.set("file", file);
      const response = await fetch(`/api/upload-requests/${token}/upload`, {
        body: upload,
        method: "POST",
      });
      if (response.status === 404) {
        setUnavailable(true);
        throw new Error(
          "This request is no longer available for upload. Do not retry: check its status to see whether it is busy, used, revoked or expired.",
        );
      }
      const body = (await response.json()) as UploadResponse & {
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(body.error?.message ?? "Upload failed.");
      setResult(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <section className={styles.card} aria-labelledby="upload-complete">
        <h2 id="upload-complete">Upload complete</h2>
        <p className={styles.result}>
          Share link:{" "}
          <a href={result.upload.shareUrl}>{result.upload.shareUrl}</a>
        </p>
        <p className={styles.result}>
          <strong>Upload access token:</strong>{" "}
          <code>{result.accessToken}</code>
        </p>
        <p>No owner management token is shared with the uploader.</p>
      </section>
    );
  }

  return (
    <form className={styles.card} onSubmit={submit}>
      <label className={styles.field}>
        Choose file
        <input name="file" required type="file" disabled={unavailable} />
      </label>
      <p className={styles.muted}>
        Maximum {formatBytes(maxBytes, "en")}. This link is single-use.
      </p>
      <button
        className={styles.button}
        disabled={busy || unavailable}
        type="submit"
      >
        {busy ? "Uploading…" : "Upload file"}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {unavailable ? (
        <a href={`/request/${token}`}>Check request status</a>
      ) : null}
    </form>
  );
}
