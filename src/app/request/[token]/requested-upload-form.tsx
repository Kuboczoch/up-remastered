"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatBytes } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";

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
  const { locale, t } = useTranslation();
  const [result, setResult] = useState<RequestedUploadReceipt>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [phase, setPhase] = useState<MessageKey>("Uploading…");
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
        throw new Error(t("Choose a non-empty file."));
      if (file.size > maxBytes) {
        throw new Error(
          t("The file must be no larger than {size}.", {
            size: formatBytes(maxBytes, locale),
          }),
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
                t(
                  "This request is no longer available for upload. Do not retry: check its status to see whether it is busy, used, revoked or expired.",
                ),
              ),
            );
            return;
          }
          const response = xhr.response as UploadResponse | null;
          if (xhr.status >= 200 && xhr.status < 300 && response?.upload)
            resolve(response);
          else
            reject(
              new Error(
                // Do not expose arbitrary server text or capability-bearing details.
                xhr.status === 413
                  ? t("The file must be no larger than {size}.", {
                      size: formatBytes(maxBytes, locale),
                    })
                  : t("Upload failed. You can retry with the selected file."),
              ),
            );
        };
        xhr.onerror = () =>
          reject(
            new Error(
              t(
                "Network error. You can retry with the selected file. If the server completed the upload, this single-use link may already be consumed.",
              ),
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
          t(
            "Upload cancelled locally. The server releases incomplete uploads after disconnect cleanup; retry shortly. If finalization already completed, this single-use link may be consumed.",
          ),
        );
      } else
        setError(
          caught instanceof Error
            ? caught.message
            : t("Upload failed. You can retry with the selected file."),
        );
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
        {t("Choose file")}
        <input
          name="file"
          required
          type="file"
          disabled={busy || unavailable}
          onChange={(event) => setSelection(event.target.files?.[0])}
        />
      </label>
      <p className={styles.muted}>
        {t("Maximum {size}. This link is single-use.", {
          size: formatBytes(maxBytes, locale),
        })}
      </p>
      {selection ? (
        <p>
          {t("{name} — {bytes} bytes", {
            name: selection.name,
            bytes: new Intl.NumberFormat(locale, { useGrouping: false }).format(
              selection.size,
            ),
          })}
        </p>
      ) : null}
      <p role="status" aria-live="polite">
        {busy
          ? `${t(phase)}${progress === undefined ? "" : ` ${new Intl.NumberFormat(locale).format(progress)}%`}`
          : status}
      </p>
      {busy ? (
        <>
          <progress
            aria-label={t("Upload progress")}
            max={100}
            value={progress}
          />
          <button
            className={styles.button}
            type="button"
            onClick={() => transport.current?.abort()}
          >
            {t("Cancel upload")}
          </button>
        </>
      ) : null}
      <button
        className={styles.button}
        disabled={busy || unavailable}
        type="submit"
      >
        {busy ? t(phase) : t("Upload file")}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {unavailable ? (
        <a href={`/request/${token}`}>{t("Check request status")}</a>
      ) : null}
    </form>
  );
}
