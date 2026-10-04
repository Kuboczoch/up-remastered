"use client";

import { DestructiveConfirmation } from "@/components/destructive-confirmation";
import { ManualCopyLink } from "@/components/manual-copy-link";
import { copyLink as copyCompleteLink } from "@/lib/copy-link";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";

import {
  formatBytes,
  formatLocalDateTime,
  formatRelativeExpiry,
  parseByteQuantity,
  type ByteUnit,
} from "@/lib/format";

import styles from "../request.module.css";
import {
  statusConnectionMessage,
  useUploadRequestStatus,
  type RequestDetails,
} from "../use-upload-request-status";

type CreatedRequest = RequestDetails & {
  managementUrl: string;
  managementToken: string;
  uploadUrl: string;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const EXPIRATION_PRESETS = [
  { label: "1 hour", value: HOUR },
  { label: "1 day", value: DAY },
  { label: "7 days", value: 7 * DAY },
];
const SIZE_PRESETS = [1024, 10 * 1024 * 1024, 100 * 1024 * 1024, 1024 ** 3];
const BYTE_UNITS: ByteUnit[] = ["B", "KiB", "MiB", "GiB"];

function subscribeToHydration() {
  return () => undefined;
}

function formatDuration(milliseconds: number): string {
  if (milliseconds % DAY === 0) return `${milliseconds / DAY} days`;
  if (milliseconds % HOUR === 0) return `${milliseconds / HOUR} hours`;
  return `${Math.floor(milliseconds / 60_000)} minutes`;
}

function toLocalInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function CreateRequestForm() {
  const [limits, setLimits] = useState<{
    maxExpirationMs: number;
    maxUploadBytes: number;
  } | null>(null);
  const [limitsError, setLimitsError] = useState(false);
  const [limitsAttempt, setLimitsAttempt] = useState(0);
  const maxExpirationMs = limits?.maxExpirationMs ?? 0;
  const maxUploadBytes = limits?.maxUploadBytes ?? 0;
  const expirationPresets = useMemo(() => {
    const allowed = EXPIRATION_PRESETS.filter(
      ({ value }) => value <= maxExpirationMs,
    );
    if (!allowed.some(({ value }) => value === maxExpirationMs)) {
      allowed.push({
        label: `Maximum (${formatDuration(maxExpirationMs)})`,
        value: maxExpirationMs,
      });
    }
    return allowed;
  }, [maxExpirationMs]);
  const sizePresets = useMemo(
    () =>
      Array.from(
        new Set([
          ...SIZE_PRESETS.filter((value) => value < maxUploadBytes),
          maxUploadBytes,
        ]),
      ),
    [maxUploadBytes],
  );
  const [created, setCreated] = useState<CreatedRequest>();
  const [copied, setCopied] = useState<"management" | "upload">();
  const [manualCopyUrl, setManualCopyUrl] = useState("");
  const copySequence = useRef(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [expirationChoice, setExpirationChoice] = useState(() =>
    String(expirationPresets[0]?.value ?? maxExpirationMs),
  );
  const [customExpiration, setCustomExpiration] = useState("");
  const [customExpirationMax, setCustomExpirationMax] = useState("");
  const [sizeChoice, setSizeChoice] = useState(String(maxUploadBytes));
  const [customSize, setCustomSize] = useState(String(maxUploadBytes));
  const [customSizeUnit, setCustomSizeUnit] = useState<ByteUnit>("B");
  const [now, setNow] = useState<number>();

  useEffect(() => {
    const controller = new AbortController();
    async function loadLimits() {
      try {
        const response = await fetch("/api/configuration", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Configuration unavailable.");
        const configuration = await response.json();
        if (
          !Number.isFinite(configuration.maxFileLifetime) ||
          configuration.maxFileLifetime <= 0 ||
          !Number.isSafeInteger(configuration.maxTemporaryFileSize) ||
          configuration.maxTemporaryFileSize <= 0
        ) {
          throw new Error("Invalid server limits.");
        }
        if (controller.signal.aborted) return;
        setLimits({
          maxExpirationMs: configuration.maxFileLifetime,
          maxUploadBytes: configuration.maxTemporaryFileSize,
        });
        setExpirationChoice(
          String(Math.min(HOUR, configuration.maxFileLifetime)),
        );
        setSizeChoice(String(configuration.maxTemporaryFileSize));
        setCustomSize(String(configuration.maxTemporaryFileSize));
      } catch {
        if (!controller.signal.aborted) setLimitsError(true);
      }
    }
    void loadLimits();
    return () => controller.abort();
  }, [limitsAttempt]);
  const { connection, request: liveRequest } = useUploadRequestStatus(
    created?.managementToken,
    created,
  );

  useEffect(() => {
    if (!created) return;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [created]);

  function selectExpiration(value: string) {
    setExpirationChoice(value);
    if (value !== "custom") return;

    const current = Date.now();
    const defaultDuration = Math.min(HOUR, maxExpirationMs);
    setCustomExpiration(toLocalInputValue(new Date(current + defaultDuration)));
    setCustomExpirationMax(
      toLocalInputValue(new Date(current + maxExpirationMs)),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!limits || busy) return;
    setBusy(true);
    setError("");

    try {
      const submittedAt = Date.now();
      const expiresAt =
        expirationChoice === "custom"
          ? new Date(customExpiration)
          : new Date(submittedAt + Number(expirationChoice));
      if (
        !Number.isFinite(expiresAt.getTime()) ||
        expiresAt.getTime() <= submittedAt ||
        expiresAt.getTime() > submittedAt + maxExpirationMs
      ) {
        throw new RangeError(
          `Expiration must be in the future and within ${formatDuration(maxExpirationMs)}.`,
        );
      }

      const maxBytes =
        sizeChoice === "custom"
          ? parseByteQuantity(customSize, customSizeUnit, maxUploadBytes)
          : Number(sizeChoice);
      if (
        !Number.isSafeInteger(maxBytes) ||
        maxBytes < 1 ||
        maxBytes > maxUploadBytes
      ) {
        throw new RangeError(
          `Size must be between 1 byte and ${formatBytes(maxUploadBytes)}.`,
        );
      }

      const response = await fetch("/api/upload-requests", {
        body: JSON.stringify({
          expiresAt: expiresAt.toISOString(),
          maxBytes,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as CreatedRequest & {
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(body.error?.message ?? "Request failed.");
      setNow(Date.now());
      copySequence.current += 1;
      setCopied(undefined);
      setManualCopyUrl("");
      setCreated(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!created) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/upload-requests/manage", {
        headers: { authorization: `Bearer ${created.managementToken}` },
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not revoke the request.");
      const body = (await response.json()) as { request: RequestDetails };
      setCreated({ ...created, ...body.request });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
      throw caught;
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(kind: "management" | "upload", value: string) {
    const sequence = ++copySequence.current;
    setError("");
    const success = await copyCompleteLink(value);
    if (sequence !== copySequence.current) return;
    setCopied(success ? kind : undefined);
    setManualCopyUrl(success ? "" : value);
  }

  if (created) {
    const displayedRequest = liveRequest ?? created;
    return (
      <section className={styles.card} aria-labelledby="request-created">
        <h2 id="request-created">Upload request created</h2>
        <p className={styles.result}>
          Send this upload link:{" "}
          <a href={created.uploadUrl}>{created.uploadUrl}</a>
        </p>
        <button
          className={styles.linkButton}
          onClick={() => copyLink("upload", created.uploadUrl)}
          type="button"
        >
          {copied === "upload" ? "Upload link copied" : "Copy upload link"}
        </button>
        <p className={styles.result}>
          <strong>Save this private owner link:</strong>{" "}
          <a href={created.managementUrl}>{created.managementUrl}</a>
        </p>
        <button
          className={styles.linkButton}
          onClick={() => copyLink("management", created.managementUrl)}
          type="button"
        >
          {copied === "management" ? "Owner link copied" : "Copy owner link"}
        </button>
        {manualCopyUrl && <ManualCopyLink value={manualCopyUrl} />}
        <p>
          This link can inspect or revoke the request and cannot be recovered by
          the server.
        </p>
        <p>
          Limit: {formatBytes(displayedRequest.maxBytes)} · Expires{" "}
          {formatRelativeExpiry(
            displayedRequest.expiresAt,
            now ?? Date.parse(displayedRequest.expiresAt),
          )}{" "}
          ·{" "}
          <time dateTime={displayedRequest.expiresAt}>
            {formatLocalDateTime(displayedRequest.expiresAt)}
          </time>
        </p>
        <p className={styles.status} role="status">
          Status: {displayedRequest.status.replace("_", " ")}
        </p>
        <p className={styles.muted} aria-live="polite">
          {statusConnectionMessage(connection)}
        </p>
        {displayedRequest.uploadId ? (
          <p>
            Uploaded file:{" "}
            <a href={`/${displayedRequest.uploadId}`}>Open file</a>
          </p>
        ) : null}
        <div className={styles.actions}>
          <DestructiveConfirmation
            className={styles.linkButton}
            disabled={
              busy || !["active", "retry"].includes(displayedRequest.status)
            }
            onConfirm={revoke}
            label="Revoke request"
            title="Revoke upload request?"
            description={`Revoke the upload request expiring ${formatLocalDateTime(displayedRequest.expiresAt)} (${formatBytes(displayedRequest.maxBytes)} limit)? Its shared upload link will stop working. This cannot be undone; create a new request instead.`}
            confirmLabel="Confirm revoke request"
          />
          <button
            className={styles.button}
            onClick={() => {
              copySequence.current += 1;
              setCreated(undefined);
              setCopied(undefined);
              setManualCopyUrl("");
            }}
            type="button"
          >
            Create another
          </button>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>
    );
  }

  return (
    <form className={styles.card} onSubmit={submit}>
      {!limits && (
        <div>
          <p role={limitsError ? "alert" : "status"}>
            {limitsError
              ? "Could not load server limits. Please retry."
              : "Loading server limits…"}
          </p>
          {limitsError && (
            <button
              className="outline-button"
              onClick={() => {
                setLimitsError(false);
                setLimitsAttempt((attempt) => attempt + 1);
              }}
              type="button"
            >
              Retry loading limits
            </button>
          )}
        </div>
      )}
      <label className={styles.field}>
        Request expires
        <select
          disabled={!hydrated || !limits}
          name="expirationPreset"
          onChange={(event) => selectExpiration(event.target.value)}
          value={expirationChoice}
        >
          {!limits && <option value="0">Loading server limits…</option>}
          {limits &&
            expirationPresets.map(({ label, value }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          <option value="custom">Custom date and time</option>
        </select>
      </label>
      {expirationChoice === "custom" ? (
        <label className={styles.field}>
          Custom expiration date and time
          <input
            max={customExpirationMax}
            name="expiresAt"
            onChange={(event) => setCustomExpiration(event.target.value)}
            required
            type="datetime-local"
            value={customExpiration}
          />
        </label>
      ) : null}
      <label className={styles.field}>
        Maximum upload size
        <select
          disabled={!hydrated || !limits}
          name="sizePreset"
          onChange={(event) => setSizeChoice(event.target.value)}
          value={sizeChoice}
        >
          {!limits && <option value="0">Loading server limits…</option>}
          {limits &&
            sizePresets.map((bytes) => (
              <option key={bytes} value={bytes}>
                {bytes === maxUploadBytes ? "Server maximum: " : ""}
                {formatBytes(bytes)}
              </option>
            ))}
          <option value="custom">Custom size</option>
        </select>
      </label>
      {sizeChoice === "custom" ? (
        <div className={styles.inlineFields}>
          <label className={styles.field}>
            Size amount
            <input
              inputMode="decimal"
              min="0"
              name="maxBytes"
              onChange={(event) => setCustomSize(event.target.value)}
              required
              step="any"
              type="number"
              value={customSize}
            />
          </label>
          <label className={styles.field}>
            Size unit
            <select
              name="sizeUnit"
              onChange={(event) =>
                setCustomSizeUnit(event.target.value as ByteUnit)
              }
              value={customSizeUnit}
            >
              {BYTE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <p className={styles.muted}>
        The link accepts one successful upload.
        {limits && <> Server maximum: {formatBytes(maxUploadBytes)}.</>}
      </p>
      <button
        className={styles.button}
        disabled={!hydrated || !limits || busy}
        type="submit"
      >
        {busy ? "Creating…" : "Create upload request"}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
