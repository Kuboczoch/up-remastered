"use client";

import { DestructiveConfirmation } from "@/components/destructive-confirmation";
import { ManualCopyLink } from "@/components/manual-copy-link";
import { copyLink as copyCompleteLink } from "@/lib/copy-link";
import { useTranslation } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/locale";

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

import {
  isTerminalRequest,
  OwnerRequestLifecycle,
} from "../owner-request-lifecycle";
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
] as const;
const SIZE_PRESETS = [1024, 10 * 1024 * 1024, 100 * 1024 * 1024, 1024 ** 3];
const BYTE_UNITS: ByteUnit[] = ["B", "KiB", "MiB", "GiB"];

function subscribeToHydration() {
  return () => undefined;
}

function formatDuration(milliseconds: number, locale: Locale): string {
  const [value, unit] =
    milliseconds % DAY === 0
      ? ([milliseconds / DAY, "day"] as const)
      : milliseconds % HOUR === 0
        ? ([milliseconds / HOUR, "hour"] as const)
        : ([Math.floor(milliseconds / 60_000), "minute"] as const);
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "long",
  }).format(value);
}

function toLocalInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function CreateRequestForm() {
  const { locale, t, message } = useTranslation();
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
    ).map(({ label, value }) => ({ label: t(label), value }));
    if (!allowed.some(({ value }) => value === maxExpirationMs)) {
      allowed.push({
        label: t("Maximum ({duration})", {
          duration: formatDuration(maxExpirationMs, locale),
        }),
        value: maxExpirationMs,
      });
    }
    return allowed;
  }, [maxExpirationMs, locale, t]);
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
          t("Expiration must be in the future and within {duration}.", {
            duration: formatDuration(maxExpirationMs, locale),
          }),
        );
      }

      let maxBytes = Number(sizeChoice);
      if (sizeChoice === "custom") {
        try {
          maxBytes = parseByteQuantity(
            customSize,
            customSizeUnit,
            maxUploadBytes,
          );
        } catch (caught) {
          const detail = caught instanceof Error ? caught.message : "";
          throw new RangeError(
            detail === "Enter a positive size without exponents." ||
              detail === "Size must convert to a whole number of bytes."
              ? message(detail)
              : t("Size must be between 1 byte and {size}.", {
                  size: formatBytes(maxUploadBytes, locale),
                }),
          );
        }
      }
      if (
        !Number.isSafeInteger(maxBytes) ||
        maxBytes < 1 ||
        maxBytes > maxUploadBytes
      ) {
        throw new RangeError(
          t("Size must be between 1 byte and {size}.", {
            size: formatBytes(maxUploadBytes, locale),
          }),
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
      setError(
        caught instanceof RangeError
          ? caught.message
          : message(
              caught instanceof Error ? caught.message : "",
              "Request failed.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (
      !created ||
      busy ||
      !["active", "retry"].includes((liveRequest ?? created).status)
    )
      return;
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
      const feedback = message(
        caught instanceof Error ? caught.message : "",
        "Could not revoke the request.",
      );
      setError(feedback);
      throw new Error(feedback);
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
        <h2 id="request-created">{t("Upload request created")}</h2>
        <p className={styles.result}>
          {t("Send this upload link:")}{" "}
          <a href={created.uploadUrl}>{created.uploadUrl}</a>
        </p>
        <button
          className={styles.linkButton}
          onClick={() => copyLink("upload", created.uploadUrl)}
          type="button"
        >
          {copied === "upload"
            ? t("Upload link copied")
            : t("Copy upload link")}
        </button>
        <p className={styles.result}>
          <strong>{t("Save this private owner link:")}</strong>{" "}
          <a href={created.managementUrl}>{created.managementUrl}</a>
        </p>
        <button
          className={styles.linkButton}
          onClick={() => copyLink("management", created.managementUrl)}
          type="button"
        >
          {copied === "management"
            ? t("Owner link copied")
            : t("Copy owner link")}
        </button>
        {manualCopyUrl && <ManualCopyLink value={manualCopyUrl} />}
        <p>
          {t(
            "This link can inspect or revoke the request and cannot be recovered by the server.",
          )}
        </p>
        <p>
          {t("Limit: {size} · Expires {expiry}", {
            size: formatBytes(displayedRequest.maxBytes, locale),
            expiry:
              Date.parse(displayedRequest.expiresAt) <=
              (now ?? Date.parse(displayedRequest.expiresAt))
                ? t("expired")
                : formatRelativeExpiry(displayedRequest.expiresAt, now, locale),
          })}{" "}
          ·{" "}
          <time dateTime={displayedRequest.expiresAt}>
            {formatLocalDateTime(displayedRequest.expiresAt, locale)}
          </time>
        </p>
        <p className={styles.status} role="status">
          {t("Status:")} {message(displayedRequest.status.replace("_", " "))}
        </p>
        <p className={styles.muted} aria-live="polite">
          {message(statusConnectionMessage(connection))}
        </p>
        <OwnerRequestLifecycle request={displayedRequest} />
        <div className={styles.actions}>
          {!isTerminalRequest(displayedRequest.status) && (
            <DestructiveConfirmation
              className={styles.linkButton}
              disabled={
                busy || !["active", "retry"].includes(displayedRequest.status)
              }
              onConfirm={revoke}
              label={t("Revoke request")}
              title={t("Revoke upload request?")}
              description={t(
                "Revoke the upload request expiring {date} ({size} limit)? Its shared upload link will stop working. This cannot be undone; create a new request instead.",
                {
                  date: formatLocalDateTime(displayedRequest.expiresAt, locale),
                  size: formatBytes(displayedRequest.maxBytes, locale),
                },
              )}
              confirmLabel={t("Confirm revoke request")}
            />
          )}
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
            {t("Create another")}
          </button>
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <form className={styles.card} onSubmit={submit}>
      {!limits && (
        <div>
          <p role={limitsError ? "alert" : "status"}>
            {limitsError
              ? t("Could not load server limits. Please retry.")
              : t("Loading server limits…")}
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
              {t("Retry loading limits")}
            </button>
          )}
        </div>
      )}
      <label className={styles.field}>
        {t("Request expires")}
        <select
          disabled={!hydrated || !limits}
          name="expirationPreset"
          onChange={(event) => selectExpiration(event.target.value)}
          value={expirationChoice}
        >
          {!limits && <option value="0">{t("Loading server limits…")}</option>}
          {limits &&
            expirationPresets.map(({ label, value }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          <option value="custom">{t("Custom date and time")}</option>
        </select>
      </label>
      {expirationChoice === "custom" ? (
        <label className={styles.field}>
          {t("Custom expiration date and time")}
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
        {t("Maximum upload size")}
        <select
          disabled={!hydrated || !limits}
          name="sizePreset"
          onChange={(event) => setSizeChoice(event.target.value)}
          value={sizeChoice}
        >
          {!limits && <option value="0">{t("Loading server limits…")}</option>}
          {limits &&
            sizePresets.map((bytes) => (
              <option key={bytes} value={bytes}>
                {bytes === maxUploadBytes
                  ? t("Server maximum: {size}", {
                      size: formatBytes(bytes, locale),
                    })
                  : formatBytes(bytes, locale)}
              </option>
            ))}
          <option value="custom">{t("Custom size")}</option>
        </select>
      </label>
      {sizeChoice === "custom" ? (
        <div className={styles.inlineFields}>
          <label className={styles.field}>
            {t("Size amount")}
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
            {t("Size unit")}
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
        {t("The link accepts one successful upload.")}
        {limits && (
          <>
            {" "}
            {t("Server maximum: {size}", {
              size: formatBytes(maxUploadBytes, locale),
            })}
            .
          </>
        )}
      </p>
      <button
        className={styles.button}
        disabled={!hydrated || !limits || busy}
        type="submit"
      >
        {busy ? t("Creating…") : t("Create upload request")}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
