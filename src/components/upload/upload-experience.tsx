"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent,
} from "react";

import {
  uploadFile,
  type UploadResult,
} from "@/components/upload/client-upload";
import {
  createTextFile,
  DEFAULT_TEXT_ENCODING,
  TEXT_ENCODINGS,
  type TextEncoding,
} from "@/components/upload/text-encoding";
import {
  removeUploadHistoryEntry,
  saveUploadHistoryEntry,
  restoreUploadHistory,
  readUploadHistory,
  hasHistoryConsent,
  setHistoryConsent,
  clearUploadHistory,
  HISTORY_CONSENT_KEY,
  UPLOAD_HISTORY_STORAGE_KEY,
  type UploadHistoryEntry,
} from "@/components/upload/upload-history";
import { QrDialog } from "@/components/upload/qr-dialog";
import { siteName } from "@/config/site";
import {
  formatBytes,
  formatLocalDateTime,
  formatRelativeExpiry,
} from "@/lib/format";

type PublicConfiguration = {
  maxTemporaryFileSize: number;
};

type Phase = "idle" | "uploading" | "success" | "error";

function isDirectoryDrop(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.items).some((item) => {
    const entry = (
      item as DataTransferItem & {
        webkitGetAsEntry?: () => { isDirectory?: boolean } | null;
      }
    ).webkitGetAsEntry?.();
    return entry?.isDirectory === true;
  });
}

function isValidFileDrag(
  dataTransfer: DataTransfer,
  maxBytes: number | null,
): boolean {
  if (!Array.from(dataTransfer.types).includes("Files")) {
    return false;
  }

  const fileItems = Array.from(dataTransfer.items).filter(
    (item) => item.kind === "file",
  );
  if (fileItems.length > 0 && fileItems.length !== 1) {
    return false;
  }
  if (isDirectoryDrop(dataTransfer)) {
    return false;
  }

  const file = dataTransfer.files[0] ?? fileItems[0]?.getAsFile();
  return !file || maxBytes === null || file.size <= maxBytes;
}

function fileType(name: string): string {
  const extension = name.split(".").pop();
  return extension && extension !== name
    ? extension.slice(0, 4).toUpperCase()
    : "FILE";
}

function forcedDownloadUrl(shareUrl: string): string {
  const url = new URL(shareUrl);
  url.searchParams.set("download", "1");
  return url.toString();
}

export function UploadExperience({
  initialMaxBytes,
}: {
  initialMaxBytes: number;
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [saveHistory, setSaveHistory] = useState(false);
  const historyConsentRef = useRef(false);
  const optionsRef = useRef<HTMLElement>(null);
  const optionsTriggerRef = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [maxBytes, setMaxBytes] = useState<number | null>(initialMaxBytes);
  const [configurationWarning, setConfigurationWarning] = useState("");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"file" | "text">("file");
  const textEncoding: TextEncoding = DEFAULT_TEXT_ENCODING;
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSvg, setQrSvg] = useState("");
  const [qrError, setQrError] = useState("");
  const [qrGenerationAttempt, setQrGenerationAttempt] = useState(0);
  const [history, setHistory] = useState<UploadHistoryEntry[]>([]);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(
    null,
  );
  const [historyStatus, setHistoryStatus] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const errorHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const restorePickerFocusRef = useRef(false);
  const qrTriggerRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const copyConfirmationTimerRef = useRef<number | null>(null);
  const requestSequence = useRef(0);
  const originalTitle = useRef(siteName);

  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0;
    setDragActive(false);
  }, []);

  useEffect(() => {
    originalTitle.current = document.title;
    const controller = new AbortController();

    void fetch("/api/configuration", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Configuration unavailable.");
        }
        return (await response.json()) as PublicConfiguration;
      })
      .then((configuration) => {
        if (
          Number.isSafeInteger(configuration.maxTemporaryFileSize) &&
          configuration.maxTemporaryFileSize > 0
        ) {
          setMaxBytes(configuration.maxTemporaryFileSize);
        }
      })
      .catch((fetchError: unknown) => {
        if (
          !(
            fetchError instanceof DOMException &&
            fetchError.name === "AbortError"
          )
        ) {
          setConfigurationWarning(
            "Upload limit could not be loaded; the server will still validate your file.",
          );
        }
      });

    return () => {
      controller.abort();
      abortRef.current?.();
      if (copyConfirmationTimerRef.current !== null) {
        window.clearTimeout(copyConfirmationTimerRef.current);
      }
      document.title = originalTitle.current;
    };
  }, []);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    const leaveWindow = (event: globalThis.DragEvent) => {
      if (
        event.target === document.documentElement ||
        event.target === document.body
      ) {
        resetDragState();
      }
    };

    window.addEventListener("blur", resetDragState);
    window.addEventListener("dragend", resetDragState);
    window.addEventListener("drop", resetDragState);
    document.addEventListener("dragleave", leaveWindow);
    return () => {
      window.removeEventListener("blur", resetDragState);
      window.removeEventListener("dragend", resetDragState);
      window.removeEventListener("drop", resetDragState);
      document.removeEventListener("dragleave", leaveWindow);
    };
  }, [resetDragState]);

  useEffect(() => {
    if (phase === "idle" && restorePickerFocusRef.current) {
      restorePickerFocusRef.current = false;
      inputRef.current?.focus();
    }
  }, [phase]);

  useEffect(() => {
    document.title =
      phase === "uploading"
        ? `${progress}% · ${siteName}`
        : originalTitle.current;
  }, [phase, progress]);

  useEffect(() => {
    if (phase === "error") {
      errorHeadingRef.current?.focus();
    }
    if (phase === "success") {
      resultHeadingRef.current?.focus();
    }
  }, [phase]);

  useEffect(() => {
    if (!qrOpen || !result || qrSvg) {
      return;
    }

    let current = true;
    void import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toString(result.shareUrl, {
          errorCorrectionLevel: "M",
          margin: 1,
          type: "svg",
          width: 192,
        }),
      )
      .then((svg) => {
        if (current) setQrSvg(svg);
      })
      .catch(() => {
        if (current) {
          setQrError("QR code could not be generated. Try again.");
        }
      });

    return () => {
      current = false;
    };
  }, [qrGenerationAttempt, qrOpen, qrSvg, result]);

  useEffect(() => {
    if (!result) {
      return;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [result]);

  const beginUpload = useCallback(
    async (file: File) => {
      if (phase === "uploading") {
        return;
      }
      if (maxBytes !== null && file.size > maxBytes) {
        setError(
          `“${file.name}” is ${formatBytes(file.size)}. Maximum size is ${formatBytes(maxBytes)}.`,
        );
        setPhase("error");
        return;
      }

      const sequence = requestSequence.current + 1;
      requestSequence.current = sequence;
      setError("");
      setCopied(false);
      setQrOpen(false);
      setQrSvg("");
      setQrError("");
      setProgress(0);
      setResult(null);
      setPhase("uploading");

      setOptionsOpen(false);
      const operation = uploadFile(file, setProgress);
      abortRef.current = operation.abort;
      try {
        const upload = await operation.promise;
        if (requestSequence.current !== sequence) {
          return;
        }
        setProgress(100);
        setResult(upload);
        setNow(Date.now());
        setPhase("success");
        // Recheck persisted consent at completion: another tab can revoke it
        // before its storage event reaches this page.
        try {
          if (
            historyConsentRef.current &&
            hasHistoryConsent(window.localStorage)
          ) {
            setHistory(saveUploadHistoryEntry(window.localStorage, upload));
          }
        } catch {
          setHistoryStatus(
            "Upload succeeded, but browser history could not be saved.",
          );
        }
      } catch (uploadError) {
        if (requestSequence.current !== sequence) {
          return;
        }
        if (
          uploadError instanceof DOMException &&
          uploadError.name === "AbortError"
        ) {
          return;
        }
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Upload failed. Try again.",
        );
        setPhase("error");
      } finally {
        if (requestSequence.current === sequence) {
          abortRef.current = null;
        }
      }
    },
    [maxBytes, phase],
  );

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (phase !== "idle" && phase !== "error") {
        return;
      }
      if (
        event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLInputElement &&
          event.target.type !== "file") ||
        optionsOpen
      )
        return;
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length > 1) {
        setError("Paste one file at a time.");
        setPhase("error");
        return;
      }
      if (files[0]) {
        event.preventDefault();
        void beginUpload(files[0]);
        return;
      }

      const pastedText = event.clipboardData?.getData("text/plain") ?? "";
      if (pastedText) {
        event.preventDefault();
        void beginUpload(
          createTextFile(pastedText, "pasted-text.txt", textEncoding),
        );
      }
    };

    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, [beginUpload, phase, textEncoding, optionsOpen]);

  function reset() {
    requestSequence.current += 1;
    abortRef.current?.();
    abortRef.current = null;
    setPhase("idle");
    setProgress(0);
    setError("");
    setResult(null);
    setQrOpen(false);
    setText("");
    setCopied(false);
    if (copyConfirmationTimerRef.current !== null) {
      window.clearTimeout(copyConfirmationTimerRef.current);
      copyConfirmationTimerRef.current = null;
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function startAnotherUpload() {
    restorePickerFocusRef.current = true;
    reset();
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 1) {
      void beginUpload(files[0]);
    }
  }

  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    resetDragState();
    if (phase !== "idle" && phase !== "error") {
      return;
    }
    const files = Array.from(event.dataTransfer.files);
    if (isDirectoryDrop(event.dataTransfer) || files.length !== 1) {
      setError(
        "Drop exactly one file. Folders and multiple files are not supported.",
      );
      setPhase("error");
      return;
    }
    void beginUpload(files[0]);
  }

  function pasteIntoPanel(event: ReactClipboardEvent<HTMLElement>) {
    if (
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLInputElement ||
      optionsOpen
    )
      return;
    event.stopPropagation();
    if (phase !== "idle" && phase !== "error") {
      return;
    }

    const files = Array.from(event.clipboardData.files);
    if (files.length > 1) {
      event.preventDefault();
      setError("Paste one file at a time.");
      setPhase("error");
      return;
    }
    if (files[0]) {
      event.preventDefault();
      void beginUpload(files[0]);
      return;
    }
    const pastedText = event.clipboardData.getData("text/plain");
    if (pastedText) {
      event.preventDefault();
      void beginUpload(
        createTextFile(pastedText, "pasted-text.txt", textEncoding),
      );
    }
  }

  function uploadText() {
    if (!text) {
      setError("Enter or paste text before uploading.");
      setPhase("error");
      return;
    }
    void beginUpload(
      createTextFile(text, `text-${Date.now()}.txt`, textEncoding),
    );
  }

  async function copyUrl() {
    if (!result) {
      return;
    }
    try {
      await navigator.clipboard.writeText(result.shareUrl);
      setCopied(true);
      if (copyConfirmationTimerRef.current !== null) {
        window.clearTimeout(copyConfirmationTimerRef.current);
      }
      copyConfirmationTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copyConfirmationTimerRef.current = null;
      }, 2_000);
    } catch {
      setCopied(false);
    }
  }

  useEffect(() => {
    function synchronize(event?: StorageEvent) {
      if (
        event &&
        event.key !== null &&
        event.key !== HISTORY_CONSENT_KEY &&
        event.key !== UPLOAD_HISTORY_STORAGE_KEY
      )
        return;
      try {
        if (event?.storageArea && event.storageArea !== window.localStorage)
          return;
        const consent = hasHistoryConsent(window.localStorage);
        historyConsentRef.current = consent;
        setSaveHistory(consent);
        setHistory(
          consent
            ? event
              ? readUploadHistory(window.localStorage)
              : restoreUploadHistory(
                  window.localStorage,
                  window.sessionStorage,
                  Date.now(),
                  true,
                )
            : [],
        );
      } catch {
        historyConsentRef.current = false;
        setSaveHistory(false);
        setHistory([]);
      }
    }
    synchronize();
    window.addEventListener("storage", synchronize);
    return () => window.removeEventListener("storage", synchronize);
  }, []);

  function clearBrowserHistory(): boolean {
    setHistory([]);
    try {
      return clearUploadHistory(window.localStorage, window.sessionStorage);
    } catch {
      return false;
    }
  }

  function changeHistoryConsent(consent: boolean) {
    // Revoke immediately even when storage is blocked or an upload is in flight.
    historyConsentRef.current = false;
    setSaveHistory(false);
    try {
      const persisted = setHistoryConsent(window.localStorage, consent);
      if (!consent) {
        const cleared = clearBrowserHistory();
        setHistoryStatus(
          persisted && cleared
            ? "History disabled and cleared in this browser. Server files are unchanged."
            : "History disabled for this page, but browser storage could not be fully cleared. Clear site data before leaving a shared device.",
        );
      } else if (persisted) {
        historyConsentRef.current = true;
        setSaveHistory(true);
        setHistory(
          restoreUploadHistory(
            window.localStorage,
            window.sessionStorage,
            Date.now(),
            true,
          ),
        );
        setHistoryStatus(
          "History enabled in this browser. Keys are never saved.",
        );
      } else {
        setHistoryStatus(
          "History could not be enabled because browser storage is unavailable.",
        );
      }
    } catch {
      setHistory([]);
      setHistoryStatus(
        "Browser storage is unavailable. Clear site data before leaving a shared device.",
      );
    }
  }

  async function deleteHistoryEntry(entry: UploadHistoryEntry) {
    setDeletingHistoryId(entry.id);
    setHistoryStatus("");
    try {
      const response = await fetch(`/api/u/${encodeURIComponent(entry.id)}`, {
        body: JSON.stringify({ accessToken: entry.accessToken }),
        headers: { "content-type": "application/json" },
        method: "DELETE",
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("Delete failed.");
      }

      if (historyConsentRef.current && hasHistoryConsent(window.localStorage)) {
        setHistory(removeUploadHistoryEntry(window.localStorage, entry.id));
      }
      setHistoryStatus(
        response.status === 404
          ? `${entry.originalName} was already unavailable and has been forgotten.`
          : `${entry.originalName} was deleted.`,
      );
    } catch {
      setHistoryStatus(
        `${entry.originalName} could not be deleted. Try again.`,
      );
    } finally {
      setDeletingHistoryId(null);
    }
  }

  function removeHistoryEntry(entry: UploadHistoryEntry) {
    if (!historyConsentRef.current || !hasHistoryConsent(window.localStorage))
      return;
    setHistory(removeUploadHistoryEntry(window.localStorage, entry.id));
    setHistoryStatus(`${entry.originalName} was removed from this browser.`);
  }

  function closeOptions() {
    setOptionsOpen(false);
    setTimeout(
      () => optionsTriggerRef.current?.focus({ preventScroll: true }),
      0,
    );
  }

  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia("(max-width: 760px)");
    const synchronize = () => setMobile(query.matches);
    synchronize();
    query.addEventListener("change", synchronize);
    return () => query.removeEventListener("change", synchronize);
  }, []);

  useEffect(() => {
    if (!optionsOpen) return;
    const panel = optionsRef.current;
    panel
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true });
    const background = [
      ...document.querySelectorAll<HTMLElement>(
        ".workspace-heading, .upload-card, .upload-back, .history-region, .site-footer",
      ),
    ];
    const previousOverflow = document.body.style.overflow;
    if (mobile) {
      background.forEach((element) => {
        element.inert = true;
      });
      document.body.style.overflow = "hidden";
    }
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOptionsOpen(false);
        setTimeout(
          () => optionsTriggerRef.current?.focus({ preventScroll: true }),
          0,
        );
      }
      if (mobile && event.key === "Tab") {
        const controls = [
          ...(panel?.querySelectorAll<HTMLElement>("button, input, select") ??
            []),
        ].filter((element) => element.getClientRects().length);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      background.forEach((element) => {
        element.inert = false;
      });
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keyboard);
    };
  }, [optionsOpen, mobile]);

  return (
    <div
      className="upload-workspace"
      onDragEnter={(event) => {
        if (phase !== "idle" && phase !== "error") {
          resetDragState();
          return;
        }
        if (!isValidFileDrag(event.dataTransfer, maxBytes)) {
          resetDragState();
          return;
        }
        event.preventDefault();
        dragDepthRef.current += 1;
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
          setDragActive(false);
        }
      }}
      onDragOver={(event) => {
        if (phase !== "idle" && phase !== "error") {
          resetDragState();
          return;
        }
        if (Array.from(event.dataTransfer.types).includes("Files")) {
          event.preventDefault();
        }
        if (!isValidFileDrag(event.dataTransfer, maxBytes)) {
          resetDragState();
        }
      }}
      onDrop={drop}
      onPaste={pasteIntoPanel}
    >
      {!isOnline && (
        <p className="connection-warning" role="status">
          You are offline. Reconnect before uploading.
        </p>
      )}
      <div className="workspace-heading">
        <div className="workspace-copy">
          <h1>Share temporary files and text.</h1>
          <p>Everything expires automatically.</p>
        </div>
        {(phase === "idle" || phase === "error") && (
          <div
            className="mode-switch"
            role="tablist"
            aria-label="Upload type"
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "file"
                  : event.key === "End"
                    ? "text"
                    : mode === "file"
                      ? "text"
                      : "file";
              setMode(next);
              document.getElementById(`${next}-mode-tab`)?.focus();
            }}
          >
            <button
              role="tab"
              id="file-mode-tab"
              aria-controls="file-upload-panel"
              tabIndex={mode === "file" ? 0 : -1}
              aria-selected={mode === "file"}
              onClick={() => setMode("file")}
              type="button"
            >
              File
            </button>
            <button
              role="tab"
              id="text-mode-tab"
              aria-controls="text-upload-panel"
              tabIndex={mode === "text" ? 0 : -1}
              aria-selected={mode === "text"}
              onClick={() => setMode("text")}
              type="button"
            >
              Text
            </button>
          </div>
        )}
      </div>
      <div className="upload-stage">
        <div className="upload-back">
          <div className="upload-rail">
            <Link href="/request/new">Request a file ↗</Link>
            <button
              type="button"
              ref={optionsTriggerRef}
              aria-expanded={optionsOpen}
              aria-controls="advanced-options"
              onClick={() =>
                optionsOpen ? closeOptions() : setOptionsOpen(true)
              }
            >
              Advanced options{" "}
              <span className="advanced-symbol" aria-hidden="true">
                {optionsOpen ? "−" : "+"}
              </span>
            </button>
          </div>
        </div>
        {(phase === "idle" || phase === "error") && (
          <section
            className={`upload-card drop-zone${dragActive ? " is-dragging" : ""}`}
            aria-labelledby="upload-heading"
          >
            <div className="scene" aria-hidden="true" />
            {dragActive && (
              <div className="drop-overlay" role="status" aria-live="polite">
                <span className="drop-overlay-icon" aria-hidden="true">
                  ↓
                </span>
                <strong>Drop file to upload</strong>
              </div>
            )}
            <h2 className="visually-hidden" id="upload-heading">
              Upload a file
            </h2>
            {phase === "error" && (
              <div className="inline-error" role="alert">
                <h2 ref={errorHeadingRef} tabIndex={-1}>
                  Something went wrong
                </h2>
                <p>{error}</p>
                <button onClick={reset} type="button">
                  Try again
                </button>
              </div>
            )}
            <div className="upload-mode-panels">
              <div
                role="tabpanel"
                id="file-upload-panel"
                aria-labelledby="file-mode-tab"
                aria-hidden={mode !== "file"}
                className={`file-panel${mode !== "file" ? " is-hidden" : ""}`}
                inert={mode !== "file"}
              >
                <input
                  aria-label="Choose file"
                  className="visually-hidden"
                  id="file-picker"
                  onChange={chooseFile}
                  ref={inputRef}
                  type="file"
                />
                <label className="primary-action" htmlFor="file-picker">
                  Choose file <span aria-hidden="true">⇧</span>
                </label>
                <p className="drop-hint">or drop one file here</p>
              </div>
              <div
                role="tabpanel"
                id="text-upload-panel"
                aria-labelledby="text-mode-tab"
                aria-hidden={mode !== "text"}
                className={`text-upload${mode !== "text" ? " is-hidden" : ""}`}
                inert={mode !== "text"}
              >
                <label htmlFor="text-upload">Or upload text</label>
                <textarea
                  id="text-upload"
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Paste or type text"
                  rows={6}
                  value={text}
                />
                <button
                  className="primary-action"
                  onClick={uploadText}
                  type="button"
                >
                  Upload text
                </button>
              </div>
            </div>
            <div className="upload-meta">
              <span>
                {maxBytes === null
                  ? "Checking limit…"
                  : `${formatBytes(maxBytes)} max`}
              </span>
              <span>Temporary storage</span>
            </div>
            {configurationWarning && (
              <p className="warning-note">{configurationWarning}</p>
            )}
          </section>
        )}
        {phase === "uploading" && (
          <section
            className="upload-card state-card"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="scene" aria-hidden="true" />
            <p className="state-label">Uploading</p>
            <h2>{progress}%</h2>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <button className="outline-button" onClick={reset} type="button">
              Cancel
            </button>
          </section>
        )}
        {phase === "success" && result && (
          <section className="upload-card result-card" aria-live="polite">
            <div className="scene" aria-hidden="true" />
            <p className="complete-label">
              ✓ <span>Upload complete</span>
            </p>
            <div className="result-file">
              <span className="file-type">{fileType(result.originalName)}</span>
              <div>
                <h2 ref={resultHeadingRef} tabIndex={-1}>
                  {result.originalName}
                </h2>
                <p>
                  {formatBytes(result.size)} · Expires{" "}
                  {formatRelativeExpiry(result.expiresAt, now)} ·{" "}
                  <time
                    dateTime={result.expiresAt}
                    title={formatLocalDateTime(result.expiresAt)}
                  >
                    {formatLocalDateTime(result.expiresAt)}
                  </time>
                </p>
              </div>
            </div>
            <div className="share-row">
              <input
                id="share-url"
                aria-label="Share URL"
                className="result-url"
                onDoubleClick={() => void copyUrl()}
                readOnly
                title="Double-click to copy"
                value={result.shareUrl}
              />
              <button
                aria-live="polite"
                className={`primary-action copy-action${copied ? " is-confirmed" : ""}`}
                onClick={() => void copyUrl()}
                type="button"
              >
                {copied ? (
                  <>
                    Copied <span aria-hidden="true">✓</span>
                  </>
                ) : (
                  "Copy URL"
                )}
              </button>
            </div>
            <p className="share-note">
              {result.shareUrl.includes("#key=")
                ? "Only the full link unlocks the file. Keep it safe: keys are not saved in browser history and cannot be recovered."
                : "Anyone with the link can download."}
            </p>
            <div
              aria-label="Uploaded file actions"
              className="result-actions"
              role="group"
            >
              <a href={result.shareUrl} rel="noreferrer" target="_blank">
                Open file
              </a>
              <a
                href={
                  result.shareUrl.includes("#key=")
                    ? result.shareUrl
                    : forcedDownloadUrl(result.shareUrl)
                }
              >
                Download file
              </a>
              <button
                className="outline-button"
                ref={qrTriggerRef}
                onClick={() => {
                  setQrError("");
                  setQrOpen(true);
                }}
                type="button"
              >
                Show QR code
              </button>
              <button
                className="start-over-button"
                onClick={startAnotherUpload}
                type="button"
              >
                Upload another file
              </button>
            </div>
            {qrOpen && (
              <QrDialog
                triggerRef={qrTriggerRef}
                onClose={() => setQrOpen(false)}
              >
                <button
                  aria-label="Close QR code"
                  className="qr-close"
                  onClick={() => setQrOpen(false)}
                  type="button"
                >
                  ×
                </button>
                <h2 id="qr-title">Scan to download</h2>
                {qrSvg ? (
                  <>
                    <div
                      aria-label="QR code for uploaded file"
                      className="qr-code"
                      data-testid="qr-code"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                      role="img"
                    />
                    <a
                      className="outline-button"
                      download={`${result.id}-qr.svg`}
                      href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`}
                    >
                      Download QR code
                    </a>
                  </>
                ) : qrError ? (
                  <div aria-live="polite" role="status">
                    <p>{qrError}</p>
                    <button
                      className="outline-button"
                      onClick={() => {
                        setQrError("");
                        setQrGenerationAttempt((attempt) => attempt + 1);
                      }}
                      type="button"
                    >
                      Retry QR code
                    </button>
                  </div>
                ) : (
                  <p aria-live="polite" role="status">
                    Generating QR code…
                  </p>
                )}
              </QrDialog>
            )}
          </section>
        )}
        {optionsOpen && mobile && (
          <button
            className="options-scrim"
            aria-label="Dismiss advanced options"
            tabIndex={-1}
            onClick={closeOptions}
            type="button"
          />
        )}
        <section
          id="advanced-options"
          ref={optionsRef}
          hidden={!optionsOpen}
          className="advanced-options-content options-panel"
          role={mobile ? "dialog" : "region"}
          aria-modal={mobile && optionsOpen ? true : undefined}
          aria-labelledby="options-title"
        >
          <div className="sheet-handle" aria-hidden="true" />
          <div className="options-heading">
            <h2 id="options-title">Advanced options</h2>
            <button
              type="button"
              aria-label="Close advanced options"
              onClick={closeOptions}
            >
              ×
            </button>
          </div>
          <div className="option-setting switch-setting" style={{ opacity: 1 }}>
            <div>
              <label htmlFor="save-history">Save history</label>
              <small>In this browser only</small>
              <small id="history-help">
                Turning off clears records, not server files. Keys are never
                saved; retain the full protected link, which history cannot
                recover.
              </small>
            </div>
            <input
              id="save-history"
              aria-describedby="history-help"
              type="checkbox"
              role="switch"
              checked={saveHistory}
              onChange={(event) => changeHistoryConsent(event.target.checked)}
            />
          </div>
          <div className="option-setting" aria-disabled="true">
            <label htmlFor="expiry-hours">Expires after</label>
            <select id="expiry-hours" value={24} disabled>
              {[1, 3, 6, 12, 24].map((hours) => (
                <option value={hours} key={hours}>
                  {hours} {hours === 1 ? "hour" : "hours"}
                </option>
              ))}
            </select>
          </div>
          <div className="option-setting" aria-disabled="true">
            <label htmlFor="download-limit">Download limit</label>
            <input
              type="range"
              id="download-limit"
              min={1}
              max={11}
              step={1}
              value={11}
              disabled
              aria-valuetext="Unlimited"
            />
            <div className="limit-ticks" aria-hidden="true">
              <span>1</span>
              <span>5</span>
              <span>10</span>
              <span>∞</span>
            </div>
          </div>
          <div className="option-setting switch-setting" aria-disabled="true">
            <div>
              <label htmlFor="key-protect">Key protect</label>
            </div>
            <input
              id="key-protect"
              type="checkbox"
              role="switch"
              checked={false}
              disabled
            />
          </div>
          {mode === "text" && (
            <div className="option-setting" aria-disabled="true">
              <label htmlFor="text-encoding">Text encoding</label>
              <select id="text-encoding" disabled value={textEncoding}>
                {TEXT_ENCODINGS.map((encoding) => (
                  <option key={encoding.value} value={encoding.value}>
                    {encoding.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            className="primary-action options-done"
            onClick={closeOptions}
            type="button"
          >
            Done
          </button>
        </section>
      </div>
      <div className="history-region">
        {saveHistory &&
          history.length > 0 &&
          (phase === "idle" || phase === "success" || phase === "error") && (
            <section className="history-card" aria-labelledby="history-heading">
              <div className="history-header">
                <h2 id="history-heading" aria-label="Your uploads">
                  Recent uploads
                </h2>
                <button
                  type="button"
                  className="clear-history"
                  title="Remove browser records only, not server files"
                  onClick={() => {
                    const cleared = clearBrowserHistory();
                    setHistoryStatus(
                      cleared
                        ? "History cleared in this browser. Server files are unchanged."
                        : "Visible history cleared, but browser storage could not be cleared. Clear site data before leaving a shared device.",
                    );
                  }}
                >
                  Clear history
                </button>
              </div>
              <div className="history-content">
                <ul className="history-list">
                  {history.map((entry) => (
                    <li key={entry.id}>
                      <span className="file-type">
                        {fileType(entry.originalName)}
                      </span>
                      <div className="history-file">
                        {phase === "success" ? (
                          <p className="history-name">{entry.originalName}</p>
                        ) : (
                          <h3>{entry.originalName}</h3>
                        )}
                        <p>
                          {formatBytes(entry.size)} · Expires{" "}
                          <time
                            dateTime={entry.expiresAt}
                            title={formatLocalDateTime(entry.expiresAt)}
                          >
                            {formatRelativeExpiry(entry.expiresAt, now)}
                          </time>
                        </p>
                      </div>
                      <div className="history-actions">
                        <button
                          className="history-copy-link"
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(entry.shareUrl);
                            setHistoryStatus("Link copied.");
                          }}
                        >
                          Copy link
                        </button>
                        <div className="history-more">
                          <button
                            type="button"
                            popoverTarget={`history-menu-${entry.id}`}
                            aria-label={`More actions for ${entry.originalName}`}
                          >
                            ···
                          </button>
                          <div
                            id={`history-menu-${entry.id}`}
                            className="history-menu"
                            popover="auto"
                          >
                            <a href={forcedDownloadUrl(entry.shareUrl)}>
                              Download
                            </a>
                            <button
                              aria-label={`Remove ${entry.originalName} from history`}
                              onClick={() => removeHistoryEntry(entry)}
                              type="button"
                            >
                              Remove
                            </button>
                            <button
                              aria-label={`Delete ${entry.originalName}`}
                              disabled={deletingHistoryId === entry.id}
                              onClick={() => void deleteHistoryEntry(entry)}
                              type="button"
                            >
                              {deletingHistoryId === entry.id
                                ? "Deleting…"
                                : "Delete file"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
      </div>
      <p role="status" aria-live="polite">
        {historyStatus}
      </p>
    </div>
  );
}
