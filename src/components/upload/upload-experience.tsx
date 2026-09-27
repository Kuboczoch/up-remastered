"use client";

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
  formatBytes,
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
  readUploadHistory,
  removeUploadHistoryEntry,
  saveUploadHistoryEntry,
  UPLOAD_HISTORY_STORAGE_KEY,
  type UploadHistoryEntry,
} from "@/components/upload/upload-history";
import { siteName } from "@/config/site";

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

function expirationLabel(expiresAt: string, now: number): string {
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  if (remaining === 0) return "Expired";

  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s remaining`;
}

function fileType(name: string): string {
  const extension = name.split(".").pop();
  return extension && extension !== name
    ? extension.slice(0, 4).toUpperCase()
    : "FILE";
}

export function UploadExperience({
  initialMaxBytes,
}: {
  initialMaxBytes: number;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [maxBytes, setMaxBytes] = useState<number | null>(initialMaxBytes);
  const [configurationWarning, setConfigurationWarning] = useState("");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [textEncoding, setTextEncoding] = useState<TextEncoding>(
    DEFAULT_TEXT_ENCODING,
  );
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSvg, setQrSvg] = useState("");
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
    const restoreHistory = () => {
      const persisted = readUploadHistory(window.localStorage);
      if (persisted.length > 0) {
        setHistory(persisted);
        return;
      }

      const legacy = readUploadHistory(window.sessionStorage);
      let migrated: UploadHistoryEntry[] = [];
      for (const entry of [...legacy].reverse()) {
        migrated = saveUploadHistoryEntry(window.localStorage, entry);
      }
      try {
        window.sessionStorage.removeItem(UPLOAD_HISTORY_STORAGE_KEY);
      } catch {
        // Migration is best-effort when browser storage is restricted.
      }
      setHistory(migrated);
    };

    const timer = window.setTimeout(restoreHistory);
    const pruneTimer = window.setInterval(() => {
      setNow(Date.now());
      setHistory(readUploadHistory(window.localStorage));
    }, 60_000);
    window.addEventListener("storage", restoreHistory);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(pruneTimer);
      window.removeEventListener("storage", restoreHistory);
    };
  }, []);

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
    if (!result) {
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
      });

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      current = false;
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
      setProgress(0);
      setResult(null);
      setPhase("uploading");

      const operation = uploadFile(file, setProgress);
      abortRef.current = operation.abort;
      try {
        const upload = await operation.promise;
        if (requestSequence.current !== sequence) {
          return;
        }
        setProgress(100);
        setResult(upload);
        setHistory(saveUploadHistoryEntry(window.localStorage, upload));
        setNow(Date.now());
        setPhase("success");
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
  }, [beginUpload, phase, textEncoding]);

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

      setHistory(removeUploadHistoryEntry(window.localStorage, entry.id));
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
    setHistory(removeUploadHistoryEntry(window.localStorage, entry.id));
    setHistoryStatus(`${entry.originalName} was removed from this browser.`);
  }

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
          <p>Everything expires automatically. No account required.</p>
        </div>
        {(phase === "idle" || phase === "error") && (
          <div className="mode-switch" role="group" aria-label="Upload type">
            <button
              aria-pressed={mode === "file"}
              onClick={() => setMode("file")}
              type="button"
            >
              File
            </button>
            <button
              aria-pressed={mode === "text"}
              onClick={() => setMode("text")}
              type="button"
            >
              Text
            </button>
          </div>
        )}
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
          {mode === "file" ? (
            <div className="file-panel">
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
          ) : (
            <div className="text-upload">
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
          )}
          <div className="upload-meta">
            <span>
              {maxBytes === null
                ? "Checking limit…"
                : `${formatBytes(maxBytes)} max`}
            </span>
            <span>Expires in 24 hours</span>
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
                {formatBytes(result.size)} ·{" "}
                {expirationLabel(result.expiresAt, now)}
              </p>
            </div>
          </div>
          <div className="share-row">
            <input
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
          <p className="share-note">Anyone with the link can download.</p>
          <div
            aria-label="Uploaded file actions"
            className="result-actions"
            role="group"
          >
            <a href={result.shareUrl} rel="noreferrer" target="_blank">
              Open file
            </a>
            <button
              className="outline-button"
              onClick={() => setQrOpen(true)}
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
          {qrOpen && qrSvg && (
            <div className="qr-modal-backdrop" role="presentation">
              <section
                aria-labelledby="qr-title"
                aria-modal="true"
                className="qr-dialog"
                role="dialog"
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
              </section>
            </div>
          )}
        </section>
      )}
      {phase !== "uploading" && (
        <div className="under-card-row">
          <span>No account needed</span>
          {(phase === "idle" || phase === "error") && (
            <details className="advanced-options">
              <summary>
                Advanced options <span aria-hidden="true">＋</span>
              </summary>
              <div className="advanced-options-content">
                <div className="text-encoding">
                  <label htmlFor="text-encoding">Text encoding</label>
                  <select
                    id="text-encoding"
                    onChange={(event) =>
                      setTextEncoding(event.target.value as TextEncoding)
                    }
                    value={textEncoding}
                  >
                    {TEXT_ENCODINGS.map((encoding) => (
                      <option key={encoding.value} value={encoding.value}>
                        {encoding.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p>Paste a file or text anywhere on this page.</p>
                <nav aria-label="Upload integrations">
                  <a href="/sharex" download>
                    ShareX config
                  </a>
                  <a href="/sh" download>
                    Shell helper
                  </a>
                </nav>
              </div>
            </details>
          )}
        </div>
      )}
      {(phase === "idle" || phase === "success" || phase === "error") && (
        <section className="history-card" aria-labelledby="history-heading">
          <div className="history-header">
            <h2
              id="history-heading"
              aria-label={history.length > 0 ? "Your uploads" : undefined}
            >
              Recent uploads
            </h2>
            <span>Saved in this browser</span>
          </div>
          {history.length === 0 ? (
            <p className="empty-history">Your shared files will appear here.</p>
          ) : (
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
                      <time dateTime={entry.expiresAt}>
                        {new Date(entry.expiresAt).toLocaleString()}
                      </time>
                    </p>
                  </div>
                  <div className="history-actions">
                    <a aria-label={entry.shareUrl} href={entry.shareUrl}>
                      Copy link
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
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <p className="visually-hidden" aria-live="polite">
        {historyStatus}
      </p>
    </div>
  );
}
