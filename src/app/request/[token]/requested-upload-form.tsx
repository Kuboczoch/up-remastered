"use client";
import { useTranslation } from "@/i18n/provider";

import { useEffect, useRef, useState } from "react";
import { apiErrorKey } from "@/i18n/messages";
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
  const { t, formatBytes } = useTranslation();
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
      setError(t("Choose a non-empty file."));
      return;
    }
    if (file.size > maxBytes) {
      setError(
        t("The file must be no larger than {size}.", {
          size: formatBytes(maxBytes),
        }),
      );
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
        if (xhr.status < 200 || xhr.status >= 300) {
          setError(
            t(
              apiErrorKey(
                body,
                "Upload failed. You can retry with the selected file.",
              ),
            ),
          );
          return;
        }
        if (
          !body.upload ||
          typeof body.upload.originalName !== "string" ||
          typeof body.upload.shareUrl !== "string" ||
          typeof body.accessToken !== "string" ||
          !Number.isFinite(body.upload.size) ||
          !Number.isFinite(Date.parse(body.upload.expiresAt))
        ) {
          setError(t("Upload completed, but the server response was invalid."));
          return;
        }
        setResult(body);
      } catch {
        setError(t("Upload failed. You can retry with the selected file."));
      }
    };
    xhr.onerror = () => {
      if (finish())
        setError(
          t(
            "Network error. Check your connection and retry with the selected file. If delivery may have completed, reload this request to check its status.",
          ),
        );
    };
    xhr.onabort = () => {
      if (!finish()) return;
      setNotice(
        t(
          "Cancelled. The selected file is kept. You can retry once the server releases this request; reload to check if delivery already completed.",
        ),
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
      setError(
        t("Could not start upload. Please retry with the selected file."),
      );
    }
  }

  if (result)
    return (
      <section className={styles.card} aria-labelledby="upload-complete">
        <h2 id="upload-complete">{t("Upload complete")}</h2>
        <p role="status">
          {t(
            "Your file has been delivered. The requester can now retrieve it.",
          )}{" "}
        </p>
        <p className={styles.result}>
          {result.upload.originalName} · {formatBytes(result.upload.size)}
        </p>
        <p>
          {t("File expires")}{" "}
          <RequestExpiry expiresAt={result.upload.expiresAt} />
        </p>
        <CopyRequestLink
          label={t("Copy link")}
          value={result.upload.shareUrl}
        />
        <div className={styles.actions}>
          <a
            className={styles.linkButton}
            href={result.upload.shareUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("Open file")}{" "}
          </a>
          <a
            className={styles.linkButton}
            href={`${result.upload.shareUrl}?download=1`}
          >
            {t("Download file")}{" "}
          </a>
        </div>
        <details className={styles.result}>
          <summary>{t("Advanced / API")}</summary>
          <p>
            {t(
              "This upload access token is only needed for API operations on the delivered file. Keep it private.",
            )}{" "}
          </p>
          <code>{result.accessToken}</code>
          <p>{t("No owner management token is shared with the uploader.")}</p>
        </details>
      </section>
    );

  return (
    <form className={styles.card} onSubmit={submit} aria-busy={busy}>
      <label className={styles.field}>
        {t("Choose file")}{" "}
        <input
          disabled={busy}
          name="file"
          required
          type="file"
          onChange={(event) => setFile(event.currentTarget.files?.[0])}
        />
      </label>
      <p className={styles.muted}>
        {t("Maximum")} {formatBytes(maxBytes)}
        {t(". This link accepts one successful upload.")}{" "}
      </p>
      {expiresAt && (
        <p>
          {t("Request expires")} <RequestExpiry expiresAt={expiresAt} />
        </p>
      )}
      {file && (
        <p className={styles.result}>
          {file.name} · {formatBytes(file.size)}
        </p>
      )}
      {busy && (
        <progress
          aria-label={t("Upload progress")}
          value={progress}
          max={100}
        />
      )}
      <p role="status">
        {phase === "finalizing"
          ? t("Finalizing delivery…")
          : phase === "uploading"
            ? t("Uploading… {progress}%", { progress })
            : notice}
      </p>
      <div className={styles.actions}>
        <button
          ref={submitButton}
          className={styles.button}
          disabled={busy}
          type="submit"
        >
          {busy ? t("Uploading…") : t("Upload file")}
        </button>
        {busy && (
          <button
            className={styles.linkButton}
            type="button"
            onClick={() => transport.current?.abort()}
          >
            {t("Cancel upload")}{" "}
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
