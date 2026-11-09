"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  decryptFile,
  validateEncryptionKey,
} from "@/components/upload/encryption";
import { formatBytes } from "@/lib/format";
import { fetchEncryptedFile } from "./fetch-encrypted-file";
import { useTranslation } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function fragmentKey() {
  const match = /^#key=([A-Za-z0-9_-]{43})$/.exec(window.location.hash);
  return match?.[1] ?? "";
}

export function DecryptExperience({ id }: { id: string }) {
  const { locale, t, message } = useTranslation();
  const fragment = useSyncExternalStore(subscribe, fragmentKey, () => "");
  const [manualKey, setManualKey] = useState<string | null>(null);
  const key = manualKey ?? fragment;
  const validKey = validateEncryptionKey(key);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<MessageKey>("Downloading encrypted file");
  const [error, setError] = useState<string | null>(null);
  const [download, setDownload] = useState<{
    url: string;
    name: string;
    size: number;
  } | null>(null);
  const envelope = useRef<ArrayBuffer | null>(null);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  useEffect(
    () => () => {
      controller.current?.abort();
      envelope.current = null;
    },
    [],
  );
  useEffect(
    () => () => {
      if (download) URL.revokeObjectURL(download.url);
    },
    [download],
  );

  async function decrypt() {
    if (!validKey || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const request = new AbortController();
    controller.current = request;
    try {
      // Retain ciphertext for wrong-key retries, avoiding another counted fetch.
      if (!globalThis.crypto?.subtle)
        throw new Error(
          "Decryption requires HTTPS (or localhost) and Web Crypto. No file was fetched.",
        );
      setStage("Downloading encrypted file");
      envelope.current ??= await fetchEncryptedFile(
        id,
        request.signal,
        setProgress,
      );
      setStage("Authenticating and decrypting");
      const file = await decryptFile(envelope.current, key);
      if (request.signal.aborted) return;
      if (!request.signal.aborted) {
        envelope.current = null;
        setDownload({
          url: URL.createObjectURL(file),
          name: file.name,
          size: file.size,
        });
      }
    } catch (caught) {
      const failure = caught instanceof Error ? caught.message : "";
      const status =
        /^Download failed \((\d{3})\)\. Check your connection and try again; a retry may use another download\.$/.exec(
          failure,
        )?.[1];
      if (!request.signal.aborted)
        setError(
          status
            ? t(
                "Download failed ({status}). Check your connection and try again; a retry may use another download.",
                { status },
              )
            : message(
                failure,
                "Download failed. Check your connection and ask the sender for a new link.",
              ),
        );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      className="upload-experience decrypt-experience"
      aria-labelledby="decrypt-heading"
    >
      <p className="eyebrow">{t("Private transfer")}</p>
      <h1 id="decrypt-heading">{t("Decrypt your file")}</h1>
      <p>
        {t(
          "This file is protected with a secret key. Decryption happens only in your browser; the server never receives the key.",
        )}
      </p>
      <p>
        {t(
          "Files up to 32 MiB are supported. Nothing is downloaded until you choose to decrypt. Fetching the encrypted file uses one download from its limit, even if the key is wrong.",
        )}
      </p>
      {!validKey && (
        <p role="status">
          {t(
            "Missing or invalid key. Ask the sender for the complete link, including #key=…, or enter the key below.",
          )}
        </p>
      )}
      {!download && (
        <>
          <label htmlFor="decryption-key">{t("Decryption key")}</label>
          <input
            id="decryption-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={key}
            disabled={busy}
            onChange={(event) => setManualKey(event.target.value.trim())}
            aria-describedby="key-help"
          />
          <p id="key-help">
            {t(
              "Use the key after #key= in the sender’s link. Never send it to the server or put it in a URL query.",
            )}
          </p>
          <button
            type="button"
            className="primary-action"
            disabled={!validKey || busy}
            onClick={() => void decrypt()}
          >
            {t(busy ? "Downloading and decrypting…" : "Decrypt file")}
          </button>
        </>
      )}
      {busy && (
        <div role="status">
          {t(stage)} ({formatBytes(progress, locale)})
          <button
            type="button"
            onClick={() => {
              controller.current?.abort();
              // Web Crypto cannot be interrupted; unlock retry only after
              // this attempt settles and releases the in-flight guard.
              setStage("Cancelling decryption…");
            }}
          >
            {t("Cancel decryption")}
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {download && (
        <div role="status">
          <p>
            {t("Decrypted: {name} ({size}). Save the original file below.", {
              name: download.name,
              size: formatBytes(download.size, locale),
            })}
          </p>
          <a
            className="primary-action"
            href={download.url}
            download={download.name}
            referrerPolicy="no-referrer"
          >
            {t("Save decrypted file")}
          </a>
        </div>
      )}
      <p>
        {/* Native navigation avoids prefetch and restores metadata on Back. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" referrerPolicy="no-referrer">
          {t("Upload another file")}
        </a>
      </p>
    </section>
  );
}
