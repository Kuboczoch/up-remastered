"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

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
  const [phase, setPhase] = useState("Uploading…");
  const [progress, setProgress] = useState<number>();
  const [selection, setSelection] = useState<File>();
  const [status, setStatus] = useState("");
  const transport = useRef<XMLHttpRequest | null>(null);
  const submitting = useRef(false);
  useEffect(() => () => transport.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
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
      if (file.size > maxBytes)
        throw new Error(`The file must be no larger than ${maxBytes} bytes.`);
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
      setResult(body);
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

  if (result)
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

  return (
    <form className={styles.card} onSubmit={submit}>
      <label className={styles.field}>
        Choose file
        <input
          name="file"
          required
          type="file"
          disabled={busy}
          onChange={(event) => setSelection(event.target.files?.[0])}
        />
      </label>
      <p className={styles.muted}>
        Maximum {maxBytes} bytes. This link is single-use.
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
      <button className={styles.button} disabled={busy} type="submit">
        {busy ? phase : "Upload file"}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
