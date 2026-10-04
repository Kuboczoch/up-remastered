"use client";

import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/format";
import { RequestExpiry } from "../request-expiry";
import { CopyRequestLink } from "../copy-request-link";
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
  expiresAt,
}: {
  maxBytes: number;
  token: string;
  expiresAt?: string;
}) {
  const [file, setFile] = useState<File>();
  const [result, setResult] = useState<UploadResponse>();
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "uploading" | "finalizing">(
    "idle",
  );
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const transport = useRef<XMLHttpRequest | undefined>(undefined);
  const submitButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const busy = phase !== "idle";

  useEffect(() => {
    if (!busy && returnFocus.current) {
      returnFocus.current = false;
      submitButton.current?.focus();
    }
  }, [busy]);

  useEffect(
    () => () => {
      const xhr = transport.current;
      transport.current = undefined;
      xhr?.abort();
    },
    [],
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (transport.current) return;
    setError("");
    setNotice("");
    if (!file || file.size === 0) {
      setError("Choose a non-empty file.");
      return;
    }
    if (file.size > maxBytes) {
      setError(`The file must be no larger than ${formatBytes(maxBytes)}.`);
      return;
    }
    const xhr = new XMLHttpRequest();
    transport.current = xhr;
    setPhase("uploading");
    setProgress(0);
    const finish = () => {
      if (transport.current !== xhr) return false;
      transport.current = undefined;
      setPhase("idle");
      return true;
    };
    xhr.upload.onprogress = (event) => {
      if (transport.current === xhr && event.lengthComputable)
        setProgress(
          Math.min(100, Math.round((event.loaded / event.total) * 100)),
        );
    };
    xhr.upload.onload = () => {
      if (transport.current === xhr) {
        setProgress(100);
        setPhase("finalizing");
      }
    };
    xhr.onload = () => {
      if (!finish()) return;
      try {
        const body = JSON.parse(xhr.responseText) as UploadResponse & {
          error?: { message?: string };
        };
        if (xhr.status < 200 || xhr.status >= 300)
          throw new Error(
            body.error?.message ??
              "Upload failed. You can retry with the selected file.",
          );
        setResult(body);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Upload failed. You can retry with the selected file.",
        );
      }
    };
    xhr.onerror = () => {
      if (finish())
        setError(
          "Network error. Check your connection and retry with the selected file. If delivery may have completed, reload this request to check its status.",
        );
    };
    xhr.onabort = () => {
      if (!finish()) return;
      setNotice(
        "Cancelled. The selected file is kept. You can retry once the server releases this request; reload to check if delivery already completed.",
      );
      returnFocus.current = true;
    };
    try {
      xhr.open("POST", `/api/upload-requests/${token}/upload`);
      const body = new FormData();
      body.set("file", file);
      xhr.send(body);
    } catch {
      finish();
      setError("Could not start upload. Please retry with the selected file.");
    }
  }

  if (result)
    return (
      <section className={styles.card} aria-labelledby="upload-complete">
        <h2 id="upload-complete">Upload complete</h2>
        <p role="status">
          Your file has been delivered. The requester can now retrieve it.
        </p>
        <p className={styles.result}>
          {result.upload.originalName} · {formatBytes(result.upload.size)}
        </p>
        <p>
          File expires <RequestExpiry expiresAt={result.upload.expiresAt} />
        </p>
        <CopyRequestLink label="Copy link" value={result.upload.shareUrl} />
        <div className={styles.actions}>
          <a
            className={styles.linkButton}
            href={result.upload.shareUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open file
          </a>
          <a
            className={styles.linkButton}
            href={`${result.upload.shareUrl}?download=1`}
          >
            Download file
          </a>
        </div>
        <details className={styles.result}>
          <summary>Advanced / API</summary>
          <p>
            This upload access token is only needed for API operations on the
            delivered file. Keep it private.
          </p>
          <code>{result.accessToken}</code>
          <p>No owner management token is shared with the uploader.</p>
        </details>
      </section>
    );

  return (
    <form className={styles.card} onSubmit={submit} aria-busy={busy}>
      <label className={styles.field}>
        Choose file
        <input
          disabled={busy}
          name="file"
          required
          type="file"
          onChange={(event) => setFile(event.currentTarget.files?.[0])}
        />
      </label>
      <p className={styles.muted}>
        Maximum {formatBytes(maxBytes)}. This link accepts one successful
        upload.
      </p>
      {expiresAt && (
        <p>
          Request expires <RequestExpiry expiresAt={expiresAt} />
        </p>
      )}
      {file && (
        <p className={styles.result}>
          {file.name} · {formatBytes(file.size)}
        </p>
      )}
      {busy && (
        <progress aria-label="Upload progress" value={progress} max={100} />
      )}
      <p role="status">
        {phase === "finalizing"
          ? "Finalizing delivery…"
          : phase === "uploading"
            ? `Uploading… ${progress}%`
            : notice}
      </p>
      <div className={styles.actions}>
        <button
          ref={submitButton}
          className={styles.button}
          disabled={busy}
          type="submit"
        >
          {busy ? "Uploading…" : "Upload file"}
        </button>
        {busy && (
          <button
            className={styles.linkButton}
            type="button"
            onClick={() => transport.current?.abort()}
          >
            Cancel upload
          </button>
        )}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
