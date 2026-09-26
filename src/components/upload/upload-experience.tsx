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

type PublicConfiguration = {
  maxTemporaryFileSize: number;
};

type Phase = "idle" | "uploading" | "success" | "error";

function isDirectoryDrop(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.items).some((item) => {
    const entry = (
      item as DataTransferItem & {
        webkitGetAsEntry?: () => { isDirectory?: boolean } | null;
      }
    ).webkitGetAsEntry?.();
    return entry?.isDirectory === true;
  });
}

function expirationLabel(expiresAt: string, now: number): string {
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  if (remaining === 0) {
    return "Expired";
  }

  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s remaining`;
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
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrSvg, setQrSvg] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const errorHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const requestSequence = useRef(0);
  const originalTitle = useRef("up - remastered");

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
      document.title = originalTitle.current;
    };
  }, []);

  useEffect(() => {
    document.title =
      phase === "uploading"
        ? `${progress}% · up - remastered`
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
          new File([pastedText], "pasted-text.txt", {
            type: "text/plain;charset=utf-8",
          }),
        );
      }
    };

    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, [beginUpload, phase]);

  function reset() {
    requestSequence.current += 1;
    abortRef.current?.();
    abortRef.current = null;
    setPhase("idle");
    setProgress(0);
    setError("");
    setResult(null);
    setText("");
    setCopied(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 1) {
      void beginUpload(files[0]);
    }
  }

  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragActive(false);
    const files = Array.from(event.dataTransfer.files);
    if (isDirectoryDrop(event) || files.length !== 1) {
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
        new File([pastedText], "pasted-text.txt", {
          type: "text/plain;charset=utf-8",
        }),
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
      new File([text], `text-${Date.now()}.txt`, {
        type: "text/plain;charset=utf-8",
      }),
    );
  }

  async function copyUrl() {
    if (!result) {
      return;
    }
    try {
      await navigator.clipboard.writeText(result.shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="upload-workspace" onPaste={pasteIntoPanel}>
      {phase === "idle" && (
        <section
          className={`upload-card drop-zone${dragActive ? " is-dragging" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={drop}
          aria-labelledby="upload-heading"
        >
          <h2 id="upload-heading">Upload a file</h2>
          <p>
            Drop one file here, paste from your clipboard, or choose a file.
          </p>
          <input
            className="visually-hidden"
            id="file-picker"
            onChange={chooseFile}
            ref={inputRef}
            type="file"
          />
          <label className="primary-action" htmlFor="file-picker">
            Choose file
          </label>
          <p className="limit-note" id="upload-limit">
            {maxBytes === null
              ? "Checking upload limit…"
              : `Maximum ${formatBytes(maxBytes)}`}
          </p>
          {configurationWarning && (
            <p className="warning-note">{configurationWarning}</p>
          )}

          <div className="text-upload">
            <label htmlFor="text-upload">Or upload text</label>
            <textarea
              id="text-upload"
              onChange={(event) => setText(event.target.value)}
              placeholder="Paste or type text"
              rows={4}
              value={text}
            />
            <button
              className="secondary-action"
              onClick={uploadText}
              type="button"
            >
              Upload text
            </button>
          </div>

          <details className="upload-help">
            <summary>More ways to upload</summary>
            <p>
              Paste a file or text anywhere on this page. Desktop users can drag
              one file into the panel.
            </p>
            <p>
              <a href="/sharex" download>
                ShareX config
              </a>{" "}
              ·{" "}
              <a href="/sh" download>
                Shell helper
              </a>
            </p>
          </details>
        </section>
      )}

      {phase === "uploading" && (
        <section
          className="upload-card state-card"
          aria-live="polite"
          aria-busy="true"
        >
          <p className="eyebrow">Uploading</p>
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
          <button className="secondary-action" onClick={reset} type="button">
            Cancel
          </button>
        </section>
      )}

      {phase === "error" && (
        <section className="upload-card state-card error-card" role="alert">
          <p className="eyebrow">Upload failed</p>
          <h2 ref={errorHeadingRef} tabIndex={-1}>
            Something went wrong
          </h2>
          <p>{error}</p>
          <button className="primary-action" onClick={reset} type="button">
            Try again
          </button>
        </section>
      )}

      {phase === "success" && result && (
        <section className="upload-card result-card" aria-live="polite">
          <p className="eyebrow">Upload complete</p>
          <h2 ref={resultHeadingRef} tabIndex={-1}>
            {result.originalName}
          </h2>
          <input
            aria-label="Share URL"
            className="result-url"
            onDoubleClick={() => void copyUrl()}
            readOnly
            title="Double-click to copy"
            value={result.shareUrl}
          />
          <p>
            {formatBytes(result.size)} ·{" "}
            {expirationLabel(result.expiresAt, now)}
          </p>
          <div className="result-actions">
            <button
              className="primary-action"
              onClick={() => void copyUrl()}
              type="button"
            >
              {copied ? "Copied" : "Copy URL"}
            </button>
            <a
              className="secondary-action"
              href={result.shareUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open file
            </a>
          </div>
          {qrSvg && (
            <div
              aria-label="QR code for uploaded file"
              className="qr-code"
              data-testid="qr-code"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
              role="img"
            />
          )}
          <button className="text-action" onClick={reset} type="button">
            Upload another
          </button>
        </section>
      )}
    </div>
  );
}
