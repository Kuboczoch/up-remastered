"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatBytes } from "@/lib/format";

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
  const [unavailable, setUnavailable] = useState(false);
  const [phase, setPhase] = useState("Uploading…");
  const [progress, setProgress] = useState<number>();
  const [selection, setSelection] = useState<File>();
  const [status, setStatus] = useState("");
  const transport = useRef<XMLHttpRequest | null>(null);
  const submitting = useRef(false);
  useEffect(() => () => transport.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || unavailable) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    setPhase("Uploading…");
    setProgress(undefined);
    try {
      const form = new FormData(event.currentTarget);
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0)
        throw new Error("Choose a non-empty file.");
      if (file.size > maxBytes) {
        throw new Error(
          `The file must be no larger than ${formatBytes(maxBytes, "en")}.`,
        );
      }
      const upload = new FormData();
      upload.set("file", file);
      const body = await new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        transport.current = xhr;
        xhr.open("POST", `/api/upload-requests/${token}/upload`);
        xhr.responseType = "json";
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable)
            setProgress(Math.floor((event.loaded / event.total) * 100));
        };
        xhr.upload.onload = () => {
          setProgress(100);
          setPhase("Finalizing…");
        };
        xhr.onload = () => {
          if (xhr.status === 404) {
            setUnavailable(true);
            reject(
              new Error(
                "This request is no longer available for upload. Do not retry: check its status to see whether it is busy, used, revoked or expired.",
              ),
            );
            return;
          }
          const response = xhr.response as UploadResponse & {
            error?: { message?: string };
          };
          if (xhr.status >= 200 && xhr.status < 300 && response?.upload)
            resolve(response);
          else
            reject(
              new Error(
                response?.error?.message ??
                  "Upload failed. You can retry with the selected file.",
              ),
            );
        };
        xhr.onerror = () =>
          reject(
            new Error(
              "Network error. You can retry with the selected file. If the server completed the upload, this single-use link may already be consumed.",
            ),
          );
        xhr.onabort = () =>
          reject(new DOMException("Upload cancelled.", "AbortError"));
        xhr.send(upload);
      });
      const { id, originalName, size, expiresAt } = body.upload;
      setResult({ id, originalName, size, expiresAt });
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setStatus(
          "Upload cancelled locally. The server releases incomplete uploads after disconnect cleanup; retry shortly. If finalization already completed, this single-use link may be consumed.",
        );
      } else
        setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      transport.current = null;
      submitting.current = false;
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
        <input
          name="file"
          required
          type="file"
          disabled={busy || unavailable}
          onChange={(event) => setSelection(event.target.files?.[0])}
        />
      </label>
      <p className={styles.muted}>
        Maximum {formatBytes(maxBytes, "en")}. This link is single-use.
      </p>
      {selection ? (
        <p>
          {selection.name} — {selection.size} bytes
        </p>
      ) : null}
      <p role="status" aria-live="polite">
        {busy
          ? `${phase}${progress === undefined ? "" : ` ${progress}%`}`
          : status}
      </p>
      {busy ? (
        <>
          <progress aria-label="Upload progress" max={100} value={progress} />
          <button
            className={styles.button}
            type="button"
            onClick={() => transport.current?.abort()}
          >
            Cancel upload
          </button>
        </>
      ) : null}
      <button
        className={styles.button}
        disabled={busy || unavailable}
        type="submit"
      >
        {busy ? phase : "Upload file"}
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
